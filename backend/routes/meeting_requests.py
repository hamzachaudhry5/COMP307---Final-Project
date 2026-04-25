from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from models.booking import (
    BookingSlot,
    MailtoResponse,
    MeetingRequest,
    MeetingRequestCreate,
    MeetingRequestRead,
    Reservation,
    RequestStatus,
    SlotStatus,
    SlotType,
    build_mailto,
)
from models.users import User
from models.users import UserRole
from database.session import get_session
from security import get_current_user, get_owner
from utils import check_reservation_overlap

router = APIRouter(prefix="/meeting-requests", tags=["Meeting Requests"])


# User: send a meeting request to an owner 
@router.post("", response_model=MailtoResponse, status_code=201)
def send_request(
    meeting_request: MeetingRequestCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    owner = session.get(User, meeting_request.owner_id)
    if not owner:
        raise HTTPException(404, "Owner not found")
    if owner.role != UserRole.owner:
        raise HTTPException(400, "Meeting requests can only be sent to owners")
    if owner.user_id == user.user_id:
        raise HTTPException(400, "Cannot send a meeting request to yourself")
    if meeting_request.end_time <= meeting_request.start_time:
        raise HTTPException(400, "end_time must be after start_time")
    
    check_reservation_overlap(user_id=user.user_id, start_time=meeting_request.start_time, end_time=meeting_request.end_time, session=session)

    req = MeetingRequest(**meeting_request.model_dump(), requester_id=user.user_id)
    session.add(req)
    session.commit()
    session.refresh(req)

    return build_mailto(
        to=owner.email,
        subject=f"Meeting request from {user.first_name} {user.last_name}",
        body=(
            f"Hi {owner.first_name},\n\n"
            f"{user.first_name} {user.last_name} ({user.email}) has requested a meeting.\n\n"
            f"Proposed time: {meeting_request.start_time} to {meeting_request.end_time}\n\n"
            f"Message: {meeting_request.message or 'No message provided.'}\n\n"
            f"Log in to your dashboard to accept or decline."
        ),
    )


# User: view requests they sent 
@router.get("/sent", response_model=list[MeetingRequestRead])
def sent_requests(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return session.exec(
        select(MeetingRequest).where(MeetingRequest.requester_id == user.user_id)
    ).all()


# Owner: view incoming pending requests 
@router.get("/incoming", response_model=list[MeetingRequestRead])
def incoming_requests(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    requests = session.exec(
        select(MeetingRequest).where(
            MeetingRequest.owner_id == owner.user_id,
            MeetingRequest.status == RequestStatus.PENDING,
        )
    ).all()

    return [
        {
            **req.model_dump(),
            "requester": session.get(User, req.requester_id),
        }
        for req in requests
    ]


# Owner: accept a request → creates a slot + reservation 
@router.patch("/{request_id}/accept", response_model=MailtoResponse)
def accept_request(
    request_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    req = _get_owned_request(request_id, owner, session)
    
    # Create a BOOKED slot for the agreed time
    slot = BookingSlot(
        owner_id=owner.user_id,
        slot_type=SlotType.GENERAL_SLOT,
        status=SlotStatus.BOOKED,
        title=f"Meeting with {session.get(User, req.requester_id).first_name}",
        start_time=req.start_time,
        end_time=req.end_time
    )
    session.add(slot)
    session.flush()  # get slot.id

    reservation = Reservation(slot_id=slot.id, user_id=req.requester_id)
    req.status = RequestStatus.ACCEPTED
    req.booking_slot_id = slot.id
    session.add(reservation)
    session.commit()

    requester = session.get(User, req.requester_id)
    return build_mailto(
        to=requester.email,
        subject="Your meeting request was accepted",
        body=(
            f"Hi {requester.first_name},\n\n"
            f"Great news — {owner.first_name} {owner.last_name} has accepted your meeting request.\n\n"
            f"Scheduled time: {req.start_time.strftime('%B %d, %Y at %H:%M')} to {req.end_time.strftime('%B %d, %Y at %H:%M')}\n\n"
            f"The appointment will appear on your dashboard."
        ),
    )


# Owner: decline a request 
@router.patch("/{request_id}/decline", response_model=MailtoResponse)
def decline_request(
    request_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    req = _get_owned_request(request_id, owner, session)
    req.status = RequestStatus.DECLINED
    session.commit()

    requester = session.get(User, req.requester_id)
    return build_mailto(
        to=requester.email,
        subject="Your meeting request was declined",
        body=(
            f"Hi {requester.first_name},\n\n"
            f"Unfortunately, {owner.first_name} {owner.last_name} was unable "
            f"to accommodate your meeting request at this time."
        ),
    )


# Helper function
def _get_owned_request(
    request_id: int, owner: User, session: Session
) -> MeetingRequest:
    req = session.get(MeetingRequest, request_id)
    if not req or req.owner_id != owner.user_id:
        raise HTTPException(404, "Request not found")
    if req.status != RequestStatus.PENDING:
        raise HTTPException(400, f"Request has already been {req.status.value}")
    return req
