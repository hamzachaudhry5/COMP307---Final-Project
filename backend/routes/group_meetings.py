# Sean Xu

from fastapi import APIRouter, Depends
from sqlmodel import Session

from models.group_meetings import (
    GroupAvailabilityOptionRead,
    GroupMeetingCreate,
    GroupMeetingRead,
    GroupVoteCreate,
)
from models.mailto import MailtoResponse
from models.users import User
from database.session import get_session
from security import get_current_user, get_owner
from services import group_meeting_service

router = APIRouter(prefix="/group-meetings", tags=["Group Meetings"])


@router.post("", response_model=GroupMeetingRead, status_code=201)
def create_group_meeting(
    data: GroupMeetingCreate,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return group_meeting_service.create_group_meeting(data, session, owner)


@router.get("/mine", response_model=list[GroupMeetingRead])
def get_my_group_meetings(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return group_meeting_service.get_my_group_meetings(session, owner)


@router.get("/invites", response_model=list[GroupMeetingRead])
def get_my_invites(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return group_meeting_service.get_my_invites(session, user)


@router.get("/{meeting_id}", response_model=GroupMeetingRead)
def get_group_meeting(
    meeting_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return group_meeting_service.get_group_meeting(meeting_id, session)


@router.post("/{meeting_id}/vote")
def vote(
    meeting_id: int,
    data: GroupVoteCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return group_meeting_service.vote(meeting_id, data, session, user)


@router.get("/{meeting_id}/heatmap", response_model=list[GroupAvailabilityOptionRead])
def get_heatmap(
    meeting_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return group_meeting_service.get_heatmap(meeting_id, session, owner)


@router.post("/{meeting_id}/finalize", response_model=MailtoResponse)
def finalize_meeting(
    meeting_id: int,
    option_id: int,
    recurrence_weeks: int = 1,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return group_meeting_service.finalize_meeting(meeting_id, option_id, recurrence_weeks, session, owner)


@router.delete("/{meeting_id}", status_code=204)
def delete_group_meeting(
    meeting_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    group_meeting_service.delete_group_meeting(meeting_id, session, owner)
    return None
