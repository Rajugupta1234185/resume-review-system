"""
Seed sample users (1 admin, 5 reviewers) and 100 candidates into the database.

Usage (from the `backend/` directory):
    python -m app.seed

Re-running is safe: rows whose email already exists are skipped.

Default passwords (dev only — change for any real environment):
    admin:    admin@talenthub.local       / Admin@123
    reviewer: reviewer{1..5}@talenthub.local / Reviewer@123
"""

import random

from sqlmodel import Session, select

from app.auth.utils import hash_password
from app.db import engine, init_db
from app.models import Candidate, Candidate_Status, Role, User


ADMIN_PASSWORD = "Admin@123"
REVIEWER_PASSWORD = "Reviewer@123"


ADMIN = {
    "full_name": "Admin User",
    "email": "admin@talenthub.local",
    "role": Role.admin,
    "password": ADMIN_PASSWORD,
}

REVIEWERS = [
    {
        "full_name": f"Reviewer {i}",
        "email": f"reviewer{i}@talenthub.local",
        "role": Role.reviewer,
        "password": REVIEWER_PASSWORD,
    }
    for i in range(1, 6)
]


FIRST_NAMES = [
    "Aarav", "Priya", "Rohan", "Sita", "Bikash", "Anjali", "Nirajan", "Manisha",
    "Kiran", "Sunita", "Pradip", "Sabina", "Hari", "Rita", "Sandesh", "Pooja",
    "Dipesh", "Nisha", "Sagar", "Asha", "Bishal", "Sarita", "Suman", "Kabita",
    "Prakash", "Laxmi", "Ramesh", "Bina", "Dipak", "Sneha", "Yogesh", "Reena",
    "Mohan", "Kalpana", "Santosh", "Mina", "Naresh", "Geeta", "Bibek", "Indira",
]

LAST_NAMES = [
    "Sharma", "Patel", "Gurung", "Thapa", "Karki", "Rai", "Shrestha", "Lama",
    "Adhikari", "Magar", "Tamang", "Bhattarai", "Pokharel", "Khadka", "Limbu",
    "Maharjan", "Dahal", "Acharya", "Subedi", "Basnet",
]

SKILL_POOL = [
    "python", "fastapi", "django", "flask",
    "javascript", "typescript", "react", "next.js", "vite", "tailwind",
    "node", "express", "nestjs",
    "go", "rust", "java", "spring", "kotlin",
    "postgresql", "mysql", "mongodb", "redis", "sqlite",
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform",
    "graphql", "rest", "grpc", "kafka", "rabbitmq",
]

STATUS_POOL = [
    Candidate_Status.new,
    Candidate_Status.new,
    Candidate_Status.new,
    Candidate_Status.reviewed,
    Candidate_Status.reviewed,
    Candidate_Status.hired,
    Candidate_Status.rejected,
]

NOTE_POOL = [
    None, None, None,
    "Strong profile",
    "Needs follow-up",
    "Good culture fit",
    "Mismatch on role",
    "Onboarded recently",
    "Technical screen passed",
]


def build_candidates(count: int):
    rng = random.Random(42)  # deterministic seed for reproducible data
    candidates = []
    used_emails = set()

    i = 0
    while len(candidates) < count:
        first = rng.choice(FIRST_NAMES)
        last = rng.choice(LAST_NAMES)
        email = f"{first}.{last}.{i}@example.com".lower()
        i += 1
        if email in used_emails:
            continue
        used_emails.add(email)

        skills = rng.sample(SKILL_POOL, k=rng.randint(2, 5))
        candidates.append({
            "name": f"{first} {last}",
            "email": email,
            "status": rng.choice(STATUS_POOL),
            "skills": skills,
            "internal_notes": rng.choice(NOTE_POOL),
        })
    return candidates


def seed_users(session: Session):
    inserted = 0
    skipped = 0

    all_users = [ADMIN, *REVIEWERS]
    for entry in all_users:
        existing = session.exec(
            select(User).where(User.email == entry["email"])
        ).first()
        if existing:
            skipped += 1
            continue

        session.add(User(
            full_name=entry["full_name"],
            email=entry["email"],
            role=entry["role"],
            password=hash_password(entry["password"]),
        ))
        inserted += 1

    session.commit()
    return inserted, skipped


def seed_candidates(session: Session, count: int = 100):
    inserted = 0
    skipped = 0

    for entry in build_candidates(count):
        existing = session.exec(
            select(Candidate).where(Candidate.email == entry["email"])
        ).first()
        if existing:
            skipped += 1
            continue

        session.add(Candidate(**entry))
        inserted += 1

    session.commit()
    return inserted, skipped


def seed():
    init_db()

    with Session(engine) as session:
        u_inserted, u_skipped = seed_users(session)
        c_inserted, c_skipped = seed_candidates(session, count=100)

    print(
        f"Seed complete. "
        f"users(inserted={u_inserted}, skipped={u_skipped}) "
        f"candidates(inserted={c_inserted}, skipped={c_skipped})"
    )
    print("Login credentials (dev only):")
    print(f"  admin    -> {ADMIN['email']} / {ADMIN_PASSWORD}")
    print(f"  reviewer -> reviewer1..5@talenthub.local / {REVIEWER_PASSWORD}")


if __name__ == "__main__":
    seed()
