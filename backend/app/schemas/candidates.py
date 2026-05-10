from typing import List, Optional
from pydantic import BaseModel, Field

from app.models import Candidate_Status

#define schema validation
class GetCandidateListWithPagination(BaseModel):
    page : int = Field ( default =1 , ge =1)
    limit: int = Field(default=20, ge=1, le=50)


class CreateScorePayload(BaseModel):
    category: str = Field(min_length=1, max_length=50)
    score: int = Field(ge=0, le=5)
    note: Optional[str] = Field(default=None, max_length=20)


class CreateCandidatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=200)
    status: Candidate_Status = Candidate_Status.new
    skills: List[str] = Field(default_factory=list)
    internal_notes: Optional[str] = Field(default=None, max_length=50)


class CandidateSummary(BaseModel):
    candidate_id: int
    summary: str
    generated_at: str
