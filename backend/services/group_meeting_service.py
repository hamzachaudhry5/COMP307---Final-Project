# Sean Xu

from datetime import timedelta
from typing import List

from sqlmodel import Session, select

from exceptions import ResourceNotFoundError, ValidationFailedError, UnauthorizedError
from models.slots import BookingSlot, SlotStatus, SlotType
from models.group_meetings import (
    GroupAvailabilityOption,
    GroupMeetingInvite,
    GroupMeeting,
    GroupMeetingCreate,
    GroupVote,
    GroupVoteCreate,
)
from models.users import User
from models.reservations import Reservation
from models.mailto import MailtoResponse, build_mailto

def create_group_meeting(
    data: GroupMeetingCreate,
    session: Session,
    owner: User,
) -> GroupMeeting:
    if not data.options:
        raise ValidationFailedError("At least one time option is required")
    if not data.invited_user_ids:
        raise ValidationFailedError("At least one invited user is required")

    meeting = GroupMeeting(
        title=data.title,
        description=data.description,
        owner_id=owner.user_id,
    )
    session.add(meeting)
    session.flush()

    for option in data.options:
        if option.end_time <= option.start_time:
            raise ValidationFailedError("Each option's end_time must be after start_time")
        session.add(
            GroupAvailabilityOption(
                meeting_id=meeting.id,
                start_time=option.start_time,
                end_time=option.end_time,
            )
        )

    invited_users = session.exec(
        select(User).where(User.user_id.in_(data.invited_user_ids))
    ).all()
    invited_ids = {u.user_id for u in invited_users}
    missing_ids = sorted(set(data.invited_user_ids) - invited_ids)
    if missing_ids:
        raise ValidationFailedError(f"Invited users not found: {missing_ids}")
    if owner.user_id in invited_ids:
        raise ValidationFailedError("Owner cannot be in invited users list")

    for invited_user_id in invited_ids:
        session.add(GroupMeetingInvite(meeting_id=meeting.id, user_id=invited_user_id))

    session.commit()
    session.refresh(meeting)
    return meeting

def get_my_group_meetings(
    session: Session,
    owner: User,
) -> List[GroupMeeting]:
    return session.exec(
        select(GroupMeeting).where(GroupMeeting.owner_id == owner.user_id)
    ).all()

def get_my_invites(
    session: Session,
    user: User,
) -> List[GroupMeeting]:
    meeting_ids = session.exec(
        select(GroupMeetingInvite.meeting_id).where(GroupMeetingInvite.user_id == user.user_id)
    ).all()
    if not meeting_ids:
        return []
    
    return session.exec(
        select(GroupMeeting).where(GroupMeeting.id.in_(meeting_ids))
    ).all()

def get_group_meeting(
    meeting_id: int,
    session: Session,
) -> GroupMeeting:
    meeting = session.get(GroupMeeting, meeting_id)
    if not meeting:
        raise ResourceNotFoundError("Meeting not found")
    return meeting

def vote(
    meeting_id: int,
    data: GroupVoteCreate,
    session: Session,
    user: User,
) -> dict:
    meeting = session.get(GroupMeeting, meeting_id)
    if not meeting:
        raise ResourceNotFoundError("Meeting not found")
    if meeting.is_finalized:
        raise ValidationFailedError("Voting is closed, meeting is already finalized")

    invited_ids = set(
        session.exec(
            select(GroupMeetingInvite.user_id).where(
                GroupMeetingInvite.meeting_id == meeting_id
            )
        ).all()
    )
    if user.user_id not in invited_ids:
        raise UnauthorizedError("Only invited users can vote on this meeting")

    valid_options = {
        option.id: option
        for option in session.exec(
            select(GroupAvailabilityOption).where(
                GroupAvailabilityOption.meeting_id == meeting_id
            )
        ).all()
    }
    for option_id in data.option_ids:
        if option_id not in valid_options:
            raise ValidationFailedError(f"Option {option_id} does not belong to this meeting")

    old_votes = session.exec(
        select(GroupVote).where(
            GroupVote.meeting_id == meeting_id,
            GroupVote.user_id == user.user_id,
        )
    ).all()
    for v in old_votes:
        option = valid_options.get(v.option_id)
        if option:
            option.vote_count = max(0, option.vote_count - 1)
        session.delete(v)

    for option_id in data.option_ids:
        option = valid_options[option_id]
        option.vote_count += 1
        session.add(
            GroupVote(
                meeting_id=meeting_id,
                option_id=option_id,
                user_id=user.user_id,
            )
        )

    session.commit()
    return {"message": "Votes recorded successfully"}

