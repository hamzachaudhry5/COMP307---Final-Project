from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from datetime import timedelta

<<<<<<< HEAD
from database import get_session
=======
from database import get_db
>>>>>>> 33a8401 (added jwt tokens for authentication)
from models.users import User, UserCreate, UserRead, Token
from security import (
    hash_password, 
    verify_password, 
    create_access_token, 
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=UserRead)
def register(user_in: UserCreate, db: Session = Depends(get_session)):
    existing = db.exec(select(User).where(User.email == user_in.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        role=User.resolve_role(user_in.email),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
<<<<<<< HEAD
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_session)):
=======
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
>>>>>>> 33a8401 (added jwt tokens for authentication)
    user = db.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserRead)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
