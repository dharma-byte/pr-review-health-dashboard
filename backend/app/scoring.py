from app.schemas import PullRequestFacts, ScoreResult

LARGE_DIFF_THRESHOLD = 400
MEDIUM_DIFF_THRESHOLD = 150
STALE_DAYS_THRESHOLD = 3
WIDE_BLAST_RADIUS_FILES = 20

MEDIUM_SCORE_THRESHOLD = 2
HIGH_SCORE_THRESHOLD = 5


def score_pull_request(pr: PullRequestFacts) -> ScoreResult:
    """Score a PR's review risk from its raw facts.

    Deliberately simple and rule-based: every point is traceable to a reason,
    so the result never needs to be "trusted" — it can be read.
    """
    reasons: list[str] = []
    points = 0

    if pr.lines_changed > LARGE_DIFF_THRESHOLD:
        points += 3
        reasons.append(f"{pr.lines_changed} lines changed (large diff)")
    elif pr.lines_changed > MEDIUM_DIFF_THRESHOLD:
        points += 1
        reasons.append(f"{pr.lines_changed} lines changed (medium diff)")

    if not pr.touched_test_files:
        points += 2
        reasons.append("No test files touched")

    if pr.days_open > STALE_DAYS_THRESHOLD:
        points += 2
        reasons.append(f"Open for {pr.days_open} days (stale)")

    if pr.files_changed > WIDE_BLAST_RADIUS_FILES:
        points += 1
        reasons.append(f"{pr.files_changed} files changed (wide blast radius)")

    if points >= HIGH_SCORE_THRESHOLD:
        level = "high"
    elif points >= MEDIUM_SCORE_THRESHOLD:
        level = "medium"
    else:
        level = "low"

    if not reasons:
        reasons.append("No risk signals detected")

    return ScoreResult(level=level, points=points, reasons=reasons)
