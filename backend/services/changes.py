"""Changes: the "View status" behind every record create and edit.

Route 53 answers each change batch with a ChangeInfo (ID, status, submitted time).
The status is PENDING until the change has reached all of Route 53's DNS servers,
"within 60 seconds", then INSYNC. The clone has no DNS servers, so it mimics that
delay: a change reads PENDING for PROPAGATION_DELAY after it was submitted.
"""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Change, HostedZone, User, utcnow
from route53_ids import new_id
from schemas import ChangeInfoOut

PROPAGATION_DELAY = timedelta(seconds=30)

ChangeStatus = Literal["PENDING", "INSYNC"]


def change_status(change: Change, now: datetime | None = None) -> ChangeStatus:
    """PENDING while the change is "propagating", INSYNC afterwards."""
    now = now or utcnow()
    return "PENDING" if now - change.submitted_at < PROPAGATION_DELAY else "INSYNC"


def record_change(db: Session, zone: HostedZone) -> Change:
    """Add a change for `zone` to the session. The caller commits it together with
    the record rows, so a change exists exactly when its records were saved."""
    change_id = new_id("C0")
    while db.get(Change, change_id) is not None:  # 36^19 possibilities: practically never loops
        change_id = new_id("C0")
    # Added directly rather than through zone.changes, which would load the zone's
    # whole change history just to append one.
    change = Change(id=change_id, zone_id=zone.id, submitted_at=utcnow())
    db.add(change)
    return change


def get_change_or_404(db: Session, user: User, change_id: str) -> Change:
    """The change with this ID if it belongs to one of `user`'s zones."""
    change = db.scalar(
        select(Change).join(Change.zone).where(Change.id == change_id, HostedZone.user_id == user.id)
    )
    if change is None:
        # Route 53's wording for NoSuchChange.
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"A change with the specified change ID does not exist: {change_id}"
        )
    return change


def change_info(change: Change) -> ChangeInfoOut:
    """The API's view of a change, with its status as of now."""
    return ChangeInfoOut(
        id=change.id,
        zone_id=change.zone_id,
        status=change_status(change),
        submitted_at=change.submitted_at,
        comment=change.comment,
    )
