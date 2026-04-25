from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from models.booking import (
    BookingSlot,
    GroupAvailabilityOption,
    GroupMeetingInvite,
    GroupAvailabilityOptionRead,
    GroupMeeting,
    GroupMeetingCreate,
    GroupMeetingRead,
    GroupVote,
    GroupVoteCreate,
    MailtoResponse,
    Reservation,
    SlotStatus,
    SlotType,
    build_mailto,
)
from models.users import User
from database.session import get_session
from security import get_current_user, get_owner

router = APIRouter(prefix="/group-meetings", tags=["Group Meetings"])


# Owner: create a group meeting with proposed time options 
@router.post("", response_model=GroupMeetingRead, status_code=201)
def create_group_meeting(
    data: GroupMeetingCreate,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    if not data.options:
        raise HTTPException(400, "At least one time option is required")
    if not data.invited_user_ids:
        raise HTTPException(400, "At least one invited user is required")

    meeting = GroupMeeting(
        title=data.title,
        description=data.description,
        owner_id=owner.user_id,
    )
    session.add(meeting)
    session.flush()  # get meeting.id before inserting options

    for option in data.options:
        if option.end_time <= option.start_time:
            raise HTTPException(400, "Each option's end_time must be after start_time")
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
        raise HTTPException(400, f"Invited users not found: {missing_ids}")
    if owner.user_id in invited_ids:
        raise HTTPException(400, "Owner cannot be in invited users list")

    for invited_user_id in invited_ids:
        session.add(GroupMeetingInvite(meeting_id=meeting.id, user_id=invited_user_id))

    session.commit()
    session.refresh(meeting)
    return meeting


# Owner: list their group meetings
@router.get("/mine", response_model=list[GroupMeetingRead])
def get_my_group_meetings(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return session.exec(
        select(GroupMeeting).where(GroupMeeting.owner_id == owner.user_id)
    ).all()


# User: list group meeting invitations
@router.get("/invites", response_model=list[GroupMeetingRead])
def get_my_invites(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    meeting_ids = session.exec(
        select(GroupMeetingInvite.meeting_id).where(GroupMeetingInvite.user_id == user.user_id)
    ).all()
    if not meeting_ids:
        return []
    
    return session.exec(
        select(GroupMeeting).where(GroupMeeting.id.in_(meeting_ids))
    ).all()


# Owner: view a group meeting 
@router.get("/{meeting_id}", response_model=GroupMeetingRead)
def get_group_meeting(
    meeting_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    meeting = session.get(GroupMeeting, meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return meeting


# User: submit availability votes 
@router.post("/{meeting_id}/vote")
def vote(
    meeting_id: int,
    data: GroupVoteCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    User votes for one or more available time options.
    Re-submitting replaces previous votes.
    """
    meeting = session.get(GroupMeeting, meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    if meeting.is_finalized:
        raise HTTPException(400, "Voting is closed, meeting is already finalized")

    invited_ids = set(
        session.exec(
            select(GroupMeetingInvite.user_id).where(
                GroupMeetingInvite.meeting_id == meeting_id
            )
        ).all()
    )
    if user.user_id not in invited_ids:
        raise HTTPException(403, "Only invited users can vote on this meeting")

    # Validate all option IDs belong to this meeting
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
            raise HTTPException(400, f"Option {option_id} does not belong to this meeting")

    # Remove previous votes by this user and decrement counts
    old_votes = session.exec(
        select(GroupVote).where(
            GroupVote.meeting_id == meeting_id,
            GroupVote.user_id == user.user_id,
        )
    ).all()
    for vote in old_votes:
        option = valid_options.get(vote.option_id)
        if option:
            option.vote_count = max(0, option.vote_count - 1)
        session.delete(vote)

    # Record new votes and increment counts
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


# Owner: view heatmap (options ranked by vote count) 
@router.get("/{meeting_id}/heatmap", response_model=list[GroupAvailabilityOptionRead])
def get_heatmap(
    meeting_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    """
    Returns all time options sorted by vote count descending.
    Frontend uses vote_count to render the heatmap visualization.
    """
    meeting = session.get(GroupMeeting, meeting_id)
    if not meeting or meeting.owner_id != owner.user_id:
        raise HTTPException(404, "Meeting not found")

    return session.exec(
        select(GroupAvailabilityOption)
        .where(GroupAvailabilityOption.meeting_id == meeting_id)
        .order_by(GroupAvailabilityOption.vote_count.desc())
    ).all()


# Owner: finalize meeting — pick a time and create booking slot(s)
@router.post("/{meeting_id}/finalize", response_model=MailtoResponse)
def finalize_meeting(
    meeting_id: int,
    option_id: int,
    recurrence_weeks: int = 1,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    """
    Owner picks a winning option. Creates booking slots (recurring if needed)
    and returns a list of mailto payloads to notify all voters.
    """
    meeting = session.get(GroupMeeting, meeting_id)
    if not meeting or meeting.owner_id != owner.user_id:
        raise HTTPException(404, "Meeting not found")
    if meeting.is_finalized:
        raise HTTPException(400, "Meeting is already finalized")

    option = session.get(GroupAvailabilityOption, option_id)
    if not option or option.meeting_id != meeting_id:
        raise HTTPException(400, "Invalid option for this meeting")

    if recurrence_weeks < 1:
        raise HTTPException(400, "recurrence_weeks must be between 1 and 52")

    invited_user_ids = session.exec(
        select(GroupMeetingInvite.user_id)
        .where(GroupMeetingInvite.meeting_id == meeting_id)
        .distinct()
    ).all()
    if not invited_user_ids:
        raise HTTPException(400, "Cannot finalize a meeting with no invited users")

    # Create recurring booking slots and attach all invited users as participants.
    first_slot = None
    for week in range(recurrence_weeks):
        delta = timedelta(weeks=week)
        slot = BookingSlot(
            owner_id=owner.user_id,
            slot_type=SlotType.GROUP,
            status=SlotStatus.BOOKED,
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


# Owner: delete a group meeting
@router.delete("/{meeting_id}", status_code=204)
def delete_group_meeting(
    meeting_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    meeting = session.get(GroupMeeting, meeting_id)
    if not meeting or meeting.owner_id != owner.user_id:
        raise HTTPException(404, "Meeting not found")
    
    # All associated records (invites, options, votes) will be deleted via DB cascade
    session.delete(meeting)
    session.commit()
    return None