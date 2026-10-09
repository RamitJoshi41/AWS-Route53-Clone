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
from schemas import RecordBatchCreate, RecordIds, RecordOut, RecordUpdate
from services import records as record_service
from services import zones as zone_service

router = APIRouter(prefix="/zones/{zone_id}/records", tags=["records"])


@router.get("", response_model=list[RecordOut])
def list_records(
    zone_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[RecordOut]:
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    return RecordOut.in_console_order(zone.records)


@router.post("", response_model=list[RecordOut], status_code=status.HTTP_201_CREATED)
def create_records(
    zone_id: str,
    body: RecordBatchCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RecordOut]:
    # A list, because the console's "Create records" submits every record on the
    # form together; either all are created or none.
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    created = record_service.create_records(db, zone, body.records)
    return [RecordOut.model_validate(record) for record in created]


@router.patch("/{record_id}", response_model=RecordOut)
def update_record(
    zone_id: str,
    record_id: int,
    body: RecordUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecordOut:
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    record = record_service.get_record_or_404(zone, record_id)
    return RecordOut.model_validate(record_service.update_record(db, zone, record, body))


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
