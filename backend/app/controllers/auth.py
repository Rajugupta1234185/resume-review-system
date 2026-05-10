from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import User
from app.schemas.auth import SignupPayload, LoginPayload
from app.auth.utils import (
    hash_password,
    verify_password,
    create_jwt_token,
)


def Signup_User(session: Session, payload: SignupPayload):
    # email must be unique
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    new_user = User(
        full_name=payload.full_name,
        email=payload.email,
        role=payload.role,
        password=hash_password(payload.password),
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    token, expires_in = create_jwt_token(
        user_id=new_user.id,
        full_name=new_user.full_name,
        role=new_user.role.value,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
    }


def Login_User(session: Session, payload: LoginPayload):
    user = session.exec(select(User).where(User.email == payload.email)).first()

    # same error for "no such user" and "wrong password" — don't leak which one
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token, expires_in = create_jwt_token(
        user_id=user.id,
        full_name=user.full_name,
        role=user.role.value,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
    }
