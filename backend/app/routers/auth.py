from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.controllers import auth as auth_controller
from app.db import get_session
from app.schemas.auth import SignupPayload, LoginPayload, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(
    payload: SignupPayload,
    session: Session = Depends(get_session),
):
    return auth_controller.Signup_User(session, payload)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginPayload,
    session: Session = Depends(get_session),
):
    return auth_controller.Login_User(session, payload)
