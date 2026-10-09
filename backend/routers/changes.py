"""Changes: GET /api/changes/{id}, the console's "Change Info" page ("View status")."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import User
from schemas import ChangeInfoOut
from services import changes as change_service

router = APIRouter(prefix="/changes", tags=["changes"])


@router.get("/{change_id}", response_model=ChangeInfoOut)
def get_change(
    change_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ChangeInfoOut:
    change = change_service.get_change_or_404(db, user, change_id)
    return change_service.change_info(change)
