"""Hosted zones: list, create, get, edit and delete the signed-in user's zones.

The rules live in services/zones.py; this module only maps HTTP to them.
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import User
from schemas import ZoneCreate, ZoneDetailOut, ZoneOut, ZoneUpdate
from services import zones as zone_service

router = APIRouter(prefix="/zones", tags=["hosted zones"])


@router.get("", response_model=list[ZoneOut])
def list_zones(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ZoneOut]:
    return [ZoneOut.from_zone(zone, count) for zone, count in zone_service.list_zones(db, user)]


@router.post("", response_model=ZoneDetailOut, status_code=status.HTTP_201_CREATED)
def create_zone(
    body: ZoneCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ZoneDetailOut:
    # Returns the full zone (with its new NS/SOA records) because the console
    # opens the zone's details page right after creating it.
    zone = zone_service.create_zone(db, user, body)
    return ZoneDetailOut.from_zone_with_records(zone)


@router.get("/{zone_id}", response_model=ZoneDetailOut)
def get_zone(
    zone_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ZoneDetailOut:
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    return ZoneDetailOut.from_zone_with_records(zone)


@router.patch("/{zone_id}", response_model=ZoneDetailOut)
def update_zone(
    zone_id: str,
    body: ZoneUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ZoneDetailOut:
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    zone = zone_service.update_zone(db, zone, body)
    return ZoneDetailOut.from_zone_with_records(zone)


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(
    zone_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    zone = zone_service.get_zone_or_404(db, user, zone_id)
    zone_service.delete_zone(db, zone)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
