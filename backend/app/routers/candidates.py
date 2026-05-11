from fastapi import APIRouter, Depends, Query, Path, Body, Request
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.controllers import candidates
from app.auth.dependencies import get_current_user
from app.db import get_session
from app.schemas.candidates import CreateScorePayload, CreateCandidatePayload

router = APIRouter(tags=["candidates"])


@router.post("/candidates", status_code=201)
def create_candidate(
    payload: CreateCandidatePayload = Body(...),
    session: Session = Depends(get_session),
):
    return candidates.Create_Candidate(session=session, payload=payload)


@router.get("/candidates")
def get_candidates(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    return candidates.Get_Candidates_List(session, page, limit)


@router.get("/candidates/{candidate_id}")
def get_candidate_by_id(
    candidate_id: int = Path(ge=1),
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    return candidates.Get_Candidate_By_Id(session, candidate_id)


@router.post("/candidates/{candidate_id}/scores")
def post_score_to_candidate(
    candidate_id: int = Path(ge=1),
    payload: CreateScorePayload = Body(...),
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    return candidates.Create_Score_To_User(
        session=session,
        candidate_id=candidate_id,
        reviewer_id=user["user_id"],
        payload=payload,
    )


@router.get("/candidates/{candidate_id}/scores")
def get_scores_for_candidate(
    candidate_id: int = Path(ge=1),
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    return candidates.Get_Scores_For_Candidate(session, candidate_id, user)


@router.post(
    "/candidates/{candidate_id}/summary",
    dependencies=[Depends(get_current_user)],
)
async def post_candidate_summary(
    candidate_id: int = Path(ge=1),
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    return await candidates.Generate_Candidate_Summary(session, candidate_id, user)


@router.get(
    "/candidates/{candidate_id}/stream",
    dependencies=[Depends(get_current_user)],
   
)
async def stream_candidate_scores(
    request: Request,
    candidate_id: int = Path(ge=1),
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    return StreamingResponse(
        candidates.Stream_Candidate_Scores(request, session, candidate_id, user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable buffering on nginx
        },
    )
