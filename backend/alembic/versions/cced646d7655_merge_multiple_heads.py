"""merge multiple heads

Revision ID: cced646d7655
Revises: 8fa42cd5a485, d5f8aa07f3b0
Create Date: 2026-04-25 14:28:33.150382

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cced646d7655'
down_revision: Union[str, Sequence[str], None] = ('8fa42cd5a485', 'd5f8aa07f3b0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
