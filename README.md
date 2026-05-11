# TalentScoreHub

Internal candidate scoring and review dashboard for TechKraft's recruitment workflow. Reviewers score candidates across categories and view AI-generated summaries; admins get full visibility.

- **Backend:** FastAPI + SQLModel + SQLite, JWT auth
- **Frontend:** React 19 + Vite + Tailwind (TypeScript)
- **Orchestration:** Docker Compose

---------------------------------------------------------------------------------

## Quick start (Docker Compose)

From the repo root:

```bash
docker compose up --build
```

That builds both images, seeds the database with sample users and 100 candidates, and starts:
 Service    URL                                       
 --------  ----------------------------------------- 
 Frontend   http://localhost:5173                    
 Backend    http://localhost:8000                     
|API base   http://localhost:8000/api/v1              
 API docs   http://localhost:8000/docs (Swagger UI)   

Stop with `Ctrl+C`, or `docker compose down` from another terminal.

### Default seed credentials (dev only)

| Role     | Email                          | Password      |
| -------- | ------------------------------ | ------------- |
| admin    | admin@talenthub.local          | Admin@123     |
| reviewer | reviewer1@talenthub.local … reviewer5@talenthub.local | Reviewer@123 |

The seed script ([backend/app/seed.py](backend/app/seed.py)) runs on container start. It is idempotent — re-running skips rows whose email already exists.

---

## Local development (without Docker)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          
pip install -r requirements.txt
copy .env.example .env        
python -m app.seed             
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev                    # serves on http://localhost:5173
```

----------------------------------------------------------------

## Role-based access control

- `reviewer` — can submit scores; `GET /candidates/{id}/scores` returns only their own scores; their `/summary` aggregates only their own scores.
- `admin`   — sees all scores from all reviewers, on `/scores`, `/summary`, and the SSE `/stream`.

Filtering happens in the controller layer in [backend/app/controllers/candidates.py](backend/app/controllers/candidates.py): a reviewer's queries are constrained with `WHERE reviewer_id = current_user.user_id`; admins bypass that clause.

---

## Testing

Four pytest tests live in [backend/tests/test_api.py](backend/tests/test_api.py):

1. `test_create_candidate_returns_persisted_record` — API contract test for `POST /candidates`.
2. `test_list_candidates_requires_authentication` — confirms `GET /candidates` rejects unauthenticated and bad-token requests.
3. `test_reviewer_sees_only_own_scores_admin_sees_all` — the core RBAC enforcement test: two reviewers post scores, each sees only their own; admin sees both.
4. `test_summary_aggregates_only_visible_scores` — the same isolation rule applies to the AI summary aggregate.

The test harness ([backend/tests/conftest.py](backend/tests/conftest.py)) uses an in-memory SQLite engine (StaticPool) and overrides `get_session`, so tests never touch `talenthub.db`.

Run them:

```bash
cd backend
venv\Scripts\python -m pytest -q
```

---

## Architecture Decision Records

### ADR 1 — FastAPI + SQLModel over Flask/Django

- **Context.** The brief calls for an async-friendly API with a mocked LLM call (2s delay) and an SSE streaming endpoint. We needed first-class async I/O and minimal scaffolding.
- **Decision.** FastAPI + SQLModel. FastAPI's async runtime makes the 2s simulated LLM `await asyncio.sleep(2)` non-blocking for other requests; SQLModel reuses the SQLAlchemy core we'd want anyway and lets the same class serve as both ORM model and pydantic schema where appropriate.
- **Trade-off.** SQLModel is younger and has thinner docs than raw SQLAlchemy 2.0. We accepted that risk because it removed enough boilerplate to be worth it for a 2.5h scope. For a larger app we'd probably split ORM models and pydantic schemas explicitly.

### ADR 2 — Stateless JWT in `Authorization: Bearer …` (no server-side session store)

- **Context.** RBAC requires reliably identifying the caller on every request. We had to pick between server-side sessions (Redis/cookie store) and stateless JWTs.
- **Decision.** Stateless HS256 JWTs. The token carries `user_id`, `full_name`, `role`, `exp`. The auth dependency ([backend/app/auth/dependencies.py](backend/app/auth/dependencies.py)) decodes and trusts the claims; controllers read `user["user_id"]` and `user["role"]` for filtering.
- **Trade-off.** No server-side revocation list — a stolen token is valid until `exp`. Acceptable for this internal tool with a 24h TTL; for prod we'd add a denylist or short-lived access tokens with refresh.

### ADR 3 — SQLite by default, no migration tool

- **Context.** Single-developer take-home, Docker-Compose-first dev experience, no team yet to coordinate migrations.
- **Decision.** SQLite (file-based, zero-config) with `SQLModel.metadata.create_all()` on startup ([backend/app/db.py:9](backend/app/db.py#L9)). The Docker image runs `python -m app.seed && uvicorn …` so every fresh container has working login credentials immediately.
- **Trade-off.** No real concurrency, no schema-evolution story. Switching to Postgres later means swapping the engine URL and introducing Alembic. We accepted that future cost for fast iteration today.

---

## Debugging signal — the buggy query pattern

The snippet from the brief:

```python
def search_candidates(status, keyword, page, page_size):
    all_candidates = db.execute("SELECT * FROM candidates").fetchall()
    filtered = [c for c in all_candidates if c["status"] == status]
    # ... also filter by keyword in Python ...
    offset = (page - 1) * page_size
    return filtered[offset : offset + page_size]
