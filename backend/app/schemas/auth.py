from pydantic import BaseModel, EmailStr, Field
from app.models import Role


class SignupPayload(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt caps at 72 bytes
    role: Role = Role.reviewer


class LoginPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
