from fastapi import APIRouter
from app.routers import candidates, auth

router = APIRouter(
    prefix="/api/v1"
)

#handle different routes for API
router.include_router(auth.router)
router.include_router(candidates.router)