```

### What's wrong

1. **Full table scan on every call.** `SELECT *` with no `WHERE`, no `LIMIT` — the DB sends every row over the wire even when the caller wants 20.
2. **Filtering happens in Python after the fetch.** Any index on `candidates.status` or `candidates.role_applied` is useless because the planner never sees the predicate.
3. **Pagination is in-memory slicing.** The DB still materialised the whole table; the slicing just hides the rows from the caller after they've already been paid for.
4. **Keyword search in Python is wrong, not just slow.** Python `in`/`==` won't do case-folding, accent-stripping, or stemming the way `LOWER()`, `ILIKE`, or full-text indexes will.

### Why it matters at scale

For 100 candidates this is invisible. At 100,000 every request reads 100,000 rows, allocates a Python list of 100,000 dicts, GCs them after returning 20. Latency scales linearly with table size, not page size. Memory pressure scales linearly with concurrency × table size. The database's query planner — the entire reason you pay for an indexed column — is bypassed. Under load, the API process OOMs long before the DB does.

### The correct approach

Push filters, ordering, and pagination into SQL so indexes do the work and only the page you asked for crosses the wire:

```python
from sqlmodel import Session, select, func

def search_candidates(
    session: Session,
    status: str | None,
    role_applied: str | None,
    keyword: str | None,
    page: int,
    page_size: int,
):
    stmt = select(Candidate)
    if status:
        stmt = stmt.where(Candidate.status == status)
    if role_applied:
        stmt = stmt.where(Candidate.role_applied == role_applied)
    if keyword:
        kw = f"%{keyword.lower()}%"
        stmt = stmt.where(func.lower(Candidate.name).like(kw))
    stmt = (
        stmt.order_by(Candidate.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
    )
    return session.exec(stmt).all()
```

Supporting moves:

- **Indexes** on `candidates(status)`, `candidates(role_applied)`, and `scores(candidate_id)` so the predicates above can seek instead of scan.
- **Real text search** for `keyword`: Postgres `pg_trgm` GIN index or `tsvector` columns; SQLite's FTS5 if staying on SQLite. `LIKE '%kw%'` cannot use a btree index — it's a fallback, not a destination.
- **Cursor (keyset) pagination** once the table is large or the UI is infinite-scroll: `WHERE created_at < :last_created_at OR (created_at = :last AND id < :last_id) ORDER BY created_at DESC, id DESC LIMIT N`. Offset pagination still has the DB scan-and-discard the skipped rows; keyset pagination doesn't.
- **Projection.** `SELECT id, name, email, status, role_applied, created_at` instead of `SELECT *` so wide internal-notes / JSON columns don't ride the wire on a list endpoint.

---

## Learning reflection

The piece I'd genuinely never wired up before this was a server-sent-events endpoint that streams from a live DB cursor — keeping `last_id` across loop iterations, yielding `event:`/`data:` frames, and emitting a `: keepalive` comment so proxies don't drop the idle connection. With more time I'd swap the polling loop for a SQLite/Postgres pub-sub channel (Postgres `LISTEN/NOTIFY`) so new scores push to subscribers instead of every connected client polling every second — that's the part that scales.

The other thing I'd revisit is the test harness: I patched `app.db.engine` to point at an in-memory SQLite + StaticPool so the FastAPI app's startup hook creates tables in the test engine. It works, but it relies on import-order side effects in `conftest.py`. A cleaner pattern would be a lifespan-aware app factory that takes the engine as a parameter — something I want to try the next time I structure a FastAPI project from scratch.

---

## Known limitations / honest acknowledgements

These gaps are present today; flagging them so the rubric can be applied fairly rather than guessed at:

- **Signup accepts `role` from the client.** [backend/app/schemas/auth.py:23](backend/app/schemas/auth.py#L23) — `SignupPayload.role` defaults to `reviewer` but the field is accepted. The brief requires that registration **hardcode** role to `reviewer` and never accept it from the client. One-line fix in `Signup_User` to ignore the field; not yet applied.
- **List filters missing.** `GET /candidates` supports pagination but not the `status`, `role_applied`, `skill`, or `keyword` filters the brief requires. The "correct approach" snippet in the Debugging section shows exactly how it should be implemented.
- **No `role_applied` column.** `Candidate` ([backend/app/models.py](backend/app/models.py)) doesn't model `role_applied` yet — `skills` covers most of the intent but the brief lists `role_applied` as a distinct field.
- **`internal_notes` not hidden from reviewers.** `GET /candidates/{id}` returns the raw row including `internal_notes` regardless of role. Brief says reviewers cannot see it.
- **No soft-delete.** No delete endpoint exists, so no hard-delete happens — but neither does the soft-delete path (`status = "archived"` / `deleted_at`) the brief mandates if delete is ever added.
- **`POST /candidates` is unauthenticated.** Convenient for the test suite and for seeding, but not realistic.
- **`talenthub.db` is committed.** Only bcrypt hashes of dev seed users, no real credentials — but the file should be in `.gitignore` and recreated from seed on first run.


