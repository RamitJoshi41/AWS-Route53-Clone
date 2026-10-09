import re
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from models import Change, HostedZone, User, utcnow
from services.changes import PROPAGATION_DELAY, change_status
from tests.test_records import post_records, rec, records_url
from tests.test_zones import count_rows, create

CHANGE_ID = re.compile(r"C0[A-Z0-9]{19}")


@pytest.fixture
def zone(logged_in_client: TestClient) -> dict:
    return create(logged_in_client)


def age_change(db_session_factory: sessionmaker[Session], change_id: str, by: timedelta) -> None:
    """Pretend the change was submitted `by` earlier."""
    with db_session_factory() as db:
        change = db.get(Change, change_id)
        change.submitted_at -= by
        db.commit()


# --- Status (unit) --------------------------------------------------------------


@pytest.mark.parametrize(
    ("age", "expected"),
    [
        (timedelta(0), "PENDING"),
        (PROPAGATION_DELAY - timedelta(milliseconds=1), "PENDING"),
        (PROPAGATION_DELAY, "INSYNC"),
        (timedelta(days=3), "INSYNC"),
    ],
)
def test_status_is_pending_until_the_propagation_delay_has_passed(age: timedelta, expected: str) -> None:
    now = utcnow()
    assert change_status(Change(submitted_at=now - age), now=now) == expected


# --- Changes from record mutations ----------------------------------------------


def test_create_returns_a_pending_change(logged_in_client: TestClient, zone: dict) -> None:
    body = post_records(logged_in_client, zone["id"], rec(), rec(name="b.example.com")).json()
    info = body["change_info"]
    assert CHANGE_ID.fullmatch(info["id"])
    assert info["zone_id"] == zone["id"]
    assert info["status"] == "PENDING"
    assert info["comment"] is None
    assert len(body["records"]) == 2  # one change for the whole batch


def test_change_turns_insync_after_the_delay(
    logged_in_client: TestClient, zone: dict, db_session_factory: sessionmaker[Session]
) -> None:
    change_id = post_records(logged_in_client, zone["id"], rec()).json()["change_info"]["id"]
    url = f"/api/changes/{change_id}"

    response = logged_in_client.get(url)
    assert response.status_code == 200
    assert response.json()["status"] == "PENDING"

    age_change(db_session_factory, change_id, PROPAGATION_DELAY)
    after = logged_in_client.get(url).json()
    assert after["status"] == "INSYNC"
    assert after["id"] == change_id


def test_edit_returns_its_own_change(logged_in_client: TestClient, zone: dict) -> None:
    created = post_records(logged_in_client, zone["id"], rec()).json()
    record_id = created["records"][0]["id"]
    edited = logged_in_client.patch(f"{records_url(zone['id'])}/{record_id}", json={"ttl": 60}).json()
    assert edited["record"]["ttl"] == 60
    assert edited["change_info"]["status"] == "PENDING"
    assert edited["change_info"]["id"] != created["change_info"]["id"]


def test_failed_batch_records_no_change(
    logged_in_client: TestClient, zone: dict, db_session_factory: sessionmaker[Session]
) -> None:
    response = post_records(logged_in_client, zone["id"], rec(), rec(name="bad.example.com", values=["abc"]))
    assert response.status_code == 400
    assert count_rows(db_session_factory, Change, zone_id=zone["id"]) == 0


def test_delete_records_no_change(
    logged_in_client: TestClient, zone: dict, db_session_factory: sessionmaker[Session]
) -> None:
    """The console's delete banner has no "View status", so deleting adds no change."""
    record_id = post_records(logged_in_client, zone["id"], rec()).json()["records"][0]["id"]
    logged_in_client.post(f"{records_url(zone['id'])}/batch-delete", json={"ids": [record_id]})
    assert count_rows(db_session_factory, Change, zone_id=zone["id"]) == 1  # only the create


def test_deleting_the_zone_deletes_its_changes(
    logged_in_client: TestClient, zone: dict, db_session_factory: sessionmaker[Session]
) -> None:
    record_id = post_records(logged_in_client, zone["id"], rec()).json()["records"][0]["id"]
    logged_in_client.delete(f"{records_url(zone['id'])}/{record_id}")
    assert logged_in_client.delete(f"/api/zones/{zone['id']}").status_code == 204
    assert count_rows(db_session_factory, Change, zone_id=zone["id"]) == 0


# --- Lookup, ownership and auth -------------------------------------------------


def test_unknown_change_is_404(logged_in_client: TestClient) -> None:
    response = logged_in_client.get("/api/changes/C0NOSUCHCHANGE0000000")
    assert response.status_code == 404
    assert response.json() == {
        "detail": "A change with the specified change ID does not exist: C0NOSUCHCHANGE0000000"
    }


def test_other_users_change_is_404(
    logged_in_client: TestClient, db_session_factory: sessionmaker[Session], other_user: User
) -> None:
    with db_session_factory() as db:
        db.add(HostedZone(id="Z0BOBSZONE00000000000", user_id=other_user.id, name="bob.example.", type="public"))
        db.add(Change(id="C0BOBSCHANGE000000000", zone_id="Z0BOBSZONE00000000000"))
        db.commit()
    assert logged_in_client.get("/api/changes/C0BOBSCHANGE000000000").status_code == 404


def test_change_requires_a_session(client: TestClient) -> None:
    response = client.get("/api/changes/C0ANY")
    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}
