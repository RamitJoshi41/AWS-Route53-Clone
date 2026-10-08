from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from models import User, UserSession, utcnow
from security import hash_token, new_session_token
from tests.conftest import TEST_PASSWORD, TEST_USERNAME

COOKIE = "session"


def session_count(db_session_factory: sessionmaker[Session]) -> int:
    with db_session_factory() as db:
        return db.scalar(select(func.count()).select_from(UserSession))


def add_session(db_session_factory: sessionmaker[Session], user: User, expires_in: timedelta) -> str:
    """Insert a session row directly and return the raw token for the cookie."""
    token = new_session_token()
    with db_session_factory() as db:
        db.add(UserSession(token_hash=hash_token(token), user_id=user.id, expires_at=utcnow() + expires_in))
        db.commit()
    return token


# --- Login -------------------------------------------------------------------


def test_login_returns_user_and_sets_httponly_cookie(
    client: TestClient, user: User, db_session_factory: sessionmaker[Session]
) -> None:
    response = client.post("/api/auth/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})

    assert response.status_code == 200
    assert response.json() == {"id": user.id, "username": TEST_USERNAME}

    set_cookie = response.headers["set-cookie"]
    assert set_cookie.startswith(f"{COOKIE}=")
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Path=/" in set_cookie
    assert "Max-Age=43200" in set_cookie  # 12 hours

    # Only the SHA-256 of the token is stored, never the token itself.
    token = response.cookies[COOKIE]
    with db_session_factory() as db:
        stored = db.scalars(select(UserSession.token_hash)).all()
    assert stored == [hash_token(token)]
    assert token not in stored


@pytest.mark.parametrize(
    ("username", "password"),
    [(TEST_USERNAME, "wrong-password"), ("nobody", TEST_PASSWORD)],
    ids=["wrong-password", "unknown-user"],
)
def test_login_rejects_bad_credentials_with_identical_message(
    client: TestClient, user: User, db_session_factory: sessionmaker[Session], username: str, password: str
) -> None:
    response = client.post("/api/auth/login", json={"username": username, "password": password})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid username or password"}
    assert "set-cookie" not in response.headers
    assert session_count(db_session_factory) == 0


def test_login_sweeps_expired_sessions(
    client: TestClient, user: User, db_session_factory: sessionmaker[Session]
) -> None:
    add_session(db_session_factory, user, expires_in=timedelta(hours=-1))

    client.post("/api/auth/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})

    assert session_count(db_session_factory) == 1  # only the new one


def test_relogin_replaces_previous_session(
    logged_in_client: TestClient, db_session_factory: sessionmaker[Session]
) -> None:
    first_token = logged_in_client.cookies[COOKIE]

    logged_in_client.post("/api/auth/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})

    assert logged_in_client.cookies[COOKIE] != first_token
    assert session_count(db_session_factory) == 1


# --- Me ----------------------------------------------------------------------


def test_me_returns_current_user(logged_in_client: TestClient, user: User) -> None:
    response = logged_in_client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json() == {"id": user.id, "username": TEST_USERNAME}


def test_me_without_cookie_returns_401(client: TestClient) -> None:
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_me_with_bogus_cookie_returns_401(client: TestClient, user: User) -> None:
    client.cookies.set(COOKIE, "not-a-real-token")

    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_me_with_expired_session_returns_401_and_deletes_it(
    client: TestClient, user: User, db_session_factory: sessionmaker[Session]
) -> None:
    client.cookies.set(COOKIE, add_session(db_session_factory, user, expires_in=timedelta(seconds=-1)))

    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Session expired"}
    assert session_count(db_session_factory) == 0


# --- Logout ------------------------------------------------------------------


def test_logout_deletes_session_and_clears_cookie(
    logged_in_client: TestClient, db_session_factory: sessionmaker[Session]
) -> None:
    response = logged_in_client.post("/api/auth/logout")

    assert response.status_code == 204
    assert response.content == b""
    set_cookie = response.headers["set-cookie"]
    assert set_cookie.startswith(f'{COOKIE}="";')
    assert "Max-Age=0" in set_cookie
    assert session_count(db_session_factory) == 0
    assert logged_in_client.get("/api/auth/me").status_code == 401


def test_old_token_is_rejected_after_logout(logged_in_client: TestClient) -> None:
    # Proves logout invalidates the session server-side, not just in the browser.
    token = logged_in_client.cookies[COOKIE]
    logged_in_client.post("/api/auth/logout")

    logged_in_client.cookies.set(COOKIE, token)  # replay the stolen/copied cookie
    response = logged_in_client.get("/api/auth/me")

    assert response.status_code == 401


def test_logout_without_session_is_idempotent(client: TestClient) -> None:
    response = client.post("/api/auth/logout")

    assert response.status_code == 204


# --- Validation (global 400 handler) ----------------------------------------


@pytest.mark.parametrize(
    ("body", "detail"),
    [
        ({"username": TEST_USERNAME}, "password: Field required"),
        ({"username": "", "password": "x"}, "username: String should have at least 1 character"),
        ({"username": TEST_USERNAME, "password": "a" * 73}, "password: must be at most 72 bytes"),
    ],
    ids=["missing-field", "empty-username", "password-over-72-bytes"],
)
def test_invalid_login_body_returns_400_with_string_detail(client: TestClient, body: dict, detail: str) -> None:
    response = client.post("/api/auth/login", json=body)

    assert response.status_code == 400
    assert response.json() == {"detail": detail}


def test_malformed_json_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", content="{not json", headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 400
    assert response.json()["detail"].startswith("body: ")
