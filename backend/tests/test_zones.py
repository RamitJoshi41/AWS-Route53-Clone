import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

import mock_vpcs
from models import DnsRecord, HostedZone, HostedZoneVpc, User
from services.zones import (
    NOT_EMPTY_MESSAGE,
    PRIVATE_NAME_SERVERS,
    generate_name_servers,
    generate_zone_id,
    name_server_host,
)
from tests.conftest import OTHER_PASSWORD, OTHER_USERNAME

ZONE_ID = re.compile(r"Z0[A-Z0-9]{19}")
NS_HOST = re.compile(r"ns-(\d+)\.awsdns-(\d\d)\.(com|net|org|co\.uk)\.")
MUMBAI_VPC = {"region": "ap-south-1", "vpc_id": mock_vpcs.default_vpc_id("ap-south-1")}


def create(client: TestClient, name: str = "example.com", **fields) -> dict:
    response = client.post("/api/zones", json={"name": name, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def count_rows(db_session_factory: sessionmaker[Session], model, **filters) -> int:
    with db_session_factory() as db:
        stmt = select(func.count()).select_from(model).filter_by(**filters)
        return db.scalar(stmt)


# --- Name servers and IDs (unit) ------------------------------------------------


def test_zone_id_looks_like_route53() -> None:
    ids = {generate_zone_id() for _ in range(200)}
    assert len(ids) == 200
    assert all(ZONE_ID.fullmatch(zone_id) for zone_id in ids)


@pytest.mark.parametrize(
    ("number", "host"),
    [  # real name servers seen in the Route 53 console
        (71, "ns-71.awsdns-08.com."),
        (1016, "ns-1016.awsdns-63.net."),
        (1082, "ns-1082.awsdns-07.org."),
        (1614, "ns-1614.awsdns-09.co.uk."),
        (0, "ns-0.awsdns-00.com."),
        (2047, "ns-2047.awsdns-63.co.uk."),
    ],
)
def test_name_server_host_matches_route53_numbering(number: int, host: str) -> None:
    assert name_server_host(number) == host


def test_public_name_servers_are_one_per_tld() -> None:
    for _ in range(50):
        hosts = generate_name_servers(private=False)
        assert len(hosts) == 4
        tlds = []
        for host in hosts:
            match = NS_HOST.fullmatch(host)
            assert match, host
            number, group, tld = int(match[1]), int(match[2]), match[3]
            assert ("com", "net", "org", "co.uk")[number // 512] == tld
            assert group == (number % 512) // 8
            tlds.append(tld)
        assert sorted(tlds) == ["co.uk", "com", "net", "org"]


def test_private_name_servers_are_the_fixed_set() -> None:
    assert generate_name_servers(private=True) == list(PRIVATE_NAME_SERVERS)


# --- Create ---------------------------------------------------------------------


def test_create_public_zone_with_default_ns_and_soa(logged_in_client: TestClient) -> None:
    zone = create(logged_in_client, "Example.COM", description="Main site")

    assert ZONE_ID.fullmatch(zone["id"])
    assert zone["name"] == "example.com."
    assert zone["type"] == "public"
    assert zone["description"] == "Main site"
    assert zone["vpcs"] == []
    assert zone["record_count"] == 2

    ns, soa = zone["records"]
    assert (ns["name"], ns["type"], ns["ttl"]) == ("example.com.", "NS", 172800)
    assert len(ns["values"]) == 4 and all(NS_HOST.fullmatch(v) for v in ns["values"])
    assert (soa["name"], soa["type"], soa["ttl"]) == ("example.com.", "SOA", 900)
    assert soa["values"] == [
        f"{ns['values'][0]} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
    ]
    assert zone["name_servers"] == ns["values"]


def test_create_private_zone_with_vpcs(logged_in_client: TestClient) -> None:
    frankfurt = {"region": "eu-central-1", "vpc_id": mock_vpcs.default_vpc_id("eu-central-1")}
    zone = create(logged_in_client, "internal.example", type="private", vpcs=[MUMBAI_VPC, frankfurt])

    assert zone["type"] == "private"
    assert zone["vpcs"] == [MUMBAI_VPC, frankfurt]
    assert zone["name_servers"] == list(PRIVATE_NAME_SERVERS)


def test_blank_description_is_stored_as_null(logged_in_client: TestClient) -> None:
    assert create(logged_in_client, description="   ")["description"] is None


@pytest.mark.parametrize(
    ("body", "detail_part"),
    [
        ({"type": "private"}, "vpcs: a private hosted zone must be associated with at least one VPC"),
        ({"type": "public", "vpcs": [MUMBAI_VPC]}, "vpcs: a public hosted zone can't be associated"),
        ({"type": "private", "vpcs": [MUMBAI_VPC, MUMBAI_VPC]}, "listed more than once"),
        ({"type": "private", "vpcs": [{"region": "ap-south-1", "vpc_id": "vpc-123"}]},
         "The VPC ID is invalid."),
        ({"type": "private", "vpcs": [{"region": "eu-west-1", "vpc_id": MUMBAI_VPC["vpc_id"]}]},
         "The VPC ID is invalid."),  # a real VPC, but in another Region
        ({"type": "secret"}, "type: Input should be 'public' or 'private'"),
        ({"description": "x" * 257}, "description: String should have at most 256 characters"),
        ({"caller_reference": "abc"}, "caller_reference: Extra inputs are not permitted"),
    ],
)
def test_create_rejects_invalid_bodies(logged_in_client: TestClient, body: dict, detail_part: str) -> None:
    response = logged_in_client.post("/api/zones", json={"name": "example.com", **body})
    assert response.status_code == 400
    assert detail_part in response.json()["detail"]


# Edge case: invalid names -> 400, message passed through without a field prefix.
@pytest.mark.parametrize(
    ("name", "detail"),
    [
        ("a..b", "DomainLabelEmpty (Domain label is empty) encountered with 'a..b'"),
        ("", "Domain name is empty."),
        ("localhost", "Domain name 'localhost' must have at least two labels, such as example.com."),
        ("-x.com", "Domain label '-x' is invalid. Use only a-z, 0-9 and hyphens, "
                   "and don't start or end a label with a hyphen."),
        ("é.com", "Domain name 'é.com' contains non-ASCII characters. "
                  "Enter internationalized names in Punycode (xn--...)."),
        ("a" * 64 + ".com", f"Domain label '{'a' * 64}' is longer than 63 characters."),
    ],
)
def test_create_rejects_invalid_names(logged_in_client: TestClient, name: str, detail: str) -> None:
    response = logged_in_client.post("/api/zones", json={"name": name})
    assert response.status_code == 400
    assert response.json() == {"detail": detail}


# Edge case: duplicate names, in any spelling, -> 409.
@pytest.mark.parametrize("duplicate", ["example.com", "EXAMPLE.com", "example.com.", "  example.com "])
def test_duplicate_name_is_rejected(
    logged_in_client: TestClient, db_session_factory: sessionmaker[Session], duplicate: str
) -> None:
    create(logged_in_client, "example.com")
    response = logged_in_client.post("/api/zones", json={"name": duplicate})
    assert response.status_code == 409
    assert response.json() == {"detail": "A hosted zone named example.com already exists."}
    assert count_rows(db_session_factory, HostedZone) == 1


def test_other_user_may_use_the_same_name(logged_in_client: TestClient, other_user: User) -> None:
    first = create(logged_in_client, "example.com")
    logged_in_client.post("/api/auth/logout")
    login = logged_in_client.post(
        "/api/auth/login", json={"username": OTHER_USERNAME, "password": OTHER_PASSWORD}
    )
    assert login.status_code == 200

    second = create(logged_in_client, "example.com")
    assert second["id"] != first["id"]
    assert [z["id"] for z in logged_in_client.get("/api/zones").json()] == [second["id"]]


# --- Read -----------------------------------------------------------------------


def test_list_zones_sorted_by_name_with_record_counts(logged_in_client: TestClient) -> None:
    assert logged_in_client.get("/api/zones").json() == []
    create(logged_in_client, "zeta.example")
    create(logged_in_client, "alpha.example", type="private", vpcs=[MUMBAI_VPC])

    zones = logged_in_client.get("/api/zones").json()
    assert [z["name"] for z in zones] == ["alpha.example.", "zeta.example."]
    assert [z["record_count"] for z in zones] == [2, 2]
    assert zones[0]["vpcs"] == [MUMBAI_VPC]
    assert "records" not in zones[0]  # the list is the light shape


def test_get_zone_returns_details(logged_in_client: TestClient) -> None:
    created = create(logged_in_client)
    response = logged_in_client.get(f"/api/zones/{created['id']}")
    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_zone_is_404(logged_in_client: TestClient) -> None:
    response = logged_in_client.get("/api/zones/Z0DOESNOTEXIST0000000")
    assert response.status_code == 404
    assert response.json() == {"detail": "No hosted zone found with ID: Z0DOESNOTEXIST0000000"}


# --- Update ---------------------------------------------------------------------


def test_patch_changes_only_the_description(logged_in_client: TestClient) -> None:
    created = create(logged_in_client, description="old")
    response = logged_in_client.patch(f"/api/zones/{created['id']}", json={"description": "new"})
    assert response.status_code == 200
    updated = response.json()
    assert updated["description"] == "new"
    assert updated["updated_at"] > created["updated_at"]
    assert (updated["name"], updated["type"], updated["records"]) == (
        created["name"], created["type"], created["records"]
    )


def test_patch_with_empty_body_changes_nothing(logged_in_client: TestClient) -> None:
    created = create(logged_in_client, description="keep")
    response = logged_in_client.patch(f"/api/zones/{created['id']}", json={})
    assert response.json()["description"] == "keep"


def test_patch_can_clear_the_description(logged_in_client: TestClient) -> None:
    created = create(logged_in_client, description="old")
    response = logged_in_client.patch(f"/api/zones/{created['id']}", json={"description": ""})
    assert response.json()["description"] is None


@pytest.mark.parametrize("field", ["name", "type"])
def test_patch_rejects_immutable_fields(logged_in_client: TestClient, field: str) -> None:
    created = create(logged_in_client)
    response = logged_in_client.patch(f"/api/zones/{created['id']}", json={field: "x"})
    assert response.status_code == 400
    assert response.json() == {"detail": f"{field}: Extra inputs are not permitted"}


# A second VPC from the mock catalog, in another Region.
VIRGINIA_VPC = {"region": "us-east-1", "vpc_id": mock_vpcs.default_vpc_id("us-east-1")}


def create_private(client: TestClient, *vpcs: dict) -> dict:
    return create(client, "private.example", type="private", vpcs=list(vpcs or [MUMBAI_VPC]))


def test_patch_replaces_a_private_zones_vpcs(
    logged_in_client: TestClient, db_session_factory: sessionmaker[Session]
) -> None:
    created = create_private(logged_in_client, MUMBAI_VPC)
    response = logged_in_client.patch(f"/api/zones/{created['id']}", json={"vpcs": [VIRGINIA_VPC]})
    assert response.status_code == 200, response.text
    assert response.json()["vpcs"] == [VIRGINIA_VPC]
    assert count_rows(db_session_factory, HostedZoneVpc, zone_id=created["id"]) == 1


# Edge case: a VPC that stays must not trip UNIQUE(zone_id, vpc_id).
def test_patch_can_keep_a_vpc_and_add_another(logged_in_client: TestClient) -> None:
    created = create_private(logged_in_client, MUMBAI_VPC)
    body = {"vpcs": [MUMBAI_VPC, VIRGINIA_VPC]}
    response = logged_in_client.patch(f"/api/zones/{created['id']}", json=body)
    assert response.status_code == 200, response.text
    assert response.json()["vpcs"] == [MUMBAI_VPC, VIRGINIA_VPC]


def test_patch_without_vpcs_keeps_them(logged_in_client: TestClient) -> None:
    created = create_private(logged_in_client, MUMBAI_VPC, VIRGINIA_VPC)
    response = logged_in_client.patch(f"/api/zones/{created['id']}", json={"description": "x"})
    assert response.json()["vpcs"] == [MUMBAI_VPC, VIRGINIA_VPC]


@pytest.mark.parametrize(
    ("private", "vpcs", "detail"),
    [
        (False, [MUMBAI_VPC], "vpcs: a public hosted zone can't be associated with VPCs"),
        (True, [], "vpcs: a private hosted zone must be associated with at least one VPC"),
        (True, [{"region": "us-east-1", "vpc_id": "vpc-0000000000000000"}], "The VPC ID is invalid."),
        # A real VPC, but not in the Region it's listed under.
        (True, [{**MUMBAI_VPC, "region": "us-east-1"}], "The VPC ID is invalid."),
        (True, [MUMBAI_VPC, MUMBAI_VPC], "vpcs: the same VPC is listed more than once"),
    ],
)
def test_patch_rejects_invalid_vpcs(
    logged_in_client: TestClient, private: bool, vpcs: list[dict], detail: str
) -> None:
    created = create_private(logged_in_client) if private else create(logged_in_client)
    response = logged_in_client.patch(f"/api/zones/{created['id']}", json={"vpcs": vpcs})
    assert response.status_code == 400
    assert response.json() == {"detail": detail}
    # Nothing changed.
    assert logged_in_client.get(f"/api/zones/{created['id']}").json()["vpcs"] == created["vpcs"]


# --- Delete ---------------------------------------------------------------------


# Edge case: deleting a zone removes its NS/SOA records (database cascade).
def test_delete_zone_removes_it_and_its_records(
    logged_in_client: TestClient, db_session_factory: sessionmaker[Session]
) -> None:
    zone = create(logged_in_client, "private.example", type="private", vpcs=[MUMBAI_VPC])
    assert count_rows(db_session_factory, DnsRecord, zone_id=zone["id"]) == 2

    response = logged_in_client.delete(f"/api/zones/{zone['id']}")
    assert response.status_code == 204
    assert response.content == b""
    assert logged_in_client.get(f"/api/zones/{zone['id']}").status_code == 404
    assert count_rows(db_session_factory, DnsRecord, zone_id=zone["id"]) == 0
    assert count_rows(db_session_factory, HostedZoneVpc, zone_id=zone["id"]) == 0


def test_delete_is_blocked_while_other_records_exist(
    logged_in_client: TestClient, db_session_factory: sessionmaker[Session]
) -> None:
    zone = create(logged_in_client)
    record = {"name": "www.example.com", "type": "A", "ttl": 300, "values": ["192.0.2.1"]}
    assert logged_in_client.post(f"/api/zones/{zone['id']}/records", json={"records": [record]}).status_code == 201

    response = logged_in_client.delete(f"/api/zones/{zone['id']}")
    assert response.status_code == 409
    assert response.json() == {"detail": NOT_EMPTY_MESSAGE}
    assert count_rows(db_session_factory, DnsRecord, zone_id=zone["id"]) == 3


# --- Ownership and auth ---------------------------------------------------------


@pytest.fixture
def bobs_zone_id(db_session_factory: sessionmaker[Session], other_user: User) -> str:
    """A zone owned by the other user, inserted directly."""
    with db_session_factory() as db:
        db.add(HostedZone(id="Z0BOBSZONE00000000000", user_id=other_user.id, name="bob.example.", type="public"))
        db.commit()
    return "Z0BOBSZONE00000000000"


# Edge case: another user's zone behaves exactly like a missing one.
@pytest.mark.parametrize(
    ("method", "body"), [("GET", None), ("PATCH", {"description": "mine now"}), ("DELETE", None)]
)
def test_other_users_zone_is_404(
    logged_in_client: TestClient, bobs_zone_id: str, method: str, body: dict | None,
    db_session_factory: sessionmaker[Session],
) -> None:
    response = logged_in_client.request(method, f"/api/zones/{bobs_zone_id}", json=body)
    assert response.status_code == 404
    assert response.json() == {"detail": f"No hosted zone found with ID: {bobs_zone_id}"}
    assert logged_in_client.get("/api/zones").json() == []
    assert count_rows(db_session_factory, HostedZone, id=bobs_zone_id) == 1


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/zones"),
        ("POST", "/api/zones"),
        ("GET", "/api/zones/Z0ANY"),
        ("PATCH", "/api/zones/Z0ANY"),
        ("DELETE", "/api/zones/Z0ANY"),
        ("GET", "/api/vpcs"),
    ],
)
def test_endpoints_require_a_session(client: TestClient, method: str, path: str) -> None:
    response = client.request(method, path, json={"name": "example.com"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


# --- VPC catalog ----------------------------------------------------------------


def test_vpc_catalog_lists_regions_and_their_vpcs(logged_in_client: TestClient) -> None:
    catalog = logged_in_client.get("/api/vpcs").json()
    codes = [region["code"] for region in catalog["regions"]]
    assert len(codes) == 35 and codes == sorted(codes)
    assert {"code": "ap-south-1", "name": "Asia Pacific (Mumbai)"} in catalog["regions"]
    assert MUMBAI_VPC in catalog["vpcs"]
    assert all(re.fullmatch(r"vpc-[0-9a-f]{17}", vpc["vpc_id"]) for vpc in catalog["vpcs"])
