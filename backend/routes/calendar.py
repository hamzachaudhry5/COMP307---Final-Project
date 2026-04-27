from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlmodel import Session

from models.users import User
from database.session import get_session
from security import get_current_user
from services import calendar_service


router = APIRouter(prefix="/calendar", tags=["Calendar"])


@router.get("/export.ics")
def export_ical(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Exports all confirmed appointments as a .ics file.
    """
    ical_content = calendar_service.generate_ical(session, user)
    return Response(
        content=ical_content,
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="socs_bookings.ics"'},
    )
