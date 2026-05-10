import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

# move these to env vars in production!
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_SECONDS = 60 * 60 * 24  # 24 hours


def hash_password(plain: str) -> str:
    # bcrypt has a hard 72-byte limit; the schema enforces this at the API edge
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # malformed hash in DB
        return False


def create_jwt_token(*, user_id: int, full_name: str, role: str) -> tuple[str, int]:
    expires_in = JWT_EXPIRES_SECONDS
    payload = {
        "user_id": user_id,
        "full_name": full_name,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, expires_in


def decode_jwt_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
