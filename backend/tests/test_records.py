import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from models import DnsRecord, HostedZone, User
from services.records import APEX_NS_REQUIRED_MESSAGE, SOA_REQUIRED_MESSAGE
from tests.test_zones import count_rows, create


def records_url(zone_id: str) -> str:
    return f"/api/zones/{zone_id}/records"


def rec(name: str = "www.example.com", type: str = "A", ttl: int = 300, values: list[str] | None = None) -> dict:
    return {"name": name, "type": type, "ttl": ttl, "values": ["192.0.2.235"] if values is None else values}


def post_records(client: TestClient, zone_id: str, *records: dict):
    return client.post(records_url(zone_id), json={"records": list(records)})


@pytest.fixture
def zone(logged_in_client: TestClient) -> dict:
    """A fresh public zone example.com with its default NS and SOA records."""
    return create(logged_in_client)


def find(records: list[dict], name: str, type: str) -> dict:
    return next(r for r in records if r["name"] == name and r["type"] == type)


# --- List -----------------------------------------------------------------------


def test_new_zone_lists_its_ns_and_soa(logged_in_client: TestClient, zone: dict) -> None:
    response = logged_in_client.get(records_url(zone["id"]))
    assert response.status_code == 200
    assert [(r["name"], r["type"]) for r in response.json()] == [
        ("example.com.", "NS"), ("example.com.", "SOA"),
    ]


# --- Create ---------------------------------------------------------------------


def test_create_a_record(logged_in_client: TestClient, zone: dict) -> None:
    response = post_records(logged_in_client, zone["id"], rec(name="Test.Example.com"))
    assert response.status_code == 201
    [created] = response.json()
    assert created == {
        "id": created["id"], "name": "test.example.com.", "type": "A", "ttl": 300, "values": ["192.0.2.235"],
    }
    # Visible everywhere the zone's records are: the list, the zone details, the record count.
    assert created in logged_in_client.get(records_url(zone["id"])).json()
    assert created in logged_in_client.get(f"/api/zones/{zone['id']}").json()["records"]
    assert logged_in_client.get("/api/zones").json()[0]["record_count"] == 3


def test_create_at_the_apex(logged_in_client: TestClient, zone: dict) -> None:
    response = post_records(logged_in_client, zone["id"], rec(name="example.com.", type="MX", values=["10 mail.example.com"]))
    assert response.status_code == 201
    assert response.json()[0]["name"] == "example.com."


@pytest.mark.parametrize(
    ("type", "values"),
    [
        ("A", ["192.0.2.1", "192.0.2.2"]),
        ("AAAA", ["2001:db8::1"]),
        ("CNAME", ["target.example.net"]),
        ("TXT", ['"v=spf1 -all"']),
        ("MX", ["10 mail1.example.com", "20 mail2.example.com"]),
        ("NS", ["ns1.other-dns.com"]),  # delegating a subdomain
        ("PTR", ["host.example.com"]),
        ("SRV", ["1 10 5269 xmpp.example.com"]),
        ("CAA", ['0 issue "amazon.com"']),
    ],
)
def test_every_supported_type_can_be_created(logged_in_client: TestClient, zone: dict, type: str, values: list[str]) -> None:
    response = post_records(logged_in_client, zone["id"], rec(name="sub.example.com", type=type, values=values))
    assert response.status_code == 201, response.text
    assert response.json()[0]["values"] == values


def test_values_are_normalized(logged_in_client: TestClient, zone: dict) -> None:
    response = post_records(logged_in_client, zone["id"], rec(type="TXT", values=["hello"]))
    assert response.json()[0]["values"] == ['"hello"']


def test_create_several_records_at_once(logged_in_client: TestClient, zone: dict, db_session_factory) -> None:
    response = post_records(
        logged_in_client, zone["id"],
        rec(name="a.example.com"), rec(name="b.example.com"), rec(name="a.example.com", type="TXT", values=['"x"']),
    )
    assert response.status_code == 201
    assert [(r["name"], r["type"]) for r in response.json()] == [
        ("a.example.com.", "A"), ("b.example.com.", "A"), ("a.example.com.", "TXT"),
    ]
    assert count_rows(db_session_factory, DnsRecord, zone_id=zone["id"]) == 5


