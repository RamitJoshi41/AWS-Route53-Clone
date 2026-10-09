"""DNS record logic: Route 53's rules for creating, editing and deleting record sets.

Every function receives a zone already checked to belong to the signed-in user
(services.zones.get_zone_or_404), with its records loaded. Errors are raised as
HTTPException with Route 53's wording where the console shows it, so the routers
stay thin.

The rules, as in Route 53 with simple routing:
  * one record set per name and type in a zone;
  * a CNAME can't be at the zone apex, has exactly one value, and no other record
    can share its name;
  * the SOA record and the apex NS record can't be deleted (both can be edited).
"""

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from dns_names import normalize_record_name
from models import DnsRecord, HostedZone
from record_values import normalize_values
from schemas import RecordCreate, RecordUpdate

SOA_REQUIRED_MESSAGE = "A HostedZone must contain exactly one SOA record."
APEX_NS_REQUIRED_MESSAGE = "A HostedZone must contain at least one NS record for the zone itself."


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, message)


def _conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, message)


def _check_cname_value_count(name: str, record_type: str, values: list[str]) -> None:
    if record_type == "CNAME" and len(values) > 1:
        raise _bad_request(
            f"RRSet of type CNAME with DNS name {name} can have only one value; "
            f"{len(values)} were entered."
        )


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
    # Types present at each name: the zone's records, plus each item once accepted.
    types_at: dict[str, set[str]] = {}
    for record in zone.records:
        types_at.setdefault(record.name, set()).add(record.type)
    existing = {(r.name, r.type) for r in zone.records}

    new_records = []
    for item in items:
        try:
            name = normalize_record_name(item.name, zone.name)
            values = normalize_values(item.type, item.values)
        except ValueError as error:
            raise _bad_request(str(error)) from None
        _check_cname_value_count(name, item.type, values)

        types_here = types_at.setdefault(name, set())
        if item.type in types_here:
            if (name, item.type) in existing:
                raise _conflict(
                    f"Tried to create resource record set [name='{name}', type='{item.type}'] "
                    "but it already exists"
                )
            # Listed twice in this request (Route 53's wording for a duplicate change).
            raise _bad_request(
                "The request contains an invalid set of changes for a resource record set "
                f"'{item.type} {name}'"
            )
        if item.type == "CNAME":
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

        types_here.add(item.type)
        new_records.append(DnsRecord(name=name, type=item.type, ttl=item.ttl, rdata=values))

    zone.records.extend(new_records)
    try:
        db.commit()
    except IntegrityError:
        # Only reachable if another request created the same record in the meantime;
        # UNIQUE(zone_id, name, type) stops the duplicate.
        db.rollback()
        raise _conflict("One of the records was created by another request. Refresh and try again.") from None
    return new_records


def update_record(db: Session, record: DnsRecord, data: RecordUpdate) -> DnsRecord:
    """Change a record's TTL and/or values. Its name and type never change."""
    if data.ttl is not None:
        record.ttl = data.ttl
    if data.values is not None:
        try:
            values = normalize_values(record.type, data.values)
        except ValueError as error:
            raise _bad_request(str(error)) from None
        _check_cname_value_count(record.name, record.type, values)
        record.rdata = values
    db.commit()
    return record


def _check_deletable(zone: HostedZone, record: DnsRecord) -> None:
    """Route 53 keeps a zone's SOA record and its apex NS record for as long as the zone exists."""
    if record.type == "SOA":
        raise _bad_request(SOA_REQUIRED_MESSAGE)
    if record.type == "NS" and record.name == zone.name:
        raise _bad_request(APEX_NS_REQUIRED_MESSAGE)


def delete_records(db: Session, zone: HostedZone, records: list[DnsRecord]) -> None:
    """Delete all of `records` or, if any of them must stay, none of them."""
    for record in records:
        _check_deletable(zone, record)
    for record in records:
        db.delete(record)
    db.commit()
