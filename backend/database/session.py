import os
from fastapi import Depends, HTTPException
from sqlmodel import Session, create_engine
 
from models.users import User, UserRole

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/booking_db")

engine = create_engine(DATABASE_URL)

def get_session():
    with Session(engine) as session:
        yield session
        