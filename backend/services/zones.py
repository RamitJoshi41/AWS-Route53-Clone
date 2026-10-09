"""Hosted zone logic: IDs, default name servers and records, and the CRUD rules.

Every function takes the signed-in user and only ever touches that user's zones.
Errors are raised as HTTPException with the API's status codes, so the routers
stay thin.
"""

import random

from fastapi import HTTPException, status
from sqlalchemy import and_, func, not_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

import mock_vpcs
from dns_names import normalize_zone_name
from models import DnsRecord, HostedZone, HostedZoneVpc, User
from route53_ids import new_id
from schemas import VpcIn, ZoneCreate, ZoneUpdate

# --- Zone IDs -------------------------------------------------------------------


def generate_zone_id() -> str:
    """A Route 53-style ID: "Z0" + 19 uppercase letters/digits, e.g. Z02020872110QTE2FC2NK."""
    return new_id("Z0")


# --- Default name servers and records -------------------------------------------
# Route 53's name servers are numbered 0-2047. The number decides the top-level
# domain (512 per TLD) and the awsdns-NN group (8 numbers per group), e.g.
#   ns-71   -> ns-71.awsdns-08.com.      (71 // 8 = 8)
#   ns-1016 -> ns-1016.awsdns-63.net.    ((1016 - 512) // 8 = 63)

NS_TLDS = ("com", "net", "org", "co.uk")  # ns-0..511, 512..1023, 1024..1535, 1536..2047
NS_PER_TLD = 512
NS_TTL = 172800  # 2 days, Route 53's default for the zone's NS record
SOA_TTL = 900
# Everything after the primary name server in Route 53's default SOA record:
# hostmaster email, serial, refresh, retry, expire, minimum (negative-caching) TTL.
SOA_SUFFIX = "awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"

# Private zones always get this same set (as seen in the console).
PRIVATE_NAME_SERVERS = (
    "ns-1536.awsdns-00.co.uk.",
    "ns-0.awsdns-00.com.",
    "ns-1024.awsdns-00.org.",
    "ns-512.awsdns-00.net.",
)


