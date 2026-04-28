from typing import Optional, TYPE_CHECKING
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlmodel import Field, Relationship, SQLModel

# Runtime imports for Pydantic forward references
from models.slots import BookingSlotRead
from models.meeting_requests import MeetingRequesterRead

if TYPE_CHECKING:
    from models.slots import BookingSlot
    from models.users import User

### Reservation 
class ReservationBase(SQLModel):
    slot_id: int = Field(foreign_key="booking_slots.id", ondelete="CASCADE")
    user_id: int = Field(foreign_key="user.user_id")


class Reservation(ReservationBase, table=True):
    __tablename__ = "reservations"

    id: Optional[int] = Field(default=None, primary_key=True)
    reserved_at: datetime = Field(default_factory=lambda: datetime.now(ZoneInfo("America/Toronto")))

    slot: Optional["BookingSlot"] = Relationship(back_populates="reservations")
    user: Optional["User"] = Relationship(back_populates="reservations")


class ReservationRead(SQLModel):
    id: int
    slot_id: int
    user_id: int
    reserved_at: datetime
    slot: Optional["BookingSlotRead"] = None
    user: Optional["MeetingRequesterRead"] = None

    class Config:
        from_attributes = True
