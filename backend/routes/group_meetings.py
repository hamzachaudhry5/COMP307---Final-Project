from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from models.booking import (
    BookingSlot,
    GroupAvailabilityOption,
    GroupAvailabilityOptionRead,
    GroupMeeting,
    GroupMeetingCreate,
    GroupMeetingRead,
    GroupVote,
    GroupVoteCreate,
    MailtoResponse,
    SlotStatus,
    SlotType,
    build_mailto,
)
from models.users import User
from database.session import get_current_user, get_owner, get_session

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

    session.commit()
    session.refresh(meeting)
    return meeting


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
@router.post("/{meeting_id}/finalize", response_model=list[MailtoResponse])
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

    voter_ids = session.exec(
        select(GroupVote.user_id)
        .where(GroupVote.meeting_id == meeting_id)
        .distinct()
    ).all()

    # Create recurring booking slots
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
            max_participants=len(voter_ids)
        )
        session.add(slot)
        if week == 0:
            first_slot = slot

    meeting.is_finalized = True
    session.flush()
    if first_slot:
        meeting.finalized_slot_id = first_slot.id
    session.commit()

    voter_emails = session.exec(
        select(User.email).where(User.user_id.in_(voter_ids))
    ).all()

    if not voter_emails:
        return []

    repeat_text = f" It will repeat for {recurrence_weeks} consecutive weeks." if recurrence_weeks > 1 else ""
    body_text = (
        f"Hi everyone,\n\n"
        f"The group meeting '{meeting.title}' has been finalized based on the votes.\n\n"
        f"Selected Time: {option.start_time.strftime('%B %d, %Y at %H:%M')} to {option.end_time.strftime('%B %d, %Y at %H:%M')}{repeat_text}\n\n"
        f"See you there!"
    )

    return build_mailto(
        to=",".join(voter_emails), 
        subject=f"Meeting Finalized: {meeting.title}",
        body=body_text
    )
   