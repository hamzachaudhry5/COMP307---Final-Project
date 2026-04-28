# Sean Xu

from typing import Optional
from datetime import datetime
from enum import Enum
from zoneinfo import ZoneInfo
from sqlmodel import Field, SQLModel


class RequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


### MeetingRequest 
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
    booking_slot_id: Optional[int] = Field(default=None, foreign_key="booking_slots.id", ondelete="CASCADE")
    created_at: datetime = Field(default_factory=lambda: datetime.now(ZoneInfo("America/Toronto")))


class MeetingRequestCreate(MeetingRequestBase):
    pass


class MeetingRequesterRead(SQLModel):
    user_id: int
    email: str
    first_name: str
    last_name: str

    class Config:
        from_attributes = True


class MeetingRequestRead(MeetingRequestBase):
    id: int
    requester_id: int
    status: RequestStatus
    created_at: datetime
    requester: Optional[MeetingRequesterRead] = None

    class Config:
        from_attributes = True