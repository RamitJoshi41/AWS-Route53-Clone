"""Pydantic request/response models (the API's JSON contract, separate from the ORM)."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from models import DnsRecord, HostedZone
from record_values import MAX_INT32
from security import BCRYPT_MAX_PASSWORD_BYTES


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, password: str) -> str:
        # Measured in UTF-8 bytes, not characters: bcrypt's limit is 72 bytes.
        if len(password.encode("utf-8")) > BCRYPT_MAX_PASSWORD_BYTES:
            raise ValueError(f"must be at most {BCRYPT_MAX_PASSWORD_BYTES} bytes")
        return password


class UserOut(BaseModel):
    """Public view of a user; never includes the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str


# --- Hosted zones ---------------------------------------------------------------

ZoneType = Literal["public", "private"]
DESCRIPTION_MAX_LENGTH = 256  # the console's limit


def _blank_to_none(description: str | None) -> str | None:
    """An empty or whitespace-only description means "no description" (shown as "-")."""
    if description is None or not description.strip():
        return None
    return description


class VpcIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region: str = Field(min_length=1, max_length=32)
    vpc_id: str = Field(min_length=1, max_length=32)


class ZoneCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Validated and normalized by dns_names.normalize_zone_name in the service, so
    # the error reaches the user exactly as written there (no "name: " prefix).
    name: str = Field(max_length=1024)
    type: ZoneType = "public"
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    # validate_default: also run vpcs_match_type when "vpcs" is omitted, or a
    # private zone sent without the key would slip through with no VPC.
    vpcs: list[VpcIn] = Field(default_factory=list, validate_default=True)

    normalize_description = field_validator("description")(_blank_to_none)

    @field_validator("vpcs")
    @classmethod
    def vpcs_match_type(cls, vpcs: list[VpcIn], info: ValidationInfo) -> list[VpcIn]:
        # `type` is declared before `vpcs`, so it's already validated and available here.
        zone_type = info.data.get("type")
        if zone_type == "private" and not vpcs:
            raise ValueError("a private hosted zone must be associated with at least one VPC")
        if zone_type == "public" and vpcs:
            raise ValueError("a public hosted zone can't be associated with VPCs")
        return _no_duplicate_vpcs(vpcs)


def _no_duplicate_vpcs(vpcs: list[VpcIn] | None) -> list[VpcIn] | None:
    ids = [vpc.vpc_id for vpc in vpcs or []]
    if len(ids) != len(set(ids)):
        raise ValueError("the same VPC is listed more than once")
    return vpcs


class ZoneUpdate(BaseModel):
    """PATCH body: the description, and a private zone's VPCs. Route 53 doesn't
    allow renaming a zone or switching it between public and private.

    `vpcs` replaces the zone's whole VPC list; omitted, the VPCs stay as they are.
    Whether the zone is private is only known from the database, so that rule is
    checked in the service."""

    model_config = ConfigDict(extra="forbid")

    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    vpcs: list[VpcIn] | None = None

    normalize_description = field_validator("description")(_blank_to_none)
    check_vpcs = field_validator("vpcs")(_no_duplicate_vpcs)


class VpcOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    region: str
    vpc_id: str


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    ttl: int
    # Stored in the `rdata` column (see models.DnsRecord).
    values: list[str] = Field(validation_alias="rdata")


# --- Records --------------------------------------------------------------------

# The types a user can create: the console's list minus the ones the clone doesn't
# implement. SOA is missing on purpose: Route 53 creates it with the zone, and it
# can only be edited.
CreatableRecordType = Literal["A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SRV", "TXT"]
Ttl = Annotated[int, Field(ge=0, le=MAX_INT32)]
# 4000 characters: Route 53's limit for one value (a TXT record's strings together).
RecordValues = Annotated[list[Annotated[str, Field(max_length=4000)]], Field(min_length=1)]


class RecordCreate(BaseModel):
    """One record set to create. Values are checked per type by record_values.py,
    in the service, so their errors read like Route 53's."""

    model_config = ConfigDict(extra="forbid")

    # Fully qualified, as in the Route 53 API: "www.example.com" (trailing dot optional).
    name: str = Field(max_length=1024)
    type: CreatableRecordType
    ttl: Ttl
    values: RecordValues


class RecordBatchCreate(BaseModel):
    """POST body: the console's "Create records" sends every record on the form at once."""

    model_config = ConfigDict(extra="forbid")

    records: list[RecordCreate] = Field(min_length=1, max_length=100)


class RecordUpdate(BaseModel):
    """PATCH body. A record's name and type can't change (the console's edit panel
    shows them read-only), so only the TTL and the values can. Omitted fields stay."""

    model_config = ConfigDict(extra="forbid")

    ttl: Ttl | None = None
    values: RecordValues | None = None


class RecordIds(BaseModel):
    """Body of a bulk delete: the IDs of the selected records."""

    model_config = ConfigDict(extra="forbid")

    ids: list[int] = Field(min_length=1, max_length=1000)

    @field_validator("ids")
    @classmethod
    def no_duplicates(cls, ids: list[int]) -> list[int]:
        if len(ids) != len(set(ids)):
            raise ValueError("the same record is listed more than once")
        return ids


class ZoneOut(BaseModel):
    """A hosted zone as shown in the list."""

    id: str
    name: str
    type: ZoneType
    description: str | None
    record_count: int
    vpcs: list[VpcOut]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_zone(cls, zone: HostedZone, record_count: int) -> "ZoneOut":
        # record_count isn't a column (it's counted when read), so it's passed in.
        return cls(
            id=zone.id,
            name=zone.name,
            type=zone.type,
            description=zone.description,
            record_count=record_count,
            vpcs=[VpcOut.model_validate(vpc) for vpc in zone.vpcs],
            created_at=zone.created_at,
            updated_at=zone.updated_at,
        )


class ZoneDetailOut(ZoneOut):
    """A single hosted zone with its name servers and records (the details page)."""

    name_servers: list[str]
    records: list[RecordOut]

    @classmethod
    def from_zone_with_records(cls, zone: HostedZone) -> "ZoneDetailOut":
        records: list[DnsRecord] = zone.records
        apex_ns = next(
            (r for r in records if r.type == "NS" and r.name == zone.name), None
        )
        base = ZoneOut.from_zone(zone, record_count=len(records))
        return cls(
            **base.model_dump(),
            name_servers=list(apex_ns.rdata) if apex_ns else [],
            records=[RecordOut.model_validate(r) for r in records],
        )


class RegionOut(BaseModel):
    code: str  # "ap-south-1"
    name: str  # "Asia Pacific (Mumbai)"


class VpcCatalogOut(BaseModel):
    """Everything the create page's VPC section needs: the regions and the VPCs in each."""

    regions: list[RegionOut]
    vpcs: list[VpcOut]
