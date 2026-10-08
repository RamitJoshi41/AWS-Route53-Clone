from collections.abc import Iterator

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from database import build_engine, get_db
from main import app


def test_health_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "version": "0.1.0"}


def test_health_reports_503_when_database_unreachable(client: TestClient) -> None:
    # A path inside a non-existent directory makes SQLite fail on connect.
    broken_engine = build_engine("sqlite:////nonexistent-dir/never/route53.db")
    BrokenSession = sessionmaker(bind=broken_engine)

    def broken_get_db() -> Iterator[Session]:
        db = BrokenSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = broken_get_db

    response = client.get("/api/health")

    assert response.status_code == 503
    assert response.json()["database"] == "error"
