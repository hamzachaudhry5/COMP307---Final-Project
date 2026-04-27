from fastapi import APIRouter, Depends
from sqlmodel import Session

from models.booking import (
    MailtoResponse,
    ReservationRead,
)
from models.users import User
from database.session import get_session
from security import get_current_user, get_owner
from services import reservation_service

router = APIRouter(prefix="/reservations", tags=["Reservations"])


@router.post("/{slot_id}", response_model=MailtoResponse, status_code=201)
def reserve_slot(
    slot_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return reservation_service.reserve_slot(slot_id, session, user)


@router.delete("/{reservation_id}", response_model=MailtoResponse)
def cancel_reservation(
    reservation_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return reservation_service.cancel_reservation(reservation_id, session, user)


@router.get("/me", response_model=list[ReservationRead])
def my_reservations(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return reservation_service.get_my_reservations(session, user)


@router.get("/owner/all", response_model=list[ReservationRead])
def owner_reservations(
    session: Session = Depends(get_session),
    owner: User = Depends(get_owner),
):
    return reservation_service.get_owner_reservations(session, owner)
