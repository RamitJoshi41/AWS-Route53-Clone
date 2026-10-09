"""Mocked VPC catalog for private hosted zones.

The clone has no real AWS account, so it can't list real VPCs. Instead every
region has one "default VPC", as new AWS accounts do. Its ID is derived from the
region code, so it's the same on every run and needs no storage.
"""

import hashlib

# The regions offered by the console's Region dropdown, in the same order (sorted by code).
REGIONS: tuple[tuple[str, str], ...] = (
    ("af-south-1", "Africa (Cape Town)"),
    ("ap-east-1", "Asia Pacific (Hong Kong)"),
    ("ap-east-2", "Asia Pacific (Taipei)"),
    ("ap-northeast-1", "Asia Pacific (Tokyo)"),
    ("ap-northeast-2", "Asia Pacific (Seoul)"),
    ("ap-northeast-3", "Asia Pacific (Osaka)"),
    ("ap-south-1", "Asia Pacific (Mumbai)"),
    ("ap-south-2", "Asia Pacific (Hyderabad)"),
    ("ap-southeast-1", "Asia Pacific (Singapore)"),
    ("ap-southeast-2", "Asia Pacific (Sydney)"),
    ("ap-southeast-3", "Asia Pacific (Jakarta)"),
    ("ap-southeast-4", "Asia Pacific (Melbourne)"),
    ("ap-southeast-5", "Asia Pacific (Malaysia)"),
    ("ap-southeast-6", "Asia Pacific (New Zealand)"),
    ("ap-southeast-7", "Asia Pacific (Thailand)"),
    ("ca-central-1", "Canada (Central)"),
    ("ca-west-1", "Canada West (Calgary)"),
    ("eu-central-1", "Europe (Frankfurt)"),
    ("eu-central-2", "Europe (Zurich)"),
    ("eu-north-1", "Europe (Stockholm)"),
    ("eu-south-1", "Europe (Milan)"),
    ("eu-south-2", "Europe (Spain)"),
    ("eu-west-1", "Europe (Ireland)"),
    ("eu-west-2", "Europe (London)"),
    ("eu-west-3", "Europe (Paris)"),
    ("eusc-de-east-1", "AWS European Sovereign Cloud (Germany)"),
    ("il-central-1", "Israel (Tel Aviv)"),
    ("me-central-1", "Middle East (UAE)"),
    ("me-south-1", "Middle East (Bahrain)"),
    ("mx-central-1", "Mexico (Central)"),
    ("sa-east-1", "South America (São Paulo)"),
    ("us-east-1", "US East (N. Virginia)"),
    ("us-east-2", "US East (Ohio)"),
    ("us-west-1", "US West (N. California)"),
    ("us-west-2", "US West (Oregon)"),
)


def default_vpc_id(region: str) -> str:
    """A stable, realistic-looking VPC ID ("vpc-" + 17 hex digits) for `region`."""
    return "vpc-" + hashlib.sha256(region.encode("ascii")).hexdigest()[:17]


# (region, vpc_id) pairs that exist in the mocked account.
VPCS: tuple[tuple[str, str], ...] = tuple((code, default_vpc_id(code)) for code, _ in REGIONS)
_VPC_SET = frozenset(VPCS)


def vpc_exists(region: str, vpc_id: str) -> bool:
    return (region, vpc_id) in _VPC_SET
