from sqlmodel import Session, select
from fastapi import HTTPException
from models.booking import BookingSlot, SlotStatus, Reservation

def check_slot_overlap(owner_id: int, start_time, end_time, session: Session, current_slot_id: int = None):
    statement = select(BookingSlot).where(
        BookingSlot.owner_id == owner_id,
        BookingSlot.status.in_([SlotStatus.ACTIVE, SlotStatus.BOOKED]),
        BookingSlot.start_time < end_time,
        BookingSlot.end_time > start_time,
    )
    if current_slot_id:
        statement = statement.where(BookingSlot.id != current_slot_id)
    
    if session.exec(statement).first():
        raise HTTPException(409, f"Slot overlaps with an existing slot")


def check_reservation_overlap(user_id: int, start_time, end_time, session: Session):
    overlapping = session.exec(
        select(Reservation)
        .join(BookingSlot, Reservation.slot_id == BookingSlot.id)
        .where(
            Reservation.user_id == user_id,
            BookingSlot.start_time < end_time,
            BookingSlot.end_time > start_time,
        )
    ).first()
    if overlapping:
        raise HTTPException(409, "Your requested time overlaps with an existing booking")