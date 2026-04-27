import os
from fastapi import Depends, HTTPException
from sqlmodel import Session, create_engine
from dotenv import load_dotenv
from models.users import User, UserRole

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

engine = create_engine(DATABASE_URL)

def get_session():
    with Session(engine) as session:
        yield session