def test_a_bad_record_in_a_batch_creates_none(logged_in_client: TestClient, zone: dict, db_session_factory) -> None:
    response = post_records(logged_in_client, zone["id"], rec(name="ok.example.com"), rec(name="bad.example.com", values=["abc"]))
    assert response.status_code == 400
    assert "ARRDATAIllegalIPv4Address" in response.json()["detail"]
    assert count_rows(db_session_factory, DnsRecord, zone_id=zone["id"]) == 2  # still just NS and SOA


def test_duplicate_name_and_type_is_409(logged_in_client: TestClient, zone: dict) -> None:
    assert post_records(logged_in_client, zone["id"], rec()).status_code == 201
    response = post_records(logged_in_client, zone["id"], rec(name="WWW.example.com.", values=["192.0.2.9"]))
    assert response.status_code == 409
    assert response.json() == {
        "detail": "Tried to create resource record set [name='www.example.com.', type='A'] but it already exists"
    }


def test_apex_ns_already_exists(logged_in_client: TestClient, zone: dict) -> None:
    response = post_records(logged_in_client, zone["id"], rec(name="example.com", type="NS", values=["ns1.x.com"]))
    assert response.status_code == 409
    assert "type='NS'] but it already exists" in response.json()["detail"]


def test_same_record_twice_in_one_request_is_400(logged_in_client: TestClient, zone: dict) -> None:
    response = post_records(logged_in_client, zone["id"], rec(), rec(values=["192.0.2.2"]))
    assert response.status_code == 400
    assert response.json() == {
        "detail": "The request contains an invalid set of changes for a resource record set 'A www.example.com.'"
    }


def test_soa_cannot_be_created(logged_in_client: TestClient, zone: dict) -> None:
    response = post_records(logged_in_client, zone["id"], rec(name="sub.example.com", type="SOA"))
    assert response.status_code == 400
    assert response.json()["detail"].startswith("records.0.type: Input should be")


def test_name_outside_the_zone_is_400(logged_in_client: TestClient, zone: dict) -> None:
    response = post_records(logged_in_client, zone["id"], rec(name="www.example.org"))
    assert response.status_code == 400
    assert response.json() == {"detail": "RRSet with DNS name www.example.org. is not permitted in zone example.com."}


@pytest.mark.parametrize(
    ("body", "detail_start"),
    [
        ({"records": []}, "records: List should have at least 1 item"),
        ({"records": [rec(values=[])]}, "records.0.values: List should have at least 1 item"),
        ({"records": [rec(ttl=-1)]}, "records.0.ttl: Input should be greater than or equal to 0"),
        ({"records": [rec(ttl=2147483648)]}, "records.0.ttl: Input should be less than or equal to 2147483647"),
        ({"records": [{**rec(), "alias": True}]}, "records.0.alias: Extra inputs are not permitted"),
    ],
)
def test_request_validation(logged_in_client: TestClient, zone: dict, body: dict, detail_start: str) -> None:
    response = logged_in_client.post(records_url(zone["id"]), json=body)
    assert response.status_code == 400
    assert response.json()["detail"].startswith(detail_start)


# --- CNAME rules ----------------------------------------------------------------


def test_cname_not_allowed_at_apex(logged_in_client: TestClient, zone: dict) -> None:
    response = post_records(logged_in_client, zone["id"], rec(name="example.com", type="CNAME", values=["x.example.net"]))
    assert response.status_code == 400
    assert response.json() == {
        "detail": "RRSet of type CNAME with DNS name example.com. is not permitted at apex in zone example.com."
    }


def test_cname_needs_exactly_one_value(logged_in_client: TestClient, zone: dict) -> None:
    response = post_records(logged_in_client, zone["id"], rec(type="CNAME", values=["a.example.net", "b.example.net"]))
    assert response.status_code == 400
    assert "can have only one value" in response.json()["detail"]


def test_cname_conflicts_with_existing_records(logged_in_client: TestClient, zone: dict) -> None:
    post_records(logged_in_client, zone["id"], rec())
    response = post_records(logged_in_client, zone["id"], rec(type="CNAME", values=["x.example.net"]))
    assert response.status_code == 409
    assert "is not permitted as it conflicts with other records" in response.json()["detail"]


def test_other_types_conflict_with_a_cname(logged_in_client: TestClient, zone: dict) -> None:
    post_records(logged_in_client, zone["id"], rec(type="CNAME", values=["x.example.net"]))
    response = post_records(logged_in_client, zone["id"], rec(type="TXT", values=['"x"']))
    assert response.status_code == 409
    assert "a conflicting RRSet of type CNAME with the same DNS name already exists" in response.json()["detail"]


