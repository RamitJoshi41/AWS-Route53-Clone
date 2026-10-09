"""DNS records of a hosted zone: list, create, edit and delete.

The rules live in services/records.py; this module only maps HTTP to them. Every
endpoint first loads the zone through get_zone_or_404, so another user's zone,
and the records in it, answer 404.
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import User
from schemas import (
    RecordBatchCreate,
    RecordIds,
    RecordOut,
    RecordsCreatedOut,
    RecordUpdate,
    RecordUpdatedOut,
)
from services import changes as change_service
from services import records as record_service
from services import zones as zone_service

router = APIRouter(prefix="/zones/{zone_id}/records", tags=["records"])


@router.get("", response_model=list[RecordOut])
def list_records(
    zone_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[RecordOut]:
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    return RecordOut.in_console_order(zone.records)


@router.post("", response_model=RecordsCreatedOut, status_code=status.HTTP_201_CREATED)
def create_records(
    zone_id: str,
    body: RecordBatchCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecordsCreatedOut:
    # A list, because the console's "Create records" submits every record on the
    # form together; either all are created or none. The change is what the
    # success banner's "View status" opens.
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    created, change = record_service.create_records(db, zone, body.records)
    return RecordsCreatedOut(
        records=[RecordOut.model_validate(record) for record in created],
        change_info=change_service.change_info(change),
    )


@router.patch("/{record_id}", response_model=RecordUpdatedOut)
def update_record(
    zone_id: str,
    record_id: int,
    body: RecordUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecordUpdatedOut:
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    record = record_service.get_record_or_404(zone, record_id)
    record, change = record_service.update_record(db, zone, record, body)
    return RecordUpdatedOut(
        record=RecordOut.model_validate(record), change_info=change_service.change_info(change)
    )


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    zone_id: str,
    record_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    record = record_service.get_record_or_404(zone, record_id)
    record_service.delete_records(db, zone, [record])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_records(
    zone_id: str,
    body: RecordIds,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    # The console's "Delete N selected records?" dialog: all of them, or none.
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    records = [record_service.get_record_or_404(zone, record_id) for record_id in body.ids]
    record_service.delete_records(db, zone, records)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
