from typing import Optional
from datetime import datetime
from pydantic import BaseModel, field_validator
from sqlmodel import Field, SQLModel
import enum


class UserRole(str, enum.Enum):
    owner = "owner"
    user = "user"


class User(SQLModel, table=True):
    user_id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    first_name: str
    last_name: str
    role: UserRole = Field(default=UserRole.user)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    @staticmethod
    def resolve_role(email: str) -> UserRole:
        if email.endswith("@mcgill.ca"):
            return UserRole.owner
        return UserRole.user

class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str

    @field_validator("email")
    @classmethod
    def must_be_mcgill(cls, v):
        if not (v.endswith("@mcgill.ca") or v.endswith("@mail.mcgill.ca")):
            raise ValueError("Only McGill emails allowed.")
        return v


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class UserRead(BaseModel):
    user_id: int
    email: str
    first_name: str
    last_name: str
    role: UserRole

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None