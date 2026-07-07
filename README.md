# PR Review Health Dashboard

A Chrome extension that scores GitHub pull requests for **review risk** — diff size, test coverage, and staleness — the moment you open them, backed by a FastAPI + PostgreSQL service you own end to end.

> Opens a GitHub PR → a badge appears next to the title: **"Risk: High"**, with reasons on hover like *"650 lines changed (large diff)," "No test files touched," "Open for 5 days (stale)."* That score isn't from GitHub. It's computed by a backend you built, from the PR's real data.

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Architecture](#architecture)
- [The scoring engine](#the-scoring-engine)
- [Database schema](#database-schema)
- [API reference](#api-reference)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Setup](#setup)
- [Using the extension](#using-the-extension)
- [Testing](#testing)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Roadmap (v2)](#roadmap-v2)
- [License](#license)

## Why this exists

Large, untested, stale pull requests are exactly the ones that slip past review and reintroduce bugs. This project makes that risk visible at a glance, in the same page a reviewer is already looking at, before they have to dig through the diff to notice it themselves.

## Features

- **On-page risk badge** — a colored pill (green/yellow/red) injected next to the PR title on GitHub, with the specific reasons as a tooltip
- **Popup dashboard** — click the extension icon to see the full score breakdown and manually re-score
- **Persistent history** — every scored PR is saved with its snapshot (lines changed, files changed, days open, test coverage), queryable via the API
- **Encrypted token storage** — your GitHub personal access token is encrypted at rest (Fernet), never stored in plaintext
- **Transparent scoring** — a handful of simple, named rules, not a black-box model; every point is traceable to a stated reason
- **Graceful failure handling** — an invalid/missing token surfaces a clear "reconnect" message instead of failing silently

## Architecture

Three layers, talking only through well-defined messages — never reaching directly into each other's internals:

| Layer | Where it runs | Responsibility |
|---|---|---|
| Content script | Inside the GitHub PR page | Detects the viewed PR (URL pattern + `MutationObserver`, since GitHub's PR tabs don't reload the page) and injects the on-page badge |
| Background service worker | Chrome's extension runtime | Fetches PR facts from the GitHub REST API, calls the backend, routes messages between the content script and popup |
| Popup (React) | Extension toolbar icon | Shows the full score breakdown, reasons, and a manual re-score button |
| Options page (React) | Extension settings | Where you connect your GitHub token, username, and backend URL |
| FastAPI backend | Your own server | Runs the scoring engine, persists history, exposes the REST API |
| PostgreSQL | Attached to the backend | Stores users, repositories, and every scored PR + its snapshot |

### Request flow

```
1. You open a GitHub PR.
2. pr-detector.ts (content script) matches the URL, detects a new PR,
   sends { type: "PR_VIEWED", owner, repo, number } to the background worker.
3. service-worker.ts fetches:
     GET https://api.github.com/repos/{owner}/{repo}/pulls/{number}
     GET https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files
   using your stored GitHub token, and derives:
     lines_changed, files_changed, days_open, touched_test_files
4. service-worker.ts POSTs those facts to your backend:
     POST /api/prs/score
5. FastAPI runs score_pull_request(), saves a PRScore + PRSnapshot row
   to PostgreSQL, and returns { level, points, reasons }.
6. The background worker relays that result back to:
     - badge-injector.ts, which paints the colored pill on the page
     - Popup.tsx, if it's open, which renders the full breakdown
```

**Why this layering:** the content script never calls the backend directly. Content scripts run in a more exposed, less trusted context (they share the page's DOM), so all network calls — to GitHub and to the backend — are routed through the background service worker instead, keeping the GitHub token and backend URL out of page-accessible code. The popup and the on-page badge are both "dumb" display components — they render whatever the background worker sends them and never calculate anything themselves, so there's exactly one place (the backend) where scoring decisions are actually made.

## The scoring engine

Deliberately simple and fully transparent — every point is traceable to a stated reason. See [`backend/app/scoring.py`](backend/app/scoring.py):

| Signal | Threshold | Points | Reason shown |
|---|---|---|---|
| Lines changed | > 400 | +3 | `"{n} lines changed (large diff)"` |
| Lines changed | > 150 (and ≤ 400) | +1 | `"{n} lines changed (medium diff)"` |
| Test files touched | none | +2 | `"No test files touched"` |
| Days open | > 3 | +2 | `"Open for {n} days (stale)"` |
| Files changed | > 20 | +1 | `"{n} files changed (wide blast radius)"` |

Total points map to a level: **`>= 5` → high**, **`>= 2` → medium**, **else → low**. A PR that trips no rules gets an explicit `"No risk signals detected"` reason rather than an empty list.

**Worked example:** a PR with 650 lines changed, 25 files changed, open 2 days, no tests touched → +3 (large diff) + 2 (no tests) + 1 (wide blast radius) = **6 points → high**.

Test-file detection (`touched_test_files`) uses a filename pattern matching both common conventions: directory/prefix style (`tests/foo.py`, `test_foo.py`, `__tests__/`) and the Jest/Vitest suffix style (`Button.test.tsx`, `checkout.spec.ts`). See the regex in [`extension/src/background/service-worker.ts`](extension/src/background/service-worker.ts).

Full test suite with fixtures covering tiny/clean, medium-diff, huge/no-tests, stale, and mixed-signal PRs: [`backend/tests/test_scoring.py`](backend/tests/test_scoring.py), [`backend/tests/fixtures/sample_prs.json`](backend/tests/fixtures/sample_prs.json).

## Database schema

PostgreSQL, four tables (see [`backend/app/models.py`](backend/app/models.py), migration in [`backend/alembic/versions/`](backend/alembic/versions/)):

| Table | Purpose | Key columns |
|---|---|---|
| `users` | One row per person using the extension | `id`, `github_username` (unique), `github_token_encrypted`, `created_at` |
| `repositories` | Repos being tracked, scoped per user | `id`, `owner`, `name`, `user_id` (FK) — unique on `(owner, name, user_id)` |
| `pr_scores` | One row per scored PR snapshot — the history/audit trail | `id`, `repo_id` (FK), `pr_number`, `score_level`, `score_points`, `reasons` (JSON), `scored_at` |
| `pr_snapshots` | Raw facts captured at scoring time | `id`, `pr_score_id` (FK, unique), `lines_changed`, `files_changed`, `days_open`, `touched_tests` |

The database doesn't store full PR contents or diffs — GitHub already stores those, and the extension re-fetches them from the API whenever it re-scores. Its job is just to remember scores over time and who's using the extension.

## API reference

Interactive docs are auto-generated at `/docs` once the backend is running. Summary:

### `GET /health`
Health check. Returns `{"status": "ok"}`.

### `POST /api/auth/token`
Store (or replace) a user's encrypted GitHub token.

```bash
curl -X POST http://localhost:8000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"github_username": "octocat", "github_token": "ghp_..."}'
# → 201 { "github_username": "octocat", "connected": true }
```

### `GET /api/auth/status?github_username=...`
Check whether a user is connected. Returns `404` if the username is unknown.

### `POST /api/prs/score`
Score a PR and persist the result. Returns `404` if `github_username` isn't registered yet (via `/api/auth/token` first).

```bash
curl -X POST http://localhost:8000/api/prs/score \
  -H "Content-Type: application/json" \
  -d '{
    "github_username": "octocat",
    "owner": "react", "repo": "react", "pr_number": 28403,
    "lines_changed": 328, "files_changed": 22,
    "days_open": 867, "touched_test_files": true
  }'
# → 201 { "id": 1, "pr_number": 28403, "level": "medium", "points": 4,
#          "reasons": ["328 lines changed (medium diff)",
#                       "Open for 867 days (stale)", "22 files changed (wide blast radius)"],
#          "scored_at": "..." }
```

(This is a real example from testing this project against `react/react#28403` — medium diff + stale + wide blast radius, but tests were touched, so no "no test files touched" penalty.)

### `GET /api/prs/history?owner=...&repo=...&github_username=...`
Every scored PR for a repo, newest first, including its snapshot facts. Returns `[]` if the repo has never been scored, `404` if the username is unknown.

## Tech stack

TypeScript · React 19 · Vite · Manifest V3 (`@crxjs/vite-plugin`) · FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Pydantic v2 · Fernet token encryption (`cryptography`) · pytest · oxlint

## Project structure

```
pr-review-health-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py           FastAPI app entrypoint, CORS, router registration
│   │   ├── config.py         Pydantic-settings (.env loader)
│   │   ├── database.py       SQLAlchemy engine/session setup
│   │   ├── models.py         User, Repository, PRScore, PRSnapshot
│   │   ├── schemas.py        Pydantic request/response schemas
│   │   ├── scoring.py        score_pull_request() — the scoring engine
│   │   ├── security.py       Fernet token encrypt/decrypt
│   │   ├── crud.py           DB query helpers (get-or-create, lookups)
│   │   └── routers/
│   │       ├── auth.py       POST /api/auth/token, GET /api/auth/status
│   │       └── prs.py        POST /api/prs/score, GET /api/prs/history
│   ├── alembic/               Migration environment + versions/
│   ├── alembic.ini
│   ├── tests/
│   │   ├── test_scoring.py    Parametrized scoring engine tests
│   │   └── fixtures/sample_prs.json
│   ├── pytest.ini
│   ├── requirements.txt
│   └── .env.example            Template — copy to .env (gitignored)
├── extension/
│   ├── manifest.json           Manifest V3: permissions, content scripts, icons
│   ├── vite.config.ts          Vite + @crxjs/vite-plugin config
│   ├── public/icons/            16/32/48/128px PNG icons
│   └── src/
│       ├── content-scripts/
│       │   ├── pr-detector.ts     MutationObserver-based PR detection
│       │   └── badge-injector.ts  Injects/updates the on-page risk badge
│       ├── background/
│       │   └── service-worker.ts  GitHub API calls, backend calls, message routing
│       ├── popup/
│       │   ├── Popup.tsx          Popup entry — reads active tab, triggers scoring
│       │   ├── ScoreCard.tsx      Pure display: pill, reasons, re-score button
│       │   └── popup.css
│       ├── options/
│       │   ├── OptionsPage.tsx    GitHub token / username / backend URL form
│       │   └── options.css
│       └── shared/
│           ├── types.ts          PRFacts, ScoreResult, ScoreLevel
│           ├── storage.ts        Typed chrome.storage.local wrapper
│           ├── messaging.ts      Typed chrome.runtime messaging + message contracts
│           ├── api.ts            Typed fetch wrapper for the backend
│           └── styles.css        Shared CSS tokens (light + dark mode)
├── LICENSE
└── README.md
```

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (local install, or a free instance on Railway/Render/Supabase)
- A GitHub personal access token with read-only `repo` scope

### Backend

```bash
cd backend
python -m venv venv
./venv/Scripts/activate        # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt

createdb pr_dashboard           # or create it via your Postgres client of choice
cp .env.example .env
# edit .env: set DATABASE_URL and a generated TOKEN_ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

alembic upgrade head
uvicorn app.main:app --reload
```

The API is now running at `http://localhost:8000` (interactive docs at `/docs`).

### Extension

```bash
cd extension
npm install
npm run build
```

Then in Chrome:

1. Go to `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked**, select `extension/dist`.
3. Confirm the extension card shows no errors.
4. Open its **Options** page (right-click the toolbar icon → Options, or `chrome://extensions` → card → Details → Extension options) → enter your GitHub username, personal access token, and backend URL (defaults to `http://localhost:8000`) → **Save**. You should see "Connected."

## Using the extension

- **Open any GitHub pull request** — a risk badge appears next to the title within a second or two. Hover it for the specific reasons.
- **Click the extension icon** to open the popup: shows the same score, the full reasons list, and a **Re-score** button to re-run the check on demand.
- **Switching PR tabs** (Conversation / Commits / Files changed) doesn't re-trigger a fetch — the content script only re-scores when the *viewed PR* changes, but re-injects the badge if GitHub's own re-rendering wipes it out.
- **If something's wrong** (bad or missing token, unreachable backend), the badge shows a neutral "Risk: unavailable" with the specific error as its tooltip, and the popup shows an **Open Settings** shortcut straight to the fix.

## Testing

```bash
# Backend
cd backend
pytest

# Extension
cd extension
npm run build   # tsc -b && vite build
npm run lint     # oxlint
```

## Security notes

- GitHub tokens are never stored in plaintext — encrypted at rest with Fernet ([`backend/app/security.py`](backend/app/security.py)) before hitting PostgreSQL, decrypted only in memory.
- The extension requests host permissions for exactly two origins (`github.com`, `api.github.com`) — nothing broader — plus `storage` and `activeTab`.
- The content script has no network access of its own; every backend/GitHub call is made by the background service worker, which is a more isolated execution context than the page.
- CORS on the backend is scoped to `chrome-extension://` origins via a regex match (`allow_origin_regex`), not a blanket `*` — a bare wildcard string in an exact-match allowlist silently fails for extension origins, so this needed a regex rather than a literal string (see the CORS entry below).

## Troubleshooting

- **No badge appears at all**: content scripts only inject into tabs that load *after* the extension is active. If the PR tab was already open before you loaded/reloaded the extension, hard-refresh it (`Ctrl+Shift+R`).
- **Badge stuck on "Scoring…" or attached in the wrong place**: GitHub's DOM includes a hidden, screen-reader-only heading for its global search dialog that can be mistaken for the page's `<h1>`. The badge-injector explicitly excludes elements inside `[role="dialog"]`, with class `.sr-only`, or `aria-hidden="true"` when locating the real title — if GitHub changes its markup again, this is the first place to check ([`extension/src/content-scripts/badge-injector.ts`](extension/src/content-scripts/badge-injector.ts)).
- **"Risk: unavailable" badge**: hover it — the tooltip states the actual cause (no stored token, GitHub rejected the token, or the backend doesn't recognize the user). Fix via the Options page, which the popup's "Open Settings" button links to directly.
- **CORS errors calling the backend from the extension**: Starlette's `CORSMiddleware` does not support wildcard patterns like `"chrome-extension://*"` in `allow_origins` — only a bare `"*"` is special-cased there. The backend instead uses `allow_origin_regex=r"^chrome-extension://.*$"` in [`backend/app/main.py`](backend/app/main.py) / [`backend/app/config.py`](backend/app/config.py).
- **`GET /` returns 404**: expected — there's no root route, only `/health`, `/docs`, and the `/api/*` endpoints.

## Roadmap (v2)

- Live updates via polling or WebSockets, so the badge refreshes if new commits land while you're viewing the PR
- A score-history web dashboard reusing the `pr_scores` table already being populated
- Mapping each triggered risk reason to a concrete suggested action (e.g. "no tests touched" → "add tests covering these changes"), turning the reasons list into actionable advice rather than just a diagnosis
- Shared scoring thresholds across a team

## License

MIT — see [LICENSE](LICENSE).
