import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlmodel import Session, select
from sqlalchemy import or_
from icalendar import Calendar, Event

from models.booking import (
    BookingSlot,
    Reservation,
    SlotStatus,
)
from models.users import User, UserRole
from database.session import get_session
from security import get_current_user


router = APIRouter(prefix="/calendar", tags=["Calendar"])


@router.get("/export.ics")
def export_ical(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Exports all confirmed appointments as a .ics file.
    Works for both roles:
    - Users: their reserved slots
    - Owners: their owned slots (active + booked)
    Import into Google Calendar or Outlook via File → Import.
    """
    cal = Calendar()
    cal.add("prodid", "-//SOCS Booking App//McGill//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("x-wr-calname", "SOCS Bookings")

    # Slots booked by this user
    reservations = session.exec(
        select(Reservation).where(
            Reservation.user_id == user.user_id,
        )
    ).all()

    for res in reservations:
        slot = session.get(BookingSlot, res.slot_id)
        if slot:
            _add_event(cal, slot, note="Booked appointment")

    # Owner's own slots
    if user.role == UserRole.owner:
        owned_confirmed_ids = session.exec(
            select(Reservation.slot_id).distinct()
        ).all()
        owned_slots = session.exec(
            select(BookingSlot).where(
                BookingSlot.owner_id == user.user_id,
                or_(
                    BookingSlot.status == SlotStatus.BOOKED,
                    BookingSlot.id.in_(owned_confirmed_ids),
                ),
            )
        ).all()
        for slot in owned_slots:
            _add_event(cal, slot, note="Your booking slot")

    return Response(
        content=cal.to_ical(),
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="socs_bookings.ics"'},
    )


def _add_event(cal: Calendar, slot: BookingSlot, note: str = "") -> None:
    event = Event()
    event.add("summary", slot.title)
    event.add("dtstart", slot.start_time)
    event.add("dtend", slot.end_time)
    event.add("uid", str(uuid.uuid4()))
    if slot.description or note:
        event.add("description", f"{note}\n{slot.description or ''}".strip())
    cal.add_component(event)