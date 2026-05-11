import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

# Build a single shared in-memory SQLite engine for the test session.
# StaticPool keeps one connection alive so the schema/data persist across sessions.
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Patch the app's engine before importing the FastAPI app so its
# startup hook (init_db) and any module-level usage all hit the test DB.
from app import db as app_db  # noqa: E402

app_db.engine = test_engine

from app.db import get_session  # noqa: E402
from app.main import app  # noqa: E402


def _override_get_session():
    with Session(test_engine) as session:
        yield session


app.dependency_overrides[get_session] = _override_get_session


@pytest.fixture(autouse=True)
def _reset_db():
    SQLModel.metadata.create_all(test_engine)
    yield
    SQLModel.metadata.drop_all(test_engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _signup(client: TestClient, email: str, role: str = "reviewer") -> dict:
    resp = client.post(
        "/api/v1/auth/signup",
        json={
            "full_name": f"User {email}",
            "email": email,
            "password": "Password@123",
            "role": role,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture
def reviewer_a_token(client) -> str:
    return _signup(client, "reviewer.a@example.com")["access_token"]


@pytest.fixture
def reviewer_b_token(client) -> str:
    return _signup(client, "reviewer.b@example.com")["access_token"]


@pytest.fixture
def admin_token(client) -> str:
    return _signup(client, "admin@example.com", role="admin")["access_token"]
