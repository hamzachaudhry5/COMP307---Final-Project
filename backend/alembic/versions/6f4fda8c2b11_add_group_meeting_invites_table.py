"""add group meeting invites table

Revision ID: 6f4fda8c2b11
Revises: d3624a3d5ca4
Create Date: 2026-04-21 22:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6f4fda8c2b11"
down_revision: Union[str, Sequence[str], None] = "d3624a3d5ca4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "group_meeting_invites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("meeting_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["meeting_id"], ["group_meetings.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.user_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_unique_constraint(
        "uq_group_meeting_invites_meeting_user",
        "group_meeting_invites",
        ["meeting_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_group_meeting_invites_meeting_user",
        "group_meeting_invites",
        type_="unique",
    )
    op.drop_table("group_meeting_invites")
