from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from datetime import datetime, timedelta

from database.session import get_session
from models.users import User, UserCreate, UserRead, Token, RefreshToken
from security import (
    hash_password, 
    verify_password, 
    create_access_token, 
    create_refresh_token,
    verify_refresh_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS
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
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_session)):
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
    
    # Create and store refresh token
    refresh_token = create_refresh_token(data={"sub": user.email})
    refresh_token_obj = RefreshToken(
        token=refresh_token,
        user_id=user.user_id,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_obj)
    db.commit()
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.get("/me", response_model=UserRead)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/refresh", response_model=Token)
def refresh_token(refresh_token: str = Body(..., embed=True), db: Session = Depends(get_session)):
    """Exchange a refresh token for a new access token."""
    # Verify the refresh token
    payload = verify_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
        )
    
    # Check if refresh token exists in database and is not revoked
    stored_token = db.exec(
        select(RefreshToken).where(
            RefreshToken.token == refresh_token,
            RefreshToken.revoked == False
        )
    ).first()
    
    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found or revoked",
        )
    
    if stored_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )
    
    # Get user
    user = db.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    # Generate new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    # Optionally rotate refresh token (generate new one and revoke old)
    new_refresh_token = create_refresh_token(data={"sub": user.email})
    
    # Revoke old refresh token
    stored_token.revoked = True
    db.add(stored_token)
    
    # Store new refresh token
    new_refresh_token_obj = RefreshToken(
        token=new_refresh_token,
        user_id=user.user_id,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(new_refresh_token_obj)
    db.commit()
    
    return {"access_token": access_token, "refresh_token": new_refresh_token, "token_type": "bearer"}


@router.post("/logout")
def logout(refresh_token: str = Body(..., embed=True), db: Session = Depends(get_session)):
    """Revoke a refresh token (logout)."""
    stored_token = db.exec(
        select(RefreshToken).where(RefreshToken.token == refresh_token)
    ).first()
    
    if stored_token:
        stored_token.revoked = True
        db.add(stored_token)
        db.commit()
    
    return {"message": "Successfully logged out"}


@router.get("/users", response_model=list[UserRead])
def list_all_users(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Returns all registered users except the current user."""
    return db.exec(
        select(User).where(User.user_id != current_user.user_id)
    ).all()
