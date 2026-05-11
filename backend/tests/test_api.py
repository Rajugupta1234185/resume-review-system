def _create_candidate(client, email: str = "test.candidate@example.com") -> dict:
    resp = client.post(
        "/api/v1/candidates",
        json={
            "name": "Test Candidate",
            "email": email,
            "status": "new",
            "skills": ["python", "fastapi"],
            "internal_notes": "promising",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_create_candidate_returns_persisted_record(client):
    body = _create_candidate(client)

    assert body["id"] is not None
    assert body["name"] == "Test Candidate"
    assert body["email"] == "test.candidate@example.com"
    assert body["status"] == "new"
    assert body["skills"] == ["python", "fastapi"]


def test_list_candidates_requires_authentication(client):
    _create_candidate(client)

    # No Authorization header -> HTTPBearer rejects with 403 (or 401 if configured).
    resp = client.get("/api/v1/candidates")
    assert resp.status_code in (401, 403)

    # Garbage token -> 401 from decode_jwt_token failure.
    resp = client.get(
        "/api/v1/candidates",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert resp.status_code == 401


def _post_score(client, candidate_id: int, token: str, score: int, note: str) -> dict:
    resp = client.post(
        f"/api/v1/candidates/{candidate_id}/scores",
        headers={"Authorization": f"Bearer {token}"},
        json={"category": "coding", "score": score, "note": note},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_reviewer_sees_only_own_scores_admin_sees_all(
    client, reviewer_a_token, reviewer_b_token, admin_token
):
    """Reviewer A and B each post a score for the same candidate.
    - Reviewer A's GET /scores must return only A's score.
    - Reviewer B's GET /scores must return only B's score.
    - Admin's GET /scores must return both."""
    candidate = _create_candidate(client)
    cid = candidate["id"]

    score_a = _post_score(client, cid, reviewer_a_token, score=4, note="solid")
    score_b = _post_score(client, cid, reviewer_b_token, score=2, note="weak")
    assert score_a["reviewer_id"] != score_b["reviewer_id"]

    # Reviewer A only sees A's score.
    resp = client.get(
        f"/api/v1/candidates/{cid}/scores",
        headers={"Authorization": f"Bearer {reviewer_a_token}"},
    )
    assert resp.status_code == 200, resp.text
    visible_to_a = resp.json()
    assert [s["id"] for s in visible_to_a] == [score_a["id"]]
    assert all(s["reviewer_id"] == score_a["reviewer_id"] for s in visible_to_a)

    # Reviewer B only sees B's score.
    resp = client.get(
        f"/api/v1/candidates/{cid}/scores",
        headers={"Authorization": f"Bearer {reviewer_b_token}"},
    )
    assert resp.status_code == 200, resp.text
    visible_to_b = resp.json()
    assert [s["id"] for s in visible_to_b] == [score_b["id"]]
    assert all(s["reviewer_id"] == score_b["reviewer_id"] for s in visible_to_b)

    # Admin sees both scores.
    resp = client.get(
        f"/api/v1/candidates/{cid}/scores",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    visible_to_admin = resp.json()
    assert {s["id"] for s in visible_to_admin} == {score_a["id"], score_b["id"]}


def test_summary_aggregates_only_visible_scores(
    monkeypatch, client, reviewer_a_token, reviewer_b_token, admin_token
):
    """Reviewer's summary aggregates only their own scores; admin's covers everyone."""
    # Skip the simulated LLM delay so the test stays fast.
    import asyncio
    from app.controllers import candidates as candidates_ctrl

    async def _no_sleep(_seconds):
        return None

    monkeypatch.setattr(candidates_ctrl.asyncio, "sleep", _no_sleep)
    assert asyncio  # silence unused-import linters

    candidate = _create_candidate(client)
    cid = candidate["id"]

    _post_score(client, cid, reviewer_a_token, score=4, note="solid")
    _post_score(client, cid, reviewer_b_token, score=2, note="weak")

    # Reviewer A's summary should reflect only A's one score of 4.
    resp = client.post(
        f"/api/v1/candidates/{cid}/summary",
        headers={"Authorization": f"Bearer {reviewer_a_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert "Reviewed 1 time(s) with an average score of 4.00/5" in resp.json()["summary"]

    # Admin's summary should reflect both scores (avg = 3.0).
    resp = client.post(
        f"/api/v1/candidates/{cid}/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert "Reviewed 2 time(s) with an average score of 3.00/5" in resp.json()["summary"]
