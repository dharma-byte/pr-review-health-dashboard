from datetime import datetime

from pydantic import BaseModel, Field


class PullRequestFacts(BaseModel):
    """The four signals the scoring engine reasons about."""

    lines_changed: int = Field(ge=0)
    files_changed: int = Field(ge=0)
    days_open: int = Field(ge=0)
    touched_test_files: bool


class ScorePRRequest(PullRequestFacts):
    """What the extension sends: scoring facts plus enough identity to store history."""

    github_username: str
    owner: str
    repo: str
    pr_number: int = Field(gt=0)


class ScoreResult(BaseModel):
    level: str
    points: int
    reasons: list[str]


class ScoreResponse(ScoreResult):
    id: int
    pr_number: int
    scored_at: datetime


class PRScoreHistoryItem(BaseModel):
    id: int
    pr_number: int
    score_level: str
    score_points: int
    reasons: list[str]
    scored_at: datetime
    lines_changed: int
    files_changed: int
    days_open: int
    touched_tests: bool


class TokenRegisterRequest(BaseModel):
    github_username: str
    github_token: str = Field(min_length=1)


class TokenStatusResponse(BaseModel):
    github_username: str
    connected: bool
