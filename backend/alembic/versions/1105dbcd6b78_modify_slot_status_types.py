"""Modify slot status types

Revision ID: 1105dbcd6b78
Revises: 16bf872410ae
Create Date: 2026-04-26 12:29:35.888248

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1105dbcd6b78'
down_revision: Union[str, Sequence[str], None] = '16bf872410ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE slotstatus RENAME VALUE 'BOOKED' TO 'FULL'")


def downgrade() -> None:
    op.execute("ALTER TYPE slotstatus RENAME VALUE 'FULL' TO 'BOOKED'")
