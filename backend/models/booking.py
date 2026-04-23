from typing import Optional, TYPE_CHECKING
from datetime import datetime
from enum import Enum
from zoneinfo import ZoneInfo
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from models.users import User

### Enums
class SlotType(str, Enum):
    REQUEST = "request"
    GROUP = "group"
    OFFICE_HOURS = "office_hours"


class SlotStatus(str, Enum):
    PRIVATE = "private"
    ACTIVE = "active"
    BOOKED = "booked"
    CANCELLED = "cancelled"


class RequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class ReservationStatus(str, Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


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


class BookingSlot(BookingSlotBase, table=True):
    __tablename__ = "booking_slots"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.user_id")
    status: SlotStatus = SlotStatus.PRIVATE
    group_meeting_id: Optional[int] = Field(default=None, foreign_key="group_meetings.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(ZoneInfo("America/Toronto")))

    # Relationships
    owner: Optional["User"] = Relationship(back_populates="owned_slots")
    reservations: list["Reservation"] = Relationship(back_populates="slot")
    

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


class BookingSlotCreate(BookingSlotBase):
    pass


class BookingSlotBulkCreate(SQLModel):
    slots: list[BookingSlotCreate]


### Reservation 
class ReservationBase(SQLModel):
    slot_id: int = Field(foreign_key="booking_slots.id")
    user_id: int = Field(foreign_key="user.user_id")


class Reservation(ReservationBase, table=True):
    __tablename__ = "reservations"

    id: Optional[int] = Field(default=None, primary_key=True)
    status: ReservationStatus = ReservationStatus.CONFIRMED
    reserved_at: datetime = Field(default_factory=lambda: datetime.now(ZoneInfo("America/Toronto")))

    slot: Optional[BookingSlot] = Relationship(back_populates="reservations")
    user: Optional["User"] = Relationship(back_populates="reservations")


class ReservationRead(SQLModel):
    id: int
    slot_id: int
    user_id: int
    status: ReservationStatus
    reserved_at: datetime
    slot: Optional[BookingSlotRead] = None

    class Config:
        from_attributes = True


### GroupMeeting 
class GroupMeetingBase(SQLModel):
    title: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)


class GroupMeeting(GroupMeetingBase, table=True):
    __tablename__ = "group_meetings"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.user_id")
    is_finalized: bool = False
    finalized_slot_id: Optional[int] = Field(default=None, foreign_key="booking_slots.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(ZoneInfo("America/Toronto")))

    availability_options: list["GroupAvailabilityOption"] = Relationship(back_populates="meeting")
    votes: list["GroupVote"] = Relationship(back_populates="meeting")


class GroupMeetingCreate(GroupMeetingBase):
    options: list["GroupAvailabilityOptionBase"]
    invited_user_ids: list[int] = []


class GroupMeetingRead(GroupMeetingBase):
    id: int
    owner_id: int
    is_finalized: bool
    finalized_slot_id: Optional[int] = None
    created_at: datetime
    availability_options: list["GroupAvailabilityOptionRead"] = []

    class Config:
        from_attributes = True


### GroupAvailabilityOption 
class GroupAvailabilityOptionBase(SQLModel):
    start_time: datetime
    end_time: datetime


class GroupAvailabilityOption(GroupAvailabilityOptionBase, table=True):
    __tablename__ = "group_availability_options"

    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: int = Field(foreign_key="group_meetings.id")
    vote_count: int = Field(default=0)

    meeting: Optional[GroupMeeting] = Relationship(back_populates="availability_options")
    votes: list["GroupVote"] = Relationship(back_populates="option")


class GroupAvailabilityOptionRead(GroupAvailabilityOptionBase):
    id: int
    meeting_id: int
    vote_count: int

    class Config:
        from_attributes = True


### GroupVote 
class GroupVote(SQLModel, table=True):
    __tablename__ = "group_votes"

    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: int = Field(foreign_key="group_meetings.id")
    option_id: int = Field(foreign_key="group_availability_options.id")
    user_id: int = Field(foreign_key="user.user_id")

    meeting: Optional[GroupMeeting] = Relationship(back_populates="votes")
    option: Optional[GroupAvailabilityOption] = Relationship(back_populates="votes")


class GroupVoteCreate(SQLModel):
    option_ids: list[int]  # user can select multiple available time slots


class GroupMeetingInvite(SQLModel, table=True):
    __tablename__ = "group_meeting_invites"

    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: int = Field(foreign_key="group_meetings.id")
    user_id: int = Field(foreign_key="user.user_id")


### MeetingRequest (Type 1) 
class MeetingRequestBase(SQLModel):
    owner_id: int
    message: Optional[str] = Field(default=None, max_length=1000)
    start_time: datetime
    end_time: datetime
    

class MeetingRequest(MeetingRequestBase, table=True):
    __tablename__ = "meeting_requests"

    id: Optional[int] = Field(default=None, primary_key=True)
    requester_id: int = Field(foreign_key="user.user_id")
    owner_id: int = Field(foreign_key="user.user_id")
    status: RequestStatus = RequestStatus.PENDING
    booking_slot_id: Optional[int] = Field(default=None, foreign_key="booking_slots.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(ZoneInfo("America/Toronto")))


class MeetingRequestCreate(MeetingRequestBase):
    pass


class MeetingRequestRead(MeetingRequestBase):
    id: int
    requester_id: int
    status: RequestStatus
    created_at: datetime

    class Config:
        from_attributes = True


### Mailto schema 
class MailtoPayload(SQLModel):
    to: str
    subject: str
    body: str


class MailtoResponse(SQLModel):
    mailto: MailtoPayload


def build_mailto(to: str, subject: str, body: str) -> MailtoResponse:
    return MailtoResponse(mailto=MailtoPayload(to=to, subject=subject, body=body))