def name_server_host(number: int) -> str:
    """The host name of Route 53 name server `number` (0-2047)."""
    tld = NS_TLDS[number // NS_PER_TLD]
    group = (number % NS_PER_TLD) // 8
    return f"ns-{number}.awsdns-{group:02d}.{tld}."


def generate_name_servers(private: bool) -> list[str]:
    """Four name servers for a new zone: one per TLD, in random order (public zones)."""
    if private:
        return list(PRIVATE_NAME_SERVERS)
    # Not security-sensitive, so the plain `random` module is enough here.
    numbers = [i * NS_PER_TLD + random.randrange(NS_PER_TLD) for i in range(len(NS_TLDS))]
    random.shuffle(numbers)
    return [name_server_host(n) for n in numbers]


def default_records(zone_name: str, name_servers: list[str]) -> list[DnsRecord]:
    """The NS and SOA records Route 53 creates with every zone."""
    return [
        DnsRecord(name=zone_name, type="NS", ttl=NS_TTL, rdata=name_servers),
        DnsRecord(
            name=zone_name, type="SOA", ttl=SOA_TTL,
            rdata=[f"{name_servers[0]} {SOA_SUFFIX}"],
        ),
    ]


# --- CRUD -----------------------------------------------------------------------

NOT_EMPTY_MESSAGE = (
    "The specified hosted zone contains non-required resource record sets "
    "and so cannot be deleted."
)


def _display(name: str) -> str:
    return name.removesuffix(".")


def _duplicate_error(name: str) -> HTTPException:
    return HTTPException(
        status.HTTP_409_CONFLICT, f"A hosted zone named {_display(name)} already exists."
    )


def _check_vpcs_exist(vpcs: list[VpcIn]) -> None:
    for vpc in vpcs:
        if not mock_vpcs.vpc_exists(vpc.region, vpc.vpc_id):
            # The console's wording for a VPC that doesn't exist in the chosen Region.
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The VPC ID is invalid.")


def list_zones(db: Session, user: User) -> list[tuple[HostedZone, int]]:
    """The user's zones, each with its record count, in one query (plus one for VPCs)."""
    record_count = func.count(DnsRecord.id)
    stmt = (
        select(HostedZone, record_count)
        .outerjoin(HostedZone.records)  # outer: a zone with no records still appears
        .where(HostedZone.user_id == user.id)
        .group_by(HostedZone.id)
        .order_by(HostedZone.name)
        .options(selectinload(HostedZone.vpcs))
    )
    return [(zone, count) for zone, count in db.execute(stmt).all()]


def get_zone_or_404(db: Session, user: User, zone_id: str) -> HostedZone:
    """The zone with this ID if it belongs to `user`. Another user's zone is a 404,
    exactly like a missing one, so IDs can't be probed."""
    zone = db.scalar(
        select(HostedZone)
        .where(HostedZone.id == zone_id, HostedZone.user_id == user.id)
        .options(selectinload(HostedZone.vpcs), selectinload(HostedZone.records))
    )
    if zone is None:
        # Route 53's wording for NoSuchHostedZone.
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No hosted zone found with ID: {zone_id}")
    return zone


def create_zone(db: Session, user: User, data: ZoneCreate) -> HostedZone:
    try:
        name = normalize_zone_name(data.name)
    except ValueError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from None

    _check_vpcs_exist(data.vpcs)

    # Friendly check first; the UNIQUE constraint below still catches a race
    # between two simultaneous requests.
    exists = db.scalar(
        select(HostedZone.id).where(HostedZone.user_id == user.id, HostedZone.name == name)
    )
    if exists:
        raise _duplicate_error(name)

    zone_id = generate_zone_id()
    while db.get(HostedZone, zone_id) is not None:  # 36^19 possibilities: practically never loops
        zone_id = generate_zone_id()

    zone = HostedZone(
        id=zone_id,
        user_id=user.id,
        name=name,
        type=data.type,
        description=data.description,
        vpcs=[HostedZoneVpc(region=v.region, vpc_id=v.vpc_id) for v in data.vpcs],
        records=default_records(name, generate_name_servers(private=data.type == "private")),
    )
    db.add(zone)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _duplicate_error(name) from None
    return zone


def update_zone(db: Session, zone: HostedZone, data: ZoneUpdate) -> HostedZone:
    # PATCH: only fields actually sent are changed (an omitted description stays as is).
    if "description" in data.model_fields_set:
        zone.description = data.description
    if data.vpcs is not None:
        _replace_vpcs(zone, data.vpcs)
    db.commit()
    return zone


def _replace_vpcs(zone: HostedZone, vpcs: list[VpcIn]) -> None:
    """Make the zone's VPCs exactly `vpcs` (the edit page sends the whole list)."""
    # Same messages as the request validation of create, so both read alike.
    if zone.type == "public":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "vpcs: a public hosted zone can't be associated with VPCs"
        )
    if not vpcs:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "vpcs: a private hosted zone must be associated with at least one VPC",
        )
    _check_vpcs_exist(vpcs)

    # Keep the rows that stay, drop the removed ones, add the new ones. Deleting
    # everything and inserting again would break UNIQUE(zone_id, vpc_id) for a VPC
    # that stays, because SQLAlchemy runs the inserts before the deletes.
    wanted = {vpc.vpc_id: vpc.region for vpc in vpcs}
    zone.vpcs = [row for row in zone.vpcs if row.vpc_id in wanted]
    existing = {row.vpc_id for row in zone.vpcs}
    zone.vpcs.extend(
        HostedZoneVpc(region=region, vpc_id=vpc_id)
        for vpc_id, region in wanted.items()
        if vpc_id not in existing
    )


def delete_zone(db: Session, zone: HostedZone) -> None:
    """Delete a zone that holds only its default NS and SOA records.

    Like Route 53, refuse (409) while any other record exists. The NS and SOA
    rows themselves are removed by the database (ON DELETE CASCADE).
    """
    is_default = and_(DnsRecord.name == zone.name, DnsRecord.type.in_(("NS", "SOA")))
    other_records = db.scalar(
        select(func.count())
        .select_from(DnsRecord)
        .where(DnsRecord.zone_id == zone.id, not_(is_default))
    )
    if other_records:
        raise HTTPException(status.HTTP_409_CONFLICT, NOT_EMPTY_MESSAGE)

    db.delete(zone)
    db.commit()