def get_heatmap(
    meeting_id: int,
    session: Session,
    owner: User,
) -> List[GroupAvailabilityOption]:
    meeting = session.get(GroupMeeting, meeting_id)
    if not meeting or meeting.owner_id != owner.user_id:
        raise ResourceNotFoundError("Meeting not found")

    return session.exec(
        select(GroupAvailabilityOption)
        .where(GroupAvailabilityOption.meeting_id == meeting_id)
        .order_by(GroupAvailabilityOption.vote_count.desc())
    ).all()

def finalize_meeting(
    meeting_id: int,
    option_id: int,
    recurrence_weeks: int,
    session: Session,
    owner: User,
) -> MailtoResponse:
    meeting = session.get(GroupMeeting, meeting_id)
    if not meeting or meeting.owner_id != owner.user_id:
        raise ResourceNotFoundError("Meeting not found")
    if meeting.is_finalized:
        raise ValidationFailedError("Meeting is already finalized")

    option = session.get(GroupAvailabilityOption, option_id)
    if not option or option.meeting_id != meeting_id:
        raise ValidationFailedError("Invalid option for this meeting")

    if recurrence_weeks < 1:
        raise ValidationFailedError("recurrence_weeks must be between 1 and 52")

    invited_user_ids = session.exec(
        select(GroupMeetingInvite.user_id)
        .where(GroupMeetingInvite.meeting_id == meeting_id)
        .distinct()
    ).all()
    if not invited_user_ids:
        raise ValidationFailedError("Cannot finalize a meeting with no invited users")

    first_slot = None
    for week in range(recurrence_weeks):
        delta = timedelta(weeks=week)
        slot = BookingSlot(
            owner_id=owner.user_id,
            slot_type=SlotType.GROUP,
            status=SlotStatus.FULL,
            title=meeting.title,
            description=meeting.description,
            start_time=option.start_time + delta,
            end_time=option.end_time + delta,
            is_recurring=recurrence_weeks > 1,
            recurrence_weeks=recurrence_weeks,
            group_meeting_id=meeting.id,
            max_participants=max(1, len(invited_user_ids))
        )
        session.add(slot)
        session.flush()
        for invited_user_id in invited_user_ids:
            session.add(Reservation(slot_id=slot.id, user_id=invited_user_id))
        if week == 0:
            first_slot = slot

    meeting.is_finalized = True
    session.flush()
    if first_slot:
        meeting.finalized_slot_id = first_slot.id
    session.commit()

    invited_emails = session.exec(
        select(User.email).where(User.user_id.in_(invited_user_ids))
    ).all()

    all_emails = invited_emails + [owner.email]
    repeat_text = f" It will repeat for {recurrence_weeks} consecutive weeks." if recurrence_weeks > 1 else ""
    body_text = (
        f"Hi everyone,\n\n"
        f"The group meeting '{meeting.title}' has been finalized based on the votes.\n\n"
        f"Selected Time: {option.start_time.strftime('%B %d, %Y at %H:%M')} to {option.end_time.strftime('%B %d, %Y at %H:%M')}{repeat_text}\n\n"
        f"See you there!"
    )

    return build_mailto(
        to=",".join(all_emails), 
        subject=f"Meeting Finalized: {meeting.title}",
        body=body_text
    )

def delete_group_meeting(
    meeting_id: int,
    session: Session,
    owner: User,
):
    meeting = session.get(GroupMeeting, meeting_id)
    if not meeting or meeting.owner_id != owner.user_id:
        raise ResourceNotFoundError("Meeting not found")
    
    session.delete(meeting)
    session.commit()