def test_cname_conflict_within_one_request(logged_in_client: TestClient, zone: dict) -> None:
    response = post_records(logged_in_client, zone["id"], rec(), rec(type="CNAME", values=["x.example.net"]))
    assert response.status_code == 409


def test_unique_constraint_backs_up_the_service(zone: dict, db_session_factory: sessionmaker[Session]) -> None:
    """Even bypassing the API's check, the database refuses a second NS record at the apex."""
    with db_session_factory() as db:
        db.add(DnsRecord(zone_id=zone["id"], name="example.com.", type="NS", ttl=60, rdata=["ns.x.com."]))
        with pytest.raises(IntegrityError):
            db.commit()


# --- Update ---------------------------------------------------------------------


def test_update_ttl_and_values(logged_in_client: TestClient, zone: dict) -> None:
    [created] = post_records(logged_in_client, zone["id"], rec()).json()
    url = f"{records_url(zone['id'])}/{created['id']}"

    response = logged_in_client.patch(url, json={"ttl": 60, "values": ["192.0.2.1", "192.0.2.2"]})
    assert response.status_code == 200
    assert response.json() == {**created, "ttl": 60, "values": ["192.0.2.1", "192.0.2.2"]}

    # Only what's sent changes.
    assert logged_in_client.patch(url, json={"ttl": 3600}).json()["values"] == ["192.0.2.1", "192.0.2.2"]
    assert logged_in_client.patch(url, json={}).json()["ttl"] == 3600


def test_apex_ns_and_soa_can_be_edited(logged_in_client: TestClient, zone: dict) -> None:
    ns = find(zone["records"], "example.com.", "NS")
    soa = find(zone["records"], "example.com.", "SOA")
    url = records_url(zone["id"])
    assert logged_in_client.patch(f"{url}/{ns['id']}", json={"values": ["ns1.mine.com."]}).status_code == 200
    soa_value = "ns1.mine.com. hostmaster.mine.com. 2 7200 900 1209600 86400"
    response = logged_in_client.patch(f"{url}/{soa['id']}", json={"values": [soa_value]})
    assert response.json()["values"] == [soa_value]


def test_update_validates_values_by_the_records_type(logged_in_client: TestClient, zone: dict) -> None:
    [created] = post_records(logged_in_client, zone["id"], rec(type="CNAME", values=["x.example.net"])).json()
    url = f"{records_url(zone['id'])}/{created['id']}"
    assert "can have only one value" in logged_in_client.patch(url, json={"values": ["a.net", "b.net"]}).json()["detail"]
    assert logged_in_client.patch(url, json={"values": ["a..b"]}).status_code == 400


@pytest.mark.parametrize("field", [{"name": "x.example.com"}, {"type": "TXT"}])
def test_name_and_type_cannot_change(logged_in_client: TestClient, zone: dict, field: dict) -> None:
    [created] = post_records(logged_in_client, zone["id"], rec()).json()
    response = logged_in_client.patch(f"{records_url(zone['id'])}/{created['id']}", json=field)
    assert response.status_code == 400
    assert "Extra inputs are not permitted" in response.json()["detail"]


def test_update_unknown_record_is_404(logged_in_client: TestClient, zone: dict) -> None:
    response = logged_in_client.patch(f"{records_url(zone['id'])}/99999", json={"ttl": 60})
    assert response.status_code == 404
    assert response.json() == {"detail": "No record found with ID: 99999"}


# --- Delete ---------------------------------------------------------------------


def test_delete_a_record(logged_in_client: TestClient, zone: dict, db_session_factory) -> None:
    [created] = post_records(logged_in_client, zone["id"], rec()).json()
    response = logged_in_client.delete(f"{records_url(zone['id'])}/{created['id']}")
    assert response.status_code == 204
    assert count_rows(db_session_factory, DnsRecord, id=created["id"]) == 0
    # With only NS and SOA left, the zone can be deleted again.
    assert logged_in_client.delete(f"/api/zones/{zone['id']}").status_code == 204


@pytest.mark.parametrize(("type", "message"), [("SOA", SOA_REQUIRED_MESSAGE), ("NS", APEX_NS_REQUIRED_MESSAGE)])
def test_soa_and_apex_ns_cannot_be_deleted(logged_in_client: TestClient, zone: dict, type: str, message: str) -> None:
    record = find(zone["records"], "example.com.", type)
    response = logged_in_client.delete(f"{records_url(zone['id'])}/{record['id']}")
    assert response.status_code == 400
    assert response.json() == {"detail": message}


