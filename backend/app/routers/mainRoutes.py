from fastapi import APIRouter
from app.routers import apiRoutes


# Centralize all top-level routers here
router = APIRouter()

router.include_router(apiRoutes.router)        # /api/v1/...

