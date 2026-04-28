import secrets
import uuid
from datetime import timedelta, datetime
from typing import Optional, List

from fastapi import HTTPException
from sqlmodel import Session, select

from models.slots import (
    BookingSlot,
    BookingSlotBulkCreate,
    BookingSlotCreate,
    BookingSlotUpdate,
    SlotStatus,
)
from models.reservations import Reservation
from models.mailto import MailtoResponse, build_mailto
from models.group_meetings import GroupMeeting
from models.users import User, UserRole, InviteLinkResponse
from utils import check_slot_overlap

def create_slot(
    booking_slot: BookingSlotCreate,
    session: Session,
    owner: User,
) -> List[BookingSlot]:
    if booking_slot.end_time <= booking_slot.start_time:
        raise HTTPException(400, "end_time must be after start_time")

    recurring_weeks = booking_slot.recurrence_weeks if (booking_slot.is_recurring and booking_slot.recurrence_weeks and booking_slot.recurrence_weeks > 1) else 1
    created_slots = []

    for week in range(recurring_weeks):
        delta = timedelta(weeks=week)
        start_time, end_time = booking_slot.start_time + delta, booking_slot.end_time + delta
        data = booking_slot.model_dump()
        data["start_time"] = start_time
        data["end_time"] = end_time
        data["owner_id"] = owner.user_id
        slot = BookingSlot(**data)
        
        session.add(slot)
        created_slots.append(slot)

    session.commit()
    for slot in created_slots:
        session.refresh(slot)

    return created_slots

def create_bulk_slots(
    payload: BookingSlotBulkCreate,
    session: Session,
    owner: User,
) -> List[BookingSlot]:
    if not payload.slots:
        raise HTTPException(400, "At least one slot is required")

    created_slots: list[BookingSlot] = []
    batch_id = str(uuid.uuid4())
    for slot_data in payload.slots:
        if slot_data.end_time <= slot_data.start_time:
            raise HTTPException(400, "Each slot end_time must be after start_time")

        recurring_weeks = slot_data.recurrence_weeks if (slot_data.is_recurring and slot_data.recurrence_weeks and slot_data.recurrence_weeks > 1) else 1
        for week in range(recurring_weeks):
            delta = timedelta(weeks=week)
            start_time, end_time = slot_data.start_time + delta, slot_data.end_time + delta
            data = slot_data.model_dump()
            data["start_time"] = start_time
            data["end_time"] = end_time
            data["owner_id"] = owner.user_id
            data["batch_id"] = batch_id
            slot = BookingSlot(**data)

            session.add(slot)
            created_slots.append(slot)

    session.commit()
    for slot in created_slots:
        session.refresh(slot)
    return created_slots

def get_my_slots(
    session: Session,
    owner: User,
) -> List[BookingSlot]:
    return session.exec(
        select(BookingSlot).where(BookingSlot.owner_id == owner.user_id).order_by(BookingSlot.start_time)
    ).all()

def activate_slot(
    slot_id: int,
    session: Session,
    owner: User,
) -> BookingSlot:
    slot = _get_owned_slot(slot_id, owner, session)

    if slot.status != SlotStatus.PRIVATE:
        raise HTTPException(400, "Only PRIVATE slots can be activated")
    
    check_slot_overlap( 
        owner_id=owner.user_id,
        start_time=slot.start_time,
        end_time=slot.end_time,
        session=session,
        current_slot_id=slot.id,
    )

    slot.status = SlotStatus.ACTIVE
    session.commit()
    session.refresh(slot)
    return slot

def activate_batch(batch_id: str, session: Session, owner: User) -> List[BookingSlot]:
    slots = session.exec(
        select(BookingSlot).where(BookingSlot.batch_id == batch_id, BookingSlot.owner_id == owner.user_id)
    ).all()
    if not slots:
        raise HTTPException(404, "Batch not found")
    
    for slot in slots:
        if slot.status == SlotStatus.PRIVATE:
            check_slot_overlap(owner.user_id, slot.start_time, slot.end_time, session, slot.id)
    
    for slot in slots:
        if slot.status == SlotStatus.PRIVATE:
            slot.status = SlotStatus.ACTIVE
            
    session.commit()
    return slots

def deactivate_slot(
    slot_id: int,
    session: Session,
    owner: User,
) -> BookingSlot:
    slot = _get_owned_slot(slot_id, owner, session)

    has_reservations = session.exec(
        select(Reservation).where(Reservation.slot_id == slot.id)
    ).first()
    if has_reservations:
        raise HTTPException(400, "Cannot deactivate a slot with existing reservations. Delete it instead to notify bookers.")

    slot.status = SlotStatus.PRIVATE
    session.commit()
    session.refresh(slot)
    return slot

def deactivate_batch(batch_id: str, session: Session, owner: User) -> List[BookingSlot]:
    slots = session.exec(
        select(BookingSlot).where(BookingSlot.batch_id == batch_id, BookingSlot.owner_id == owner.user_id)
    ).all()
    if not slots:
        raise HTTPException(404, "Batch not found")
    
    for slot in slots:
        if slot.status == SlotStatus.FULL:
            raise HTTPException(400, f"Slot '{slot.title}' on {slot.start_time.strftime('%B %d at %H:%M')} has reservations. Delete the batch instead to notify bookers.")
        elif slot.status == SlotStatus.ACTIVE:
            has_reservations = session.exec(
                select(Reservation).where(Reservation.slot_id == slot.id)
            ).first()
            if has_reservations:
                raise HTTPException(400, f"Slot '{slot.title}' on {slot.start_time.strftime('%B %d at %H:%M')} has reservations. Delete the batch instead to notify bookers.")
            
    for slot in slots:
        slot.status = SlotStatus.PRIVATE
        
    session.commit()
    return slots

def get_or_create_invite_link(
    session: Session,
    owner: User,
) -> InviteLinkResponse:
    if not owner.invite_token:
        owner.invite_token = secrets.token_urlsafe(32)
        session.add(owner)
        session.commit()
        session.refresh(owner)
    return InviteLinkResponse(
        invite_token=owner.invite_token,
        invite_url=_invite_url(owner.invite_token),
    )

def regenerate_invite_link(
    session: Session,
    owner: User,
) -> InviteLinkResponse:
    owner.invite_token = secrets.token_urlsafe(32)
    session.add(owner)
    session.commit()
    session.refresh(owner)
    return InviteLinkResponse(
        invite_token=owner.invite_token,
        invite_url=_invite_url(owner.invite_token),
    )

def update_slot(
    slot_id: int,
    booking_slot: BookingSlotUpdate,
    session: Session,
    owner: User,
) -> BookingSlot:
    slot = _get_owned_slot(slot_id, owner, session)

    has_reservations = session.exec(
        select(Reservation).where(Reservation.slot_id == slot.id)
    ).first()
    if has_reservations:
        raise HTTPException(400, "Cannot edit a slot that already has reservations")

    for field, value in booking_slot.model_dump(exclude_unset=True).items():
        setattr(slot, field, value)

    if slot.end_time <= slot.start_time:
        raise HTTPException(400, "end_time must be after start_time")
    
    if slot.status == SlotStatus.ACTIVE:
        check_slot_overlap(
            owner_id=owner.user_id,
            start_time=slot.start_time,
            end_time=slot.end_time,
            session=session,
            current_slot_id=slot.id
        )

    session.commit()
    session.refresh(slot)
    return slot

def delete_slot(
    slot_id: int,
    session: Session,
    owner: User,
) -> Optional[MailtoResponse]:
    slot = _get_owned_slot(slot_id, owner, session)
    
    statement = (
        select(User.email)
        .join(Reservation, Reservation.user_id == User.user_id)
        .where(Reservation.slot_id == slot_id)
    )
    reservation_booker_emails = session.exec(statement).all()
    
    mailto = None
    if reservation_booker_emails:
        mailto = build_mailto(
            to=",".join(reservation_booker_emails),
            subject=f"Cancellation: {slot.title}",
            body=(
                f"Hello,\n\n"
                f"This email is to inform you that the booking slot '{slot.title}' "
                f"scheduled for {slot.start_time.strftime('%B %d, %Y at %H:%M')} "
                f"has been cancelled/deleted by the owner.\n\n"
                f"Please check the dashboard for alternative times."
            ),
        )

    linked_meetings = session.exec(
        select(GroupMeeting).where(GroupMeeting.finalized_slot_id == slot_id)
    ).all()
    for meeting in linked_meetings:
        meeting.is_finalized = False
        session.add(meeting)

    session.delete(slot)
    session.commit()

    return mailto

def delete_batch(batch_id: str, session: Session, owner: User) -> Optional[MailtoResponse]:
    slots = session.exec(
        select(BookingSlot).where(BookingSlot.batch_id == batch_id, BookingSlot.owner_id == owner.user_id)
    ).all()
    if not slots:
        raise HTTPException(404, "Batch not found")
    
    slot_ids = [slot.id for slot in slots]
    emails_result = session.exec(
        select(User.email).join(Reservation, Reservation.user_id == User.user_id)
        .where(Reservation.slot_id.in_(slot_ids))
    ).all()
    
    mailto = None
    if emails_result:
        mailto = build_mailto(
            to=",".join(set(emails_result)),
            subject=f"Cancellation: {slots[0].title}",
            body=f"One or more slots you booked have been cancelled by the owner."
        )
    
    for slot in slots:
        session.delete(slot)
    session.commit()
    return mailto

def get_slot_bookers(
    slot_id: int,
    session: Session,
    owner: User,
) -> List[User]:
    slot = _get_owned_slot(slot_id, owner, session)
    statement = (
        select(User)
        .join(Reservation, Reservation.user_id == User.user_id)
        .where(Reservation.slot_id == slot_id)
    )
    
    bookers = session.exec(statement).all()
    return bookers

def get_slots_by_invite(
    token: str,
    session: Session,
    current_user: User,
) -> List[BookingSlot]:
    owner = session.exec(
        select(User).where(User.invite_token == token, User.role == UserRole.owner)
    ).first()
    if not owner:
        raise HTTPException(404, "Invalid or expired invite link")

    if owner.user_id == current_user.user_id:
        raise HTTPException(400, "You cannot book your own slots via invite link")

    return session.exec(
        select(BookingSlot)
        .where(BookingSlot.owner_id == owner.user_id)
        .where(BookingSlot.status == SlotStatus.ACTIVE)
        .order_by(BookingSlot.start_time)
    ).all()

def list_owners(
    session: Session,
    current_user: User,
) -> List[User]:
    return session.exec(
        select(User).where(
            User.role == UserRole.owner, 
            User.is_active == True,
            User.user_id != current_user.user_id
        )
    ).all()

def list_owners_with_active_slots(
    session: Session,
    current_user: User,
) -> List[User]:
    owners = session.exec(
        select(User).where(
            User.role == UserRole.owner, 
            User.is_active == True,
            User.user_id != current_user.user_id
        )
    ).all()
    return [
        owner
        for owner in owners
        if session.exec(
            select(BookingSlot).where(
                BookingSlot.owner_id == owner.user_id,
                BookingSlot.status == SlotStatus.ACTIVE,
            )
        ).first()
    ]

def get_owner_active_slots(
    owner_id: int,
    session: Session,
    current_user: User,
) -> List[BookingSlot]:
    if owner_id == current_user.user_id:
        raise HTTPException(400, "You cannot book your own slots")

    owner = session.get(User, owner_id)
    if not owner or owner.role != UserRole.owner:
        raise HTTPException(404, "Owner not found")

    return session.exec(
        select(BookingSlot)
        .where(BookingSlot.owner_id == owner_id)
        .where(BookingSlot.status == SlotStatus.ACTIVE)
        .order_by(BookingSlot.start_time)
    ).all()

# Helpers
def _get_owned_slot(slot_id: int, owner: User, session: Session) -> BookingSlot:
    slot = session.get(BookingSlot, slot_id)
    if not slot or slot.owner_id != owner.user_id:
        raise HTTPException(404, "Slot not found")
    return slot

def _invite_url(token: str) -> str:
    return f"/booking/invite/{token}"
