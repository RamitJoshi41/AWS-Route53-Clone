"""Mocked authentication: login, logout and "who am I" backed by DB sessions + an httpOnly cookie."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from dependencies import get_current_user, session_cookie
from models import User, UserSession, utcnow
from schemas import LoginRequest, UserOut
from security import DUMMY_PASSWORD_HASH, hash_token, new_session_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# One message for both "no such user" and "wrong password", so responses don't
# reveal which usernames exist.
INVALID_CREDENTIALS = "Invalid username or password"


@router.post("/login", response_model=UserOut)
def login(
    body: LoginRequest,
    response: Response,
    previous_token: str | None = Depends(session_cookie),
    db: Session = Depends(get_db),
) -> User:
    user = db.scalar(select(User).where(User.username == body.username))
    if user is None:
        # Burn the same bcrypt time as a real check (no timing-based user enumeration).
        verify_password(body.password, DUMMY_PASSWORD_HASH)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)

    settings = get_settings()
    now = utcnow()

    # Housekeeping: drop every expired session, plus any session this browser
    # already had (a fresh token on each login prevents session fixation).
    db.execute(delete(UserSession).where(UserSession.expires_at <= now))
    if previous_token:
        db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(previous_token)))

    token = new_session_token()
    db.add(
        UserSession(
            token_hash=hash_token(token),
            user_id=user.id,
            created_at=now,
            expires_at=now + timedelta(hours=settings.session_ttl_hours),
        )
    )
    db.commit()

    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl_hours * 3600,
        path="/",
        httponly=True,  # invisible to JavaScript, so XSS can't steal it
        samesite="lax",  # not sent on cross-site POSTs (CSRF protection)
        secure=settings.cookie_secure,
    )
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    token: str | None = Depends(session_cookie),
    db: Session = Depends(get_db),
) -> Response:
    """Idempotent: always succeeds and clears the cookie, even with no valid session."""
    if token:
        # Deleting the row is what actually ends the session; clearing the cookie
        # alone would leave a copied token usable until it expired.
        db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(token)))
        db.commit()

    settings = get_settings()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    # Attributes must match the ones used in set_cookie, or browsers keep the cookie.
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
    )
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    """The current user. The frontend calls this on page load to restore the session."""
    return user
