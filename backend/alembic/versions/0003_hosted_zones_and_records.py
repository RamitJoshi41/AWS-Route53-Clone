"""hosted_zones, hosted_zone_vpcs and records tables

Hosted zones belong to a user. A private zone is associated with one or more
VPCs (hosted_zone_vpcs). Every zone holds DNS record sets (records), starting
with the NS and SOA records created alongside it. Deleting a user or a zone
cascades to its children at the database level (ON DELETE CASCADE).

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-09 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Copied here rather than imported from models.py: a migration must keep
# producing the same schema even if the app's lists change later (a later
# change gets its own migration).
ZONE_TYPES = ("public", "private")
RECORD_TYPES = ("A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SOA", "SRV", "TXT")


def _in_list(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'hosted_zones',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=10), nullable=False),
        sa.Column('description', sa.String(length=256), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint(_in_list('type', ZONE_TYPES), name=op.f('ck_hosted_zones_type')),
        sa.ForeignKeyConstraint(
            ['user_id'], ['users.id'],
            name=op.f('fk_hosted_zones_user_id_users'), ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_hosted_zones')),
        # Also the index for "zones of user X" (user_id is its leftmost column).
        sa.UniqueConstraint('user_id', 'name', name='uq_hosted_zones_user_id_name'),
    )

    op.create_table(
        'hosted_zone_vpcs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('zone_id', sa.String(length=32), nullable=False),
        sa.Column('region', sa.String(length=32), nullable=False),
        sa.Column('vpc_id', sa.String(length=32), nullable=False),
        sa.ForeignKeyConstraint(
            ['zone_id'], ['hosted_zones.id'],
            name=op.f('fk_hosted_zone_vpcs_zone_id_hosted_zones'), ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_hosted_zone_vpcs')),
        # Also the index for "VPCs of zone X".
        sa.UniqueConstraint('zone_id', 'vpc_id', name='uq_hosted_zone_vpcs_zone_id_vpc_id'),
    )

    op.create_table(
        'records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('zone_id', sa.String(length=32), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=10), nullable=False),
        sa.Column('ttl', sa.Integer(), nullable=False),
        sa.Column('rdata', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint(_in_list('type', RECORD_TYPES), name=op.f('ck_records_type')),
        sa.CheckConstraint('ttl >= 0', name=op.f('ck_records_ttl_non_negative')),
        sa.ForeignKeyConstraint(
            ['zone_id'], ['hosted_zones.id'],
            name=op.f('fk_records_zone_id_hosted_zones'), ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_records')),
    )
    op.create_index(op.f('ix_records_zone_id'), 'records', ['zone_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Children before parents, so no foreign key ever points at a missing table.
    op.drop_index(op.f('ix_records_zone_id'), table_name='records')
    op.drop_table('records')
    op.drop_table('hosted_zone_vpcs')
    op.drop_table('hosted_zones')
