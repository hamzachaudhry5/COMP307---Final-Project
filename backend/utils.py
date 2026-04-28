from sqlmodel import Session, select
from exceptions import ConflictError
from models.slots import BookingSlot, SlotStatus
from models.reservations import Reservation

def check_slot_overlap(owner_id: int, start_time, end_time, session: Session, current_slot_id: int = None):
    statement = select(BookingSlot).where(
        BookingSlot.owner_id == owner_id,
        BookingSlot.status.in_([SlotStatus.ACTIVE, SlotStatus.FULL]),
        BookingSlot.start_time < end_time,
        BookingSlot.end_time > start_time,
    )
    if current_slot_id:
        statement = statement.where(BookingSlot.id != current_slot_id)
    
    if session.exec(statement).first():
        raise ConflictError(f"Slot overlaps with an existing slot")


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
        raise ConflictError("Your requested time overlaps with an existing booking")