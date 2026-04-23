import secrets
from datetime import timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from models.booking import (
    BookingSlot,
    BookingSlotBulkCreate,
    BookingSlotCreate,
    BookingSlotRead,
    BookingSlotUpdate,
    MailtoResponse,
    Reservation,
    SlotStatus,
    build_mailto,
)
from models.users import User, UserRole, UserRead, InviteLinkResponse
from database.session import get_session
from security import get_current_user, get_owner

router = APIRouter(prefix="/slots", tags=["Slots"])


# Owner: create slot(s) 
@router.post("", response_model=list[BookingSlotRead], status_code=201)
def create_slot(
    booking_slot: BookingSlotCreate,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    """
    Create a booking slot. If is_recurring=True and recurrence_weeks>1,
    generates one slot per week automatically (all start as PRIVATE).
    """
    if booking_slot.end_time <= booking_slot.start_time:
        raise HTTPException(400, "end_time must be after start_time")

    recurring_weeks = booking_slot.recurrence_weeks if (booking_slot.is_recurring and booking_slot.recurrence_weeks and booking_slot.recurrence_weeks > 1) else 1
    created_slots = []

    for week in range(recurring_weeks):
        delta = timedelta(weeks=week)
        data = booking_slot.model_dump()
        data["start_time"] = booking_slot.start_time + delta
        data["end_time"] = booking_slot.end_time + delta
        data["owner_id"] = owner.user_id
        slot = BookingSlot(**data)
        
        session.add(slot)
        created_slots.append(slot)

    session.commit()
    for slot in created_slots:
        session.refresh(slot)

    return created_slots


@router.post("/bulk", response_model=list[BookingSlotRead], status_code=201)
def create_bulk_slots(
    payload: BookingSlotBulkCreate,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    """
    Create multiple slot templates in one request.
    Each template can optionally be recurring for N weeks.
    """
    if not payload.slots:
        raise HTTPException(400, "At least one slot is required")

    created_slots: list[BookingSlot] = []
    for slot_data in payload.slots:
        if slot_data.end_time <= slot_data.start_time:
            raise HTTPException(400, "Each slot end_time must be after start_time")

        recurring_weeks = slot_data.recurrence_weeks if (slot_data.is_recurring and slot_data.recurrence_weeks and slot_data.recurrence_weeks > 1) else 1
        for week in range(recurring_weeks):
            delta = timedelta(weeks=week)
            data = slot_data.model_dump()
            data["start_time"] = slot_data.start_time + delta
            data["end_time"] = slot_data.end_time + delta
            data["owner_id"] = owner.user_id
            slot = BookingSlot(**data)

            session.add(slot)
            created_slots.append(slot)

    session.commit()
    for slot in created_slots:
        session.refresh(slot)
    return created_slots


# Owner: view own slots 
@router.get("/mine", response_model=list[BookingSlotRead])
def get_my_slots(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    """Owner sees all their slots (private + active + booked)."""
    return session.exec(
        select(BookingSlot).where(BookingSlot.owner_id == owner.user_id)
    ).all()


# Owner: activate a slot 
@router.patch("/{slot_id}/activate", response_model=BookingSlotRead)
def activate_slot(
    slot_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    slot = _get_owned_slot(slot_id, owner, session)

    if slot.status != SlotStatus.PRIVATE:
        raise HTTPException(400, "Only PRIVATE slots can be activated")

    slot.status = SlotStatus.ACTIVE
    session.commit()
    session.refresh(slot)
    return slot


# Owner: create/retrieve invitation link
@router.post("/invite-link", response_model=InviteLinkResponse)
def create_invite_link(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    if not owner.invite_token:
        owner.invite_token = secrets.token_urlsafe(32)
        session.add(owner)
        session.commit()
        session.refresh(owner)
    return InviteLinkResponse(
        invite_token=owner.invite_token,
        invite_url=_invite_url(owner.invite_token),
    )


# Owner: regenerate invitation link
@router.post("/invite-link/regenerate", response_model=InviteLinkResponse)
def regenerate_invite_link(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    owner.invite_token = secrets.token_urlsafe(32)
    session.add(owner)
    session.commit()
    session.refresh(owner)
    return InviteLinkResponse(
        invite_token=owner.invite_token,
        invite_url=_invite_url(owner.invite_token),
    )


#Owner: update slot
@router.patch("/{slot_id}", response_model=BookingSlotRead)
def update_slot(
    slot_id: int,
    booking_slot: BookingSlotUpdate,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    slot = _get_owned_slot(slot_id, owner, session)

    if slot.status == SlotStatus.BOOKED:
        raise HTTPException(400, "Cannot edit a slot that is already booked")

    for field, value in booking_slot.model_dump(exclude_unset=True).items():
        setattr(slot, field, value)

    if slot.end_time <= slot.start_time:
        raise HTTPException(400, "end_time must be after start_time")

    session.commit()
    session.refresh(slot)
    return slot


# Owner: delete a slot 
@router.delete("/{slot_id}", response_model=Optional[MailtoResponse])
def delete_slot(
    slot_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    slot = _get_owned_slot(slot_id, owner, session)
    statement = (
        select(Reservation, User)
        .join(User, Reservation.user_id == User.user_id)
        .where(Reservation.slot_id == slot_id)
    )
    results = session.exec(statement).all()

    mailto = None
    if results:
        reservation_booker_emails = [user.email for _, user in results]
        mailto = build_mailto(
            to=",".join(reservation_booker_emails),  # Comma-separated list for the 'To' field
            subject=f"Cancellation: {slot.title}",
            body=(
                f"Hello,\n\n"
                f"This email is to inform you that the booking slot '{slot.title}' "
                f"scheduled for {slot.start_time.strftime('%B %d, %Y at %H:%M')} "
                f"has been cancelled/deleted by the owner.\n\n"
                f"Please check the dashboard for alternative times."
            ),
        )

        for reservation, _ in results:
            session.delete(reservation)

    session.delete(slot)
    session.commit()

    return mailto


# Owner: view who booked each slot 
@router.get("/{slot_id}/reservations", response_model=List[UserRead])
def get_slot_bookers(
    slot_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    """Owner sees all users who reserved a given slot."""
    slot = _get_owned_slot(slot_id, owner, session)
    statement = (
        select(User)
        .join(Reservation, Reservation.user_id == User.user_id)
        .where(Reservation.slot_id == slot_id)
    )
    
    bookers = session.exec(statement).all()
    return bookers


#Public: Given an invite url, return an owner's active booking slots  
@router.get("/invite/{token}", response_model=list[BookingSlotRead])
def get_slots_by_invite(
    token: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),  # must be logged in
):
    """
    Resolves an invite URL token. Returns the owner's active slots.
    Frontend should redirect to login before hitting this if unauthenticated.
    """
    owner = session.exec(
        select(User).where(User.invite_token == token, User.role == UserRole.owner)
    ).first()
    if not owner:
        raise HTTPException(404, "Invalid or expired invite link")

    return session.exec(
        select(BookingSlot)
        .where(BookingSlot.owner_id == owner.user_id)
        .where(BookingSlot.status == SlotStatus.ACTIVE)
        .order_by(BookingSlot.start_time)
    ).all()


# Public: list all owners 
@router.get("/owners", response_model=list[UserRead])
def list_owners(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Returns all active owners."""
    return session.exec(
        select(User).where(User.role == UserRole.owner, User.is_active == True)
    ).all()


# Public: list owners that currently have active slots
@router.get("/owners/with-active-slots", response_model=list[UserRead])
def list_owners_with_active_slots(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    owners = session.exec(
        select(User).where(User.role == UserRole.owner, User.is_active == True)
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


#  Public: browse a specific owner's active slots 
@router.get("/owner/{owner_id}", response_model=list[BookingSlotRead])
def get_owner_active_slots(
    owner_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
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