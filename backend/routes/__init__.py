from fastapi import APIRouter
from .authentication import router as authentication_router
from .slots import router as slots_router
from .reservations import router as reservation_router
from .group_meetings import router as group_meetings_router
from .meeting_requests import router as meeting_requests_router
from .calendar import router as calendar_router

router = APIRouter()
router.include_router(authentication_router)
router.include_router(slots_router)
router.include_router(reservation_router)
router.include_router(group_meetings_router)
router.include_router(meeting_requests_router)
router.include_router(calendar_router)