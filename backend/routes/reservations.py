from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import func

from models.booking import (
    BookingSlot,
    MailtoResponse,
    Reservation,
    ReservationRead,
    ReservationStatus,
    SlotStatus,
    build_mailto,
)
from models.users import User
from database.session import get_current_user, get_owner, get_session

router = APIRouter(prefix="/reservations", tags=["Reservations"])


# User: reserve a slot 
@router.post("/{slot_id}", response_model=MailtoResponse, status_code=201)
def reserve_slot(
    slot_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    slot = session.get(BookingSlot, slot_id)
    if not slot:
        raise HTTPException(404, "Slot not found")
    
    # Check if slot is full
    current_reservations_count = session.exec(
        select(func.count(Reservation.id)).where(
            Reservation.slot_id == slot_id,
            Reservation.status == ReservationStatus.CONFIRMED,
        )
    ).one()

    if current_reservations_count >= slot.max_participants:
        raise HTTPException(409, "This slot is full")

    # Prevent duplicate reservations by the SAME user
    duplicate_check = session.exec(
        select(Reservation).where(
            Reservation.slot_id == slot_id,
            Reservation.user_id == user.user_id,
            Reservation.status == ReservationStatus.CONFIRMED
        )
    ).first()
    if duplicate_check:
        raise HTTPException(400, "You have already reserved this slot")

    if current_reservations_count + 1 == slot.max_participants:
        slot.status = SlotStatus.BOOKED

    reservation = Reservation(slot_id=slot_id, user_id=user.user_id)
    session.add(reservation)
    session.add(slot) 
    session.commit()
    
    owner = session.get(User, slot.owner_id)
    return build_mailto(
        to=owner.email,
        subject="New booking on your slot",
        body=(
            f"Hi {owner.first_name},\n\n"
            f"{user.first_name} {user.last_name} ({user.email}) has booked "
            f"your slot '{slot.title}' scheduled for "
            f"{slot.start_time.strftime('%B %d, %Y at %H:%M')}."
        ),
    )


# User: cancel their own reservation 
@router.delete("/{reservation_id}", response_model=MailtoResponse)
def cancel_reservation(
    reservation_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Cancel a reservation. Frees up the slot back to ACTIVE.
    Returns a mailto so the frontend can notify the slot owner.
    """
    reservation = session.get(Reservation, reservation_id)
    if not reservation or reservation.user_id != user.user_id:
        raise HTTPException(404, "Reservation not found")
    
    if reservation.status == ReservationStatus.CANCELLED:
        raise HTTPException(400, "Reservation is already cancelled")

    slot = session.get(BookingSlot, reservation.slot_id)
    slot.status = SlotStatus.ACTIVE # Change slot status from booked to active
    reservation.status = ReservationStatus.CANCELLED
    session.commit()

    owner = session.get(User, slot.owner_id)
    return build_mailto(
        to=owner.email,
        subject="A booking was cancelled",
        body=(
            f"Hi {owner.first_name},\n\n"
            f"{user.first_name} {user.last_name} ({user.email}) has cancelled "
            f"their booking for '{slot.title}' on "
            f"{slot.start_time.strftime('%B %d, %Y at %H:%M')}.\n\n"
            f"The slot is now available again."
        ),
    )


# User: view their own confirmed reservations 
@router.get("/me", response_model=list[ReservationRead])
def my_reservations(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return session.exec(
        select(Reservation).where(
            Reservation.user_id == user.user_id,
            Reservation.status == ReservationStatus.CONFIRMED,
        )
    ).all()


# Owner: view all reservations across their slots 
@router.get("/owner/all", response_model=list[ReservationRead])
def owner_reservations(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    """Owner sees every confirmed reservation across all their slots."""
    owned_slot_ids = [
        slot.id
        for slot in session.exec(
            select(BookingSlot).where(BookingSlot.owner_id == owner.user_id)
        ).all()
    ]

    if not owned_slot_ids:
        return []

    return session.exec(
        select(Reservation).where(
            Reservation.slot_id.in_(owned_slot_ids),
            Reservation.status == ReservationStatus.CONFIRMED,
        )
    ).all()