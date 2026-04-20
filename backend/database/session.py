import os
from fastapi import Depends, HTTPException
from sqlmodel import Session, create_engine
 
from models.users import User, UserRole

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/booking_db")

engine = create_engine(DATABASE_URL)

def get_session():
    with Session(engine) as session:
        yield session

def get_current_user() -> User:
    # Expected: decode JWT, look up User by user_id, return User or raise 401.
    raise NotImplementedError("Implement with your teammate's auth module")
 
 
def get_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.owner:
        raise HTTPException(403, "Only owners (@mcgill.ca) can perform this action")
    return current_user