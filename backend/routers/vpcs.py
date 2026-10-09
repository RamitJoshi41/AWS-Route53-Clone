"""The mocked VPC catalog used by the "VPCs to associate" section of private zones."""

from fastapi import APIRouter, Depends

import mock_vpcs
from dependencies import get_current_user
from schemas import RegionOut, VpcCatalogOut, VpcOut

router = APIRouter(prefix="/vpcs", tags=["vpcs"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=VpcCatalogOut)
def list_vpcs() -> VpcCatalogOut:
    return VpcCatalogOut(
        regions=[RegionOut(code=code, name=name) for code, name in mock_vpcs.REGIONS],
        vpcs=[VpcOut(region=region, vpc_id=vpc_id) for region, vpc_id in mock_vpcs.VPCS],
    )
