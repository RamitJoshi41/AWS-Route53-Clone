"""Shared FastAPI dependencies, chiefly the session check that protects endpoints.

Protect a whole router with: APIRouter(dependencies=[Depends(get_current_user)])
or a single endpoint with:    user: User = Depends(get_current_user)
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyCookie
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from models import User, UserSession, utcnow
from security import hash_token

# Reads the session cookie. Declared as a security scheme (rather than reading
# request.cookies directly) so /docs shows which endpoints need a login.
# auto_error=False: a missing cookie yields None and we raise our own 401 message.
session_cookie = APIKeyCookie(
    name=get_settings().session_cookie_name,
    scheme_name="Session cookie",
    description="Set by POST /api/auth/login (httpOnly).",
    auto_error=False,
)


def get_current_user(
    token: str | None = Depends(session_cookie),
    db: Session = Depends(get_db),
) -> User:
    """Return the logged-in user, or raise 401. Runs on every protected request."""
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    session = db.get(UserSession, hash_token(token))
    if session is None:
        # Unknown token: forged, already logged out, or swept after expiry.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    if session.expires_at <= utcnow():
        # Expiry is enforced here, server-side; the cookie's Max-Age is only a hint
        # to the browser. Delete the dead row while we're at it.
        db.delete(session)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")

    return session.user
