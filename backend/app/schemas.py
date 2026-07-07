from pydantic import BaseModel, Field


class PullRequestFacts(BaseModel):
    """The four signals the scoring engine reasons about."""

    lines_changed: int = Field(ge=0)
    files_changed: int = Field(ge=0)
    days_open: int = Field(ge=0)
    touched_test_files: bool


class ScoreResult(BaseModel):
    level: str
    points: int
    reasons: list[str]


class TokenRegisterRequest(BaseModel):
    github_username: str
    github_token: str = Field(min_length=1)


class TokenStatusResponse(BaseModel):
    github_username: str
    connected: bool
