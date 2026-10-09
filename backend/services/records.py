"""DNS record logic: Route 53's rules for creating, editing and deleting record sets.

Every function receives a zone already checked to belong to the signed-in user
(services.zones.get_zone_or_404), with its records loaded. Errors are raised as
HTTPException with Route 53's wording where the console shows it, so the routers
stay thin.

The rules, as in Route 53 with simple routing:
  * one record set per name and type in a zone;
  * a CNAME can't be at the zone apex, has exactly one value, and no other record
    can share its name;
  * the SOA record and the apex NS record can't be deleted, renamed or retyped
    (their TTL and values can be edited).
"""

from collections.abc import Iterable

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from dns_names import normalize_record_name
from errors import RECORD_SET_ALREADY_EXISTS, CodedHTTPException
from models import DnsRecord, HostedZone
from record_values import normalize_values
from schemas import RecordCreate, RecordUpdate

SOA_REQUIRED_MESSAGE = "A HostedZone must contain exactly one SOA record."
APEX_NS_REQUIRED_MESSAGE = "A HostedZone must contain at least one NS record for the zone itself."
RACE_MESSAGE = "A record was changed by another request at the same time. Refresh and try again."


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, message)


def _conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, message)


def _types_by_name(records: Iterable[DnsRecord]) -> dict[str, set[str]]:
    """The record types present at each name, e.g. {"example.com.": {"NS", "SOA"}}."""
    types: dict[str, set[str]] = {}
    for record in records:
        types.setdefault(record.name, set()).add(record.type)
    return types


def _parse(zone: HostedZone, name: str, record_type: str, values: list[str]) -> tuple[str, list[str]]:
    """The normalized name and values, or a 400 with the console-style message."""
    try:
        return normalize_record_name(name, zone.name), normalize_values(record_type, values)
    except ValueError as error:
        raise _bad_request(str(error)) from None


def _check_record_set(
    zone: HostedZone, name: str, record_type: str, values: list[str], types_here: set[str]
) -> None:
    """Route 53's rules for adding the record set (name, type) to a name that
    already holds records of `types_here`."""
    if record_type == "CNAME" and len(values) > 1:
        raise _bad_request(
            f"RRSet of type CNAME with DNS name {name} can have only one value; "
            f"{len(values)} were entered."
        )
    if record_type in types_here:
        # Route 53's wording; the code lets the console banner say
        # "A record with the specified name already exists."
        raise CodedHTTPException(
            status.HTTP_409_CONFLICT,
            f"Tried to create resource record set [name='{name}', type='{record_type}'] "
            "but it already exists",
            RECORD_SET_ALREADY_EXISTS,
        )
    if record_type == "CNAME":
        if name == zone.name:
            raise _bad_request(
                f"RRSet of type CNAME with DNS name {name} is not permitted at apex "
                f"in zone {zone.name}"
            )
        if types_here:
            raise _conflict(
                f"RRSet of type CNAME with DNS name {name} is not permitted as it "
                f"conflicts with other records with the same DNS name in zone {zone.name}"
            )
    elif "CNAME" in types_here:
        raise _conflict(
            f"RRSet with DNS name {name} is not permitted because a conflicting RRSet "
            f"of type CNAME with the same DNS name already exists in zone {zone.name}"
        )


def _check_keeps_identity(zone: HostedZone, record: DnsRecord) -> None:
    """Route 53 keeps a zone's SOA record and its apex NS record for as long as the
    zone exists: they can't be deleted, and so can't be renamed or retyped either."""
    if record.type == "SOA":
        raise _bad_request(SOA_REQUIRED_MESSAGE)
    if record.type == "NS" and record.name == zone.name:
        raise _bad_request(APEX_NS_REQUIRED_MESSAGE)


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        # Only reachable if another request wrote the same record set in the
        # meantime: UNIQUE(zone_id, name, type) stops the duplicate.
        db.rollback()
        raise _conflict(RACE_MESSAGE) from None


def get_record_or_404(zone: HostedZone, record_id: int) -> DnsRecord:
    """The record with this ID in `zone`. A record of another zone is a 404 too."""
    record = next((r for r in zone.records if r.id == record_id), None)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No record found with ID: {record_id}")
    return record


def create_records(db: Session, zone: HostedZone, items: list[RecordCreate]) -> list[DnsRecord]:
    """Create every record in `items`, or none of them (Route 53 applies a change
    batch atomically). Each item is checked against the zone's existing records
    and the items before it."""
    types_at = _types_by_name(zone.records)
    in_request: set[tuple[str, str]] = set()

    new_records = []
    for item in items:
        name, values = _parse(zone, item.name, item.type, item.values)
        if (name, item.type) in in_request:
            # Listed twice in this request (Route 53's wording for a duplicate change).
            raise _bad_request(
                "The request contains an invalid set of changes for a resource record set "
                f"'{item.type} {name}'"
            )
        in_request.add((name, item.type))

        types_here = types_at.setdefault(name, set())
        _check_record_set(zone, name, item.type, values, types_here)
        types_here.add(item.type)
        new_records.append(DnsRecord(name=name, type=item.type, ttl=item.ttl, rdata=values))

    zone.records.extend(new_records)
    _commit(db)
    return new_records


def update_record(db: Session, zone: HostedZone, record: DnsRecord, data: RecordUpdate) -> DnsRecord:
    """Apply the fields sent. A new name or type is checked like a new record set,
    against every other record in the zone."""
    name = data.name if data.name is not None else record.name
    record_type = data.type or record.type
    # The current values are checked again too: after a type change they must
    # suit the new type (192.0.2.1 can't become a CNAME's value).
    values = data.values if data.values is not None else record.rdata
    name, values = _parse(zone, name, record_type, values)

    if (name, record_type) != (record.name, record.type):
        _check_keeps_identity(zone, record)
        others = _types_by_name(r for r in zone.records if r is not record)
        _check_record_set(zone, name, record_type, values, others.get(name, set()))
    elif record_type == "CNAME" and len(values) > 1:
        _check_record_set(zone, name, record_type, values, set())  # the one-value rule

    record.name, record.type, record.rdata = name, record_type, values
    if data.ttl is not None:
        record.ttl = data.ttl
    _commit(db)
    return record


def delete_records(db: Session, zone: HostedZone, records: list[DnsRecord]) -> None:
    """Delete all of `records` or, if any of them must stay, none of them."""
    for record in records:
        _check_keeps_identity(zone, record)
    for record in records:
        db.delete(record)
    db.commit()
