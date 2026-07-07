from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.database import get_db
from app.scoring import score_pull_request

router = APIRouter(prefix="/api/prs", tags=["prs"])


@router.post("/score", response_model=schemas.ScoreResponse, status_code=status.HTTP_201_CREATED)
def score_pr(payload: schemas.ScorePRRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, payload.github_username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No stored GitHub token for this user. Connect a token via the options page first.",
        )

    repo = crud.get_or_create_repository(db, user, payload.owner, payload.repo)

    result = score_pull_request(payload)

    pr_score = models.PRScore(
        repo_id=repo.id,
        pr_number=payload.pr_number,
        score_level=result.level,
        score_points=result.points,
        reasons=result.reasons,
    )
    db.add(pr_score)
    db.flush()

    snapshot = models.PRSnapshot(
        pr_score_id=pr_score.id,
        lines_changed=payload.lines_changed,
        files_changed=payload.files_changed,
        days_open=payload.days_open,
        touched_tests=payload.touched_test_files,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(pr_score)

    return schemas.ScoreResponse(
        id=pr_score.id,
        pr_number=pr_score.pr_number,
        level=pr_score.score_level,
        points=pr_score.score_points,
        reasons=pr_score.reasons,
        scored_at=pr_score.scored_at,
    )


@router.get("/history", response_model=list[schemas.PRScoreHistoryItem])
def get_history(owner: str, repo: str, github_username: str, db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, github_username)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown github_username")

    repository = (
        db.query(models.Repository)
        .filter(
            models.Repository.user_id == user.id,
            models.Repository.owner == owner,
            models.Repository.name == repo,
        )
        .first()
    )
    if repository is None:
        return []

    scores = (
        db.query(models.PRScore)
        .filter(models.PRScore.repo_id == repository.id)
        .order_by(models.PRScore.scored_at.desc())
        .all()
    )

    return [
        schemas.PRScoreHistoryItem(
            id=s.id,
            pr_number=s.pr_number,
            score_level=s.score_level,
            score_points=s.score_points,
            reasons=s.reasons,
            scored_at=s.scored_at,
            lines_changed=s.snapshot.lines_changed,
            files_changed=s.snapshot.files_changed,
            days_open=s.snapshot.days_open,
            touched_tests=s.snapshot.touched_tests,
        )
        for s in scores
    ]
