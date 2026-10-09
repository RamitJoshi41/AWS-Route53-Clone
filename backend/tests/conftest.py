"""Shared pytest fixtures: an isolated SQLite database per test and a TestClient bound to it."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from database import Base, build_engine, get_db
from main import app
from models import User
from security import hash_password

# Test databases are built with create_all (not migrations), so the seeded admin
# doesn't exist here; the `user` fixture creates its own known account.
TEST_USERNAME = "alice"
TEST_PASSWORD = "correct-horse-battery"
OTHER_USERNAME = "bob"
OTHER_PASSWORD = "bobs-own-password"


@pytest.fixture
def db_session_factory(tmp_path: Path) -> Iterator[sessionmaker[Session]]:
    """Fresh SQLite file per test so tests never touch backend/route53.db or each other."""
    engine = build_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def client(db_session_factory: sessionmaker[Session]) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def user(db_session_factory: sessionmaker[Session]) -> User:
    """A user with a known password (TEST_USERNAME / TEST_PASSWORD)."""
    with db_session_factory() as db:
        new_user = User(username=TEST_USERNAME, password_hash=hash_password(TEST_PASSWORD))
        db.add(new_user)
        db.commit()
        return new_user


@pytest.fixture
def other_user(db_session_factory: sessionmaker[Session]) -> User:
    """A second account (OTHER_USERNAME / OTHER_PASSWORD), for ownership tests."""
    with db_session_factory() as db:
        new_user = User(username=OTHER_USERNAME, password_hash=hash_password(OTHER_PASSWORD))
        db.add(new_user)
        db.commit()
        return new_user


@pytest.fixture
def logged_in_client(client: TestClient, user: User) -> TestClient:
    """The same TestClient after a successful login; its cookie jar holds the session."""
    response = client.post(
        "/api/auth/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200
    return client
