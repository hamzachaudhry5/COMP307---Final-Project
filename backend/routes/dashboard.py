from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from models.booking import (
    BookingSlot,
    BookingSlotRead,
    MeetingRequest,
    Reservation,
    ReservationRead,
    ReservationStatus,
    RequestStatus,
    SlotStatus
)
from models.users import User, UserRole
from database.session import get_session
from security import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("")
def dashboard(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Aggregated view for the logged-in user:
    - their confirmed reservations
    - (owners only) their slots and incoming pending requests
    """
    my_reservations = session.exec(
        select(Reservation).where(
            Reservation.user_id == user.user_id,
            Reservation.status == ReservationStatus.CONFIRMED,
        )
    ).all()

    dashboard_info = {
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "name": f"{user.first_name} {user.last_name}",
            "role": user.role,
        },
        "upcoming_appointments": [ReservationRead.model_validate(res) for res in my_reservations],
    }

    if user.role == UserRole.owner:
        upcoming_appointments = session.exec(
            select(BookingSlot)
            .join(Reservation, Reservation.slot_id == BookingSlot.id)
            .where(
                BookingSlot.owner_id == user.user_id,
                Reservation.status == ReservationStatus.CONFIRMED,
                BookingSlot.status != SlotStatus.CANCELLED,
            )
            .distinct()
            .order_by(BookingSlot.start_time)
        ).all()

        pending_requests = session.exec(
            select(MeetingRequest).where(
                MeetingRequest.owner_id == user.user_id,
                MeetingRequest.status == RequestStatus.PENDING,
            )
        ).all()

        dashboard_info["upcoming_appointments"] = [BookingSlotRead.model_validate(slot) for slot in upcoming_appointments]
        dashboard_info["pending_requests"] = pending_requests

    return dashboard_info

