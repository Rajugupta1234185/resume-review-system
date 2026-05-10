from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.routers import mainRoutes
from app.db import init_db

app = FastAPI(
    title="Talent Hub Score board",
    description="Internal candidates scoring and workflow for recruitments workflow",
    version="1.0.0",
)


@app.on_event("startup")
def on_startup():
    init_db()



# add cors
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
)

#handler for global exception
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )

# register routes
app.include_router(mainRoutes.router)
