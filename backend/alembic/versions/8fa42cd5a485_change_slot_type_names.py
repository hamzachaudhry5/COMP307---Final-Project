"""Change slot type names

Revision ID: 8fa42cd5a485
Revises: abbe73942ed6
Create Date: 2026-04-25 13:20:15.809566

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8fa42cd5a485'
down_revision: Union[str, Sequence[str], None] = 'abbe73942ed6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE slottype RENAME VALUE 'REQUEST' TO 'GENERAL_SLOT'")


def downgrade() -> None:
    op.execute("ALTER TYPE slottype RENAME VALUE 'GENERAL_SLOT' TO 'REQUEST'")
