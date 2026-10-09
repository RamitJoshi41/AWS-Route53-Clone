"""changes table: the change batches behind the console's "View status"

Each record create or edit is one change, with a Route 53-style ID ("C0…") and
the time it was submitted. Its PENDING/INSYNC status is derived from that time
when read, so it isn't a column. Deleting a zone deletes its changes.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-09 22:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0005'
down_revision: Union[str, Sequence[str], None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'changes',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('zone_id', sa.String(length=32), nullable=False),
        sa.Column('submitted_at', sa.DateTime(), nullable=False),
        sa.Column('comment', sa.String(length=256), nullable=True),
        sa.ForeignKeyConstraint(
            ['zone_id'], ['hosted_zones.id'],
            name=op.f('fk_changes_zone_id_hosted_zones'), ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_changes')),
    )
    op.create_index(op.f('ix_changes_zone_id'), 'changes', ['zone_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_changes_zone_id'), table_name='changes')
    op.drop_table('changes')
