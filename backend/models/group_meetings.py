from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlmodel import Field, Relationship, SQLModel
from sqlalchemy import Column, Integer, ForeignKey

### GroupMeeting 
class GroupMeetingBase(SQLModel):
    title: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)


class GroupMeeting(GroupMeetingBase, table=True):
    __tablename__ = "group_meetings"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.user_id")
    is_finalized: bool = False
    # Use sa_column with use_alter=True to break the circular dependency between booking_slots and group_meetings
    finalized_slot_id: Optional[int] = Field(
        default=None, 
        sa_column=Column(
            Integer, 
            ForeignKey("booking_slots.id", ondelete="SET NULL", use_alter=True, name="fk_group_meetings_finalized_slot_id")
        )
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(ZoneInfo("America/Toronto")))

    availability_options: list["GroupAvailabilityOption"] = Relationship(back_populates="meeting", cascade_delete=True)
    votes: list["GroupVote"] = Relationship(back_populates="meeting", cascade_delete=True)


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
    meeting_id: int = Field(foreign_key="group_meetings.id", ondelete="CASCADE")
    vote_count: int = Field(default=0)

    meeting: Optional[GroupMeeting] = Relationship(back_populates="availability_options")
    votes: list["GroupVote"] = Relationship(back_populates="option", cascade_delete=True)


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
    meeting_id: int = Field(foreign_key="group_meetings.id", ondelete="CASCADE")
    option_id: int = Field(foreign_key="group_availability_options.id", ondelete="CASCADE")
    user_id: int = Field(foreign_key="user.user_id")

    meeting: Optional[GroupMeeting] = Relationship(back_populates="votes")
    option: Optional[GroupAvailabilityOption] = Relationship(back_populates="votes")


class GroupVoteCreate(SQLModel):
    option_ids: list[int]  # user can select multiple available time slots


class GroupMeetingInvite(SQLModel, table=True):
    __tablename__ = "group_meeting_invites"

    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: int = Field(foreign_key="group_meetings.id", ondelete="CASCADE")
    user_id: int = Field(foreign_key="user.user_id")
