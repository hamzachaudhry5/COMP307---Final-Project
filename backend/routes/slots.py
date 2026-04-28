from typing import Optional, List

from fastapi import APIRouter, Depends
from sqlmodel import Session

from models.slots import (
    BookingSlotBulkCreate,
    BookingSlotCreate,
    BookingSlotRead,
    BookingSlotUpdate,
)
from models.mailto import MailtoResponse
from models.users import User, UserRead, InviteLinkResponse
from database.session import get_session
from security import get_current_user, get_owner
from services import slot_service

router = APIRouter(prefix="/slots", tags=["Slots"])


@router.post("", response_model=list[BookingSlotRead], status_code=201)
def create_slot(
    booking_slot: BookingSlotCreate,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return slot_service.create_slot(booking_slot, session, owner)


@router.post("/bulk", response_model=list[BookingSlotRead], status_code=201)
def create_bulk_slots(
    payload: BookingSlotBulkCreate,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return slot_service.create_bulk_slots(payload, session, owner)


@router.get("/mine", response_model=list[BookingSlotRead])
def get_my_slots(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return slot_service.get_my_slots(session, owner)


@router.patch("/{slot_id}/activate", response_model=BookingSlotRead)
def activate_slot(
    slot_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return slot_service.activate_slot(slot_id, session, owner)


@router.patch("/batch/{batch_id}/activate", response_model=list[BookingSlotRead])
def activate_batch(batch_id: str, session: Session = Depends(get_session), owner: User = Depends(get_owner)):
    return slot_service.activate_batch(batch_id, session, owner)


@router.patch("/{slot_id}/deactivate", response_model=BookingSlotRead)
def deactivate_slot(
    slot_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return slot_service.deactivate_slot(slot_id, session, owner)


@router.patch("/batch/{batch_id}/deactivate", response_model=list[BookingSlotRead])
def deactivate_batch(batch_id: str, session: Session = Depends(get_session), owner: User = Depends(get_owner)):
    return slot_service.deactivate_batch(batch_id, session, owner)


@router.post("/invite-link", response_model=InviteLinkResponse)
def create_invite_link(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return slot_service.get_or_create_invite_link(session, owner)


@router.post("/invite-link/regenerate", response_model=InviteLinkResponse)
def regenerate_invite_link(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return slot_service.regenerate_invite_link(session, owner)


@router.patch("/{slot_id}", response_model=BookingSlotRead)
def update_slot(
    slot_id: int,
    booking_slot: BookingSlotUpdate,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return slot_service.update_slot(slot_id, booking_slot, session, owner)


@router.delete("/{slot_id}", response_model=Optional[MailtoResponse])
def delete_slot(
    slot_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return slot_service.delete_slot(slot_id, session, owner)


@router.delete("/batch/{batch_id}", response_model=Optional[MailtoResponse])
def delete_batch(batch_id: str, session: Session = Depends(get_session), owner: User = Depends(get_owner)):
    return slot_service.delete_batch(batch_id, session, owner)


@router.get("/{slot_id}/reservations", response_model=List[UserRead])
def get_slot_bookers(
    slot_id: int,
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return slot_service.get_slot_bookers(slot_id, session, owner)


@router.get("/invite/{token}", response_model=list[BookingSlotRead])
def get_slots_by_invite(
    token: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return slot_service.get_slots_by_invite(token, session, current_user)


@router.get("/owners", response_model=list[UserRead])
def list_owners(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return slot_service.list_owners(session, current_user)


@router.get("/owners/with-active-slots", response_model=list[UserRead])
def list_owners_with_active_slots(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return slot_service.list_owners_with_active_slots(session, current_user)


@router.get("/owner/{owner_id}", response_model=list[BookingSlotRead])
def get_owner_active_slots(
    owner_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return slot_service.get_owner_active_slots(owner_id, session, current_user)
