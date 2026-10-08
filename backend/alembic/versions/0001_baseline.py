"""baseline

Empty starting point for the migration history. Applying it creates route53.db
(plus Alembic's alembic_version table). Feature tables arrive in later revisions.

Revision ID: 0001
Revises: 
Create Date: 2026-10-08 22:54:13.453623

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