def test_subdomain_ns_can_be_deleted(logged_in_client: TestClient, zone: dict) -> None:
    [created] = post_records(logged_in_client, zone["id"], rec(name="dev.example.com", type="NS", values=["ns1.x.com"])).json()
    assert logged_in_client.delete(f"{records_url(zone['id'])}/{created['id']}").status_code == 204


def test_batch_delete(logged_in_client: TestClient, zone: dict, db_session_factory) -> None:
    created = post_records(logged_in_client, zone["id"], rec(name="a.example.com"), rec(name="b.example.com")).json()
    response = logged_in_client.post(
        f"{records_url(zone['id'])}/batch-delete", json={"ids": [r["id"] for r in created]}
    )
    assert response.status_code == 204
    assert count_rows(db_session_factory, DnsRecord, zone_id=zone["id"]) == 2


@pytest.mark.parametrize("extra", ["soa", "unknown"])
def test_batch_delete_is_all_or_nothing(
    logged_in_client: TestClient, zone: dict, db_session_factory, extra: str
) -> None:
    [created] = post_records(logged_in_client, zone["id"], rec()).json()
    extra_id = find(zone["records"], "example.com.", "SOA")["id"] if extra == "soa" else 99999
    response = logged_in_client.post(f"{records_url(zone['id'])}/batch-delete", json={"ids": [created["id"], extra_id]})
    assert response.status_code == (400 if extra == "soa" else 404)
    assert count_rows(db_session_factory, DnsRecord, id=created["id"]) == 1  # nothing was deleted


def test_batch_delete_rejects_repeated_ids(logged_in_client: TestClient, zone: dict) -> None:
    response = logged_in_client.post(f"{records_url(zone['id'])}/batch-delete", json={"ids": [1, 1]})
    assert response.status_code == 400
    assert response.json() == {"detail": "ids: the same record is listed more than once"}


# --- Ownership and auth ---------------------------------------------------------


def test_record_of_another_zone_is_404(logged_in_client: TestClient, zone: dict) -> None:
    other_zone = create(logged_in_client, "other.com")
    other_ns = find(other_zone["records"], "other.com.", "NS")
    response = logged_in_client.patch(f"{records_url(zone['id'])}/{other_ns['id']}", json={"ttl": 1})
    assert response.status_code == 404


@pytest.fixture
def bobs_zone(db_session_factory: sessionmaker[Session], other_user: User) -> tuple[str, int]:
    """A zone owned by the other user, with one record: (zone id, record id)."""
    with db_session_factory() as db:
        record = DnsRecord(name="www.bob.example.", type="A", ttl=300, rdata=["192.0.2.1"])
        db.add(HostedZone(id="Z0BOBSZONE00000000000", user_id=other_user.id, name="bob.example.",
                          type="public", records=[record]))
        db.commit()
        return "Z0BOBSZONE00000000000", record.id


@pytest.mark.parametrize(
    ("method", "suffix", "body"),
    [
        ("GET", "", None),
        ("POST", "", {"records": [rec(name="x.bob.example")]}),
        ("PATCH", "/{rid}", {"ttl": 1}),
        ("DELETE", "/{rid}", None),
        ("POST", "/batch-delete", {"ids": ["{rid}"]}),
    ],
)
def test_other_users_records_are_404(
    logged_in_client: TestClient, bobs_zone: tuple[str, int], method: str, suffix: str, body: dict | None,
    db_session_factory: sessionmaker[Session],
) -> None:
    zone_id, record_id = bobs_zone
    if body and "ids" in body:
        body = {"ids": [record_id]}
    response = logged_in_client.request(method, records_url(zone_id) + suffix.format(rid=record_id), json=body)
    assert response.status_code == 404
    assert response.json() == {"detail": f"No hosted zone found with ID: {zone_id}"}
    assert count_rows(db_session_factory, DnsRecord, zone_id=zone_id) == 1


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/zones/Z0ANY/records"),
        ("POST", "/api/zones/Z0ANY/records"),
        ("PATCH", "/api/zones/Z0ANY/records/1"),
        ("DELETE", "/api/zones/Z0ANY/records/1"),
        ("POST", "/api/zones/Z0ANY/records/batch-delete"),
    ],
)
def test_record_endpoints_require_a_session(client: TestClient, method: str, path: str) -> None:
    response = client.request(method, path, json={})
    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}
