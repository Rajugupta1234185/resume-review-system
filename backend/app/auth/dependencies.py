from fastapi import Depends, HTTPException, status
from .security import security
from .utils import decode_jwt_token

def get_current_user(credentials = Depends(security)):
    token = credentials.credentials
    user = decode_jwt_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    return user