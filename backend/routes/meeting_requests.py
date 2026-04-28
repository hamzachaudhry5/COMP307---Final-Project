# Sean Xu

from fastapi import APIRouter, Depends
from sqlmodel import Session

from models.meeting_requests import MeetingRequestCreate, MeetingRequestRead
from models.mailto import MailtoResponse
from models.users import User
from database.session import get_session
from security import get_current_user, get_owner
from services import meeting_request_service

router = APIRouter(prefix="/meeting-requests", tags=["Meeting Requests"])


@router.post("", response_model=MailtoResponse, status_code=201)
def send_request(
    meeting_request: MeetingRequestCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return meeting_request_service.send_request(meeting_request, session, user)


@router.get("/sent", response_model=list[MeetingRequestRead])
def sent_requests(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return meeting_request_service.get_sent_requests(session, user)


@router.get("/incoming", response_model=list[MeetingRequestRead])
def incoming_requests(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return meeting_request_service.get_incoming_requests(session, owner)


@router.patch("/{request_id}/accept", response_model=MailtoResponse)
def accept_request(
    request_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return meeting_request_service.accept_request(request_id, session, owner)


@router.patch("/{request_id}/decline", response_model=MailtoResponse)
def decline_request(
    request_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return meeting_request_service.decline_request(request_id, session, owner)
