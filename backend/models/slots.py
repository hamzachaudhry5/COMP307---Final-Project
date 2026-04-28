from typing import Optional, TYPE_CHECKING
from datetime import datetime
from enum import Enum
from zoneinfo import ZoneInfo
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from models.reservations import Reservation

### Enums
class SlotType(str, Enum):
    GENERAL_SLOT = "general slot"
    GROUP = "group meeting"
    OFFICE_HOURS = "office hours"


class SlotStatus(str, Enum):
    PRIVATE = "private"
    ACTIVE = "active"
    FULL = "full"


class RequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


### BookingSlot 
class BookingSlotBase(SQLModel):
    title: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)
    slot_type: SlotType
    start_time: datetime
    end_time: datetime
    is_recurring: bool = False
    recurrence_weeks: Optional[int] = Field(default=None, ge=1, le=52)
    max_participants: Optional[int] = Field(default=1, ge=1)
    batch_id: Optional[str] = Field(default=None, index=True)


class BookingSlot(BookingSlotBase, table=True):
    __tablename__ = "booking_slots"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.user_id")
    status: SlotStatus = SlotStatus.PRIVATE
    group_meeting_id: Optional[int] = Field(default=None, foreign_key="group_meetings.id", ondelete="CASCADE")
    created_at: datetime = Field(default_factory=lambda: datetime.now(ZoneInfo("America/Toronto")))

    # Relationships
    owner: Optional["User"] = Relationship(back_populates="owned_slots")
    reservations: list["Reservation"] = Relationship(back_populates="slot", cascade_delete=True)
    

class BookingSlotRead(BookingSlotBase):
    id: int
    owner_id: int
    status: SlotStatus
    group_meeting_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BookingSlotUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[SlotStatus] = None


class BookingSlotCreate(BookingSlotBase):
    pass


class BookingSlotBulkCreate(SQLModel):
    slots: list[BookingSlotCreate]
    