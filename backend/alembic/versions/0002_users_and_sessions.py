"""users and sessions tables, plus the default admin user

Creates the auth tables and seeds one login (admin / password123) so a fresh
database is usable right after `alembic upgrade head`.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-09 12:00:00.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union

import bcrypt
import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, Sequence[str], None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "password123"


def upgrade() -> None:
    """Upgrade schema."""
    users = op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=150), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
        sa.UniqueConstraint('username', name=op.f('uq_users_username')),
    )

    op.create_table(
        'sessions',
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'], ['users.id'],
            name=op.f('fk_sessions_user_id_users'), ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('token_hash', name=op.f('pk_sessions')),
    )
    op.create_index(op.f('ix_sessions_user_id'), 'sessions', ['user_id'])
    op.create_index(op.f('ix_sessions_expires_at'), 'sessions', ['expires_at'])

    # Seed data. bcrypt is called directly rather than importing the app's security
    # module: a migration must keep producing the same result even if app code changes.
    password_hash = bcrypt.hashpw(DEFAULT_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("ascii")
    op.bulk_insert(users, [{
        'username': DEFAULT_USERNAME,
        'password_hash': password_hash,
        'created_at': datetime.now(timezone.utc).replace(tzinfo=None),
    }])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_sessions_expires_at'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_user_id'), table_name='sessions')
    op.drop_table('sessions')
    op.drop_table('users')
