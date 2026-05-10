

import asyncio
import json
from datetime import datetime, timezone

from sqlmodel import Session, select, func
from app.models import Candidate, Score
from app.schemas.candidates import CreateScorePayload, CreateCandidatePayload
from fastapi import HTTPException, Request


# define candidates controller
def Get_Candidates_List(session: Session, page: int, limit: int):
    offset = (page - 1) * limit

    # total rows (for pagination metadata)
    total = session.exec(select(func.count()).select_from(Candidate)).one()

    # page of rows
    rows = session.exec(
        select(Candidate)
        .order_by(Candidate.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    total_pages = (total + limit - 1) // limit  # ceil division

    return {
        "data": rows,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }


def Create_Candidate(session: Session, payload: CreateCandidatePayload):
    # block duplicate emails so seed runs are idempotent and admins don't
    # create two records for the same person
    existing = session.exec(
        select(Candidate).where(Candidate.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Candidate with email {payload.email} already exists",
        )

    new_candidate = Candidate(
        name=payload.name,
        email=payload.email,
        status=payload.status,
        skills=payload.skills,
        internal_notes=payload.internal_notes,
    )
    session.add(new_candidate)
    session.commit()
    session.refresh(new_candidate)
    return new_candidate


def Get_Candidate_By_Id ( session : Session , id : int):

    req_candidate = session.get( Candidate , id )

    if not req_candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    return req_candidate


def Create_Score_To_User(
    session: Session,
    candidate_id: int,
    reviewer_id: int,
    payload: CreateScorePayload,
):
    # make sure the candidate exists
    candidate = session.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    new_score = Score(
        candidate_id=candidate_id,
        reviewer_id=reviewer_id,
        category=payload.category,
        score=payload.score,
        note=payload.note,
    )

    session.add(new_score)
    session.commit()
    session.refresh(new_score)

    return new_score


async def Generate_Candidate_Summary(session: Session, candidate_id: int):
    candidate = session.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # collect this candidate's scores to feed the "LLM"
    scores = session.exec(
        select(Score).where(Score.candidate_id == candidate_id)
    ).all()
    avg = (sum(s.score for s in scores) / len(scores)) if scores else 0

    # simulate an async LLM call
    await asyncio.sleep(2)

    summary_text = (
        f"{candidate.name} ({candidate.email}) is currently {candidate.status}. "
        f"Skills: {', '.join(candidate.skills) or 'none listed'}. "
        f"Reviewed {len(scores)} time(s) with an average score of {avg:.2f}/5."
    )

    return {
        "candidate_id": candidate_id,
        "summary": summary_text,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def Stream_Candidate_Scores(
    request: Request, session: Session, candidate_id: int
):
    # 404 up front before opening the stream
    if not session.get(Candidate, candidate_id):
        raise HTTPException(status_code=404, detail="Candidate not found")

    last_id = 0

    while True:
        # client closed the connection — stop streaming
        if await request.is_disconnected():
            break

        new_scores = session.exec(
            select(Score)
            .where(Score.candidate_id == candidate_id, Score.id > last_id)
            .order_by(Score.id)
        ).all()

        for s in new_scores:
            last_id = s.id
            payload = {
                "id": s.id,
                "category": s.category,
                "score": s.score,
                "reviewer_id": s.reviewer_id,
                "note": s.note,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            yield f"event: score\ndata: {json.dumps(payload)}\n\n"

        # heartbeat so proxies don't kill the connection while idle
        yield ": keepalive\n\n"
        await asyncio.sleep(1)