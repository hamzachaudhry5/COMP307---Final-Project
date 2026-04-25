"""fix foreign key violations, implemented delete on cascade

Revision ID: d5f8aa07f3b0
Revises: 8fa42cd5a485
Create Date: 2026-04-25 13:31:41.961144

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5f8aa07f3b0'
down_revision: Union[str, Sequence[str], None] = 'abbe73942ed6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Using raw SQL for drops to use 'IF EXISTS' for robustness
    
    # 1. booking_slots -> group_meetings
    op.execute(sa.text("ALTER TABLE booking_slots DROP CONSTRAINT IF EXISTS fk_booking_slots_group_meeting_id_group_meetings"))
    op.create_foreign_key('fk_booking_slots_group_meeting_id_group_meetings', 'booking_slots', 'group_meetings', ['group_meeting_id'], ['id'], ondelete='SET NULL')
    
    # 2. group_availability_options -> group_meetings
    op.execute(sa.text("ALTER TABLE group_availability_options DROP CONSTRAINT IF EXISTS group_availability_options_meeting_id_fkey"))
    op.create_foreign_key('group_availability_options_meeting_id_fkey', 'group_availability_options', 'group_meetings', ['meeting_id'], ['id'], ondelete='CASCADE')
    
    # 3. group_meeting_invites -> group_meetings
    op.execute(sa.text("ALTER TABLE group_meeting_invites DROP CONSTRAINT IF EXISTS group_meeting_invites_meeting_id_fkey"))
    op.create_foreign_key('group_meeting_invites_meeting_id_fkey', 'group_meeting_invites', 'group_meetings', ['meeting_id'], ['id'], ondelete='CASCADE')
    
    # 4. group_meetings -> booking_slots
    op.execute(sa.text("ALTER TABLE group_meetings DROP CONSTRAINT IF EXISTS group_meetings_finalized_slot_id_fkey"))
    op.execute(sa.text("ALTER TABLE group_meetings DROP CONSTRAINT IF EXISTS fk_group_meetings_finalized_slot_id"))
    op.create_foreign_key('fk_group_meetings_finalized_slot_id', 'group_meetings', 'booking_slots', ['finalized_slot_id'], ['id'], ondelete='SET NULL')
    
    # 5. group_votes -> meeting_id / option_id
    op.execute(sa.text("ALTER TABLE group_votes DROP CONSTRAINT IF EXISTS group_votes_option_id_fkey"))
    op.execute(sa.text("ALTER TABLE group_votes DROP CONSTRAINT IF EXISTS group_votes_meeting_id_fkey"))
    op.create_foreign_key('group_votes_meeting_id_fkey', 'group_votes', 'group_meetings', ['meeting_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('group_votes_option_id_fkey', 'group_votes', 'group_availability_options', ['option_id'], ['id'], ondelete='CASCADE')
    
    # 6. meeting_requests -> booking_slots
    op.execute(sa.text("ALTER TABLE meeting_requests DROP CONSTRAINT IF EXISTS meeting_requests_booking_slot_id_fkey"))
    op.create_foreign_key('meeting_requests_booking_slot_id_fkey', 'meeting_requests', 'booking_slots', ['booking_slot_id'], ['id'], ondelete='CASCADE')
    
    # 7. reservations -> booking_slots
    op.execute(sa.text("ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_slot_id_fkey"))
    op.create_foreign_key('reservations_slot_id_fkey', 'reservations', 'booking_slots', ['slot_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    """Downgrade schema."""
    # 1. reservations
    op.execute(sa.text("ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_slot_id_fkey"))
    op.create_foreign_key('reservations_slot_id_fkey', 'reservations', 'booking_slots', ['slot_id'], ['id'])
    
    # 2. meeting_requests
    op.execute(sa.text("ALTER TABLE meeting_requests DROP CONSTRAINT IF EXISTS meeting_requests_booking_slot_id_fkey"))
    op.create_foreign_key('meeting_requests_booking_slot_id_fkey', 'meeting_requests', 'booking_slots', ['booking_slot_id'], ['id'])
    
    # 3. group_votes
    op.execute(sa.text("ALTER TABLE group_votes DROP CONSTRAINT IF EXISTS group_votes_meeting_id_fkey"))
    op.execute(sa.text("ALTER TABLE group_votes DROP CONSTRAINT IF EXISTS group_votes_option_id_fkey"))
    op.create_foreign_key('group_votes_meeting_id_fkey', 'group_votes', 'group_meetings', ['meeting_id'], ['id'])
    op.create_foreign_key('group_votes_option_id_fkey', 'group_votes', 'group_availability_options', ['option_id'], ['id'])
    
    # 4. group_meetings
    op.execute(sa.text("ALTER TABLE group_meetings DROP CONSTRAINT IF EXISTS fk_group_meetings_finalized_slot_id"))
    op.execute(sa.text("ALTER TABLE group_meetings DROP CONSTRAINT IF EXISTS group_meetings_finalized_slot_id_fkey"))
    op.create_foreign_key('group_meetings_finalized_slot_id_fkey', 'group_meetings', 'booking_slots', ['finalized_slot_id'], ['id'])
    
    # 5. group_meeting_invites
    op.execute(sa.text("ALTER TABLE group_meeting_invites DROP CONSTRAINT IF EXISTS group_meeting_invites_meeting_id_fkey"))
    op.create_foreign_key('group_meeting_invites_meeting_id_fkey', 'group_meeting_invites', 'group_meetings', ['meeting_id'], ['id'])
    
    # 6. group_availability_options
    op.execute(sa.text("ALTER TABLE group_availability_options DROP CONSTRAINT IF EXISTS group_availability_options_meeting_id_fkey"))
    op.create_foreign_key('group_availability_options_meeting_id_fkey', 'group_availability_options', 'group_meetings', ['meeting_id'], ['id'])
    
    # 7. booking_slots
    op.execute(sa.text("ALTER TABLE booking_slots DROP CONSTRAINT IF EXISTS fk_booking_slots_group_meeting_id_group_meetings"))
    op.create_foreign_key('fk_booking_slots_group_meeting_id_group_meetings', 'booking_slots', 'group_meetings', ['group_meeting_id'], ['id'])
