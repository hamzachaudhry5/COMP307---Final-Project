from fastapi import APIRouter, Depends, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from database.session import get_session
from models.users import User, UserCreate, UserRead, Token
from security import get_current_user
from services import auth_service

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=UserRead)
def register(user_in: UserCreate, db: Session = Depends(get_session)):
    return auth_service.register_user(user_in, db)


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_session)):
    return auth_service.login_user(form_data, db)


@router.get("/me", response_model=UserRead)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/refresh", response_model=Token)
def refresh_token(refresh_token: str = Body(..., embed=True), db: Session = Depends(get_session)):
    """Exchange a refresh token for a new access token."""
    return auth_service.refresh_token_service(refresh_token, db)


@router.post("/logout")
def logout(refresh_token: str = Body(..., embed=True), db: Session = Depends(get_session)):
    """Revoke a refresh token (logout)."""
    auth_service.logout_user(refresh_token, db)
    return {"message": "Successfully logged out"}


@router.get("/users", response_model=list[UserRead])
def list_all_users(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Returns all registered users except the current user."""
    return auth_service.list_users(db, current_user)
