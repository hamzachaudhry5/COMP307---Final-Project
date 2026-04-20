from sqlmodel import Session, create_engine
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/booking_db")

engine = create_engine(DATABASE_URL)

def get_db():
    with Session(engine) as session:
        yield session