"""one record set per name and type: UNIQUE(zone_id, name, type) on records

With simple routing, Route 53 allows one record set per name and type in a zone.
The new unique index also covers lookups by zone_id (its leftmost column), so
the separate ix_records_zone_id index is dropped.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-09 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Batch mode: SQLite can't add a constraint to an existing table, so Alembic
    # rebuilds the table (copy, drop, rename) with the constraint in place.
    with op.batch_alter_table('records') as batch_op:
        batch_op.drop_index('ix_records_zone_id')
        batch_op.create_unique_constraint(
            'uq_records_zone_id_name_type', ['zone_id', 'name', 'type']
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('records') as batch_op:
        batch_op.drop_constraint('uq_records_zone_id_name_type', type_='unique')
        batch_op.create_index('ix_records_zone_id', ['zone_id'])
