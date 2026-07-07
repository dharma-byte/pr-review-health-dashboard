import json
from pathlib import Path

import pytest

from app.schemas import PullRequestFacts
from app.scoring import score_pull_request

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "sample_prs.json"
CASES = json.loads(FIXTURES_PATH.read_text())


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_score_pull_request_matches_expected(case):
    facts = PullRequestFacts(**case["facts"])
    result = score_pull_request(facts)

    assert result.level == case["expected_level"]
    assert result.points == case["expected_points"]


def test_low_risk_pr_gets_a_reason():
    facts = PullRequestFacts(lines_changed=5, files_changed=1, days_open=0, touched_test_files=True)
    result = score_pull_request(facts)

    assert result.level == "low"
    assert result.reasons == ["No risk signals detected"]


def test_reasons_explain_every_point_scored():
    facts = PullRequestFacts(lines_changed=500, files_changed=25, days_open=4, touched_test_files=False)
    result = score_pull_request(facts)

    assert len(result.reasons) == 4
    assert any("large diff" in r for r in result.reasons)
    assert any("No test files touched" in r for r in result.reasons)
    assert any("stale" in r for r in result.reasons)
    assert any("wide blast radius" in r for r in result.reasons)
