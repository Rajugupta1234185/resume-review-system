from sqlmodel import SQLModel, Field, Relationship
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import Column, JSON
from enum import Enum


# define enum for Role
class Role(str, Enum):
    admin = "admin"
    reviewer = "reviewer"


# define enum for candidate_status
class Candidate_Status(str, Enum):
    new = "new"
    reviewed = "reviewed"
    hired = "hired"
    rejected = "rejected"


# define candidate table
class Candidate(SQLModel, table=True):
    __tablename__ = "candidates"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str
    status: Candidate_Status = Candidate_Status.new  # new | reviewed | hired | rejected
    skills: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    internal_notes: Optional[str] = Field(default=None, max_length=50)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# new class and table for candidate score
class Score(SQLModel, table=True):
    __tablename__ = "scores"

    id: Optional[int] = Field(default=None, primary_key=True)
    candidate_id: int = Field(foreign_key="candidates.id")
    category: str
    score: int = Field(ge=0, le=5)
    reviewer_id: int = Field(foreign_key="users.id")
    note: Optional[str] = Field(default=None, max_length=20)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# class for user -- user can be admin or reviewer
class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str
    role: Role
    email: str
    password: str
