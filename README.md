# PR Review Health Dashboard

A Chrome extension that scores GitHub pull requests for **review risk** — diff size, test coverage, and staleness — the moment you open them, backed by a FastAPI + PostgreSQL service you own end to end.

> Opens a GitHub PR → a badge appears next to the title: **"Risk: High — 650 lines changed, no tests touched, open 5 days."** That score isn't from GitHub. It's computed by a backend you built, from the PR's real data.

## Why this exists

Large, untested, stale pull requests are exactly the ones that slip past review and reintroduce bugs. This project makes that risk visible at a glance, before a reviewer has to dig through the diff to notice it.

## How it works

| Layer | Where it runs | Responsibility |
|---|---|---|
| Content script | Inside the GitHub PR page | Detects the viewed PR (URL + `MutationObserver`, since GitHub's PR tabs don't reload the page) and draws the on-page badge |
| Background service worker | Chrome's extension runtime | Fetches PR facts from the GitHub API, calls the backend, routes messages |
| Popup (React) | Extension toolbar icon | Shows the full score breakdown and a manual re-score button |
| Options page (React) | Extension settings | Where you connect your GitHub token and backend URL |
| FastAPI backend | Your own server | Runs the scoring engine, persists history, exposes the REST API |
| PostgreSQL | Attached to the backend | Stores users, repositories, and every scored PR + its snapshot |

**Request flow:** content script detects a PR → sends `PR_VIEWED` to the background worker → worker fetches the PR + changed files from GitHub's API → worker posts those facts to `POST /api/prs/score` → FastAPI scores it, saves a `PRScore` + `PRSnapshot` row, returns `{level, points, reasons}` → the worker relays that back to both the badge and the popup.

The content script never talks to the backend directly — all network calls are routed through the background worker, keeping the GitHub token and backend URL out of the page's more exposed execution context.

## The scoring engine

Deliberately simple and fully transparent — every point on the score is traceable to a stated reason:

- **> 400 lines changed** → +3 (large diff), **> 150** → +1 (medium diff)
- **No test files touched** → +2
- **Open > 3 days** → +2 (stale)
- **> 20 files changed** → +1 (wide blast radius)

`>= 5` points → **high**, `>= 2` → **medium**, else → **low**.

See [`backend/app/scoring.py`](backend/app/scoring.py) and its tests in [`backend/tests/test_scoring.py`](backend/tests/test_scoring.py).

## Tech stack

TypeScript · React 19 · Vite · Manifest V3 (`@crxjs/vite-plugin`) · FastAPI · SQLAlchemy · Alembic · PostgreSQL · Pydantic · Fernet token encryption · pytest

## Project structure

```
pr-review-health-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py          FastAPI app entrypoint
│   │   ├── models.py        SQLAlchemy models
│   │   ├── schemas.py       Pydantic request/response schemas
│   │   ├── database.py      Engine/session setup
│   │   ├── scoring.py       score_pull_request() — the scoring engine
│   │   ├── security.py      Fernet token encryption
│   │   ├── crud.py          DB query helpers
│   │   └── routers/         auth.py, prs.py
│   ├── alembic/              Database migrations
│   ├── tests/                 pytest suite + fixtures
│   └── requirements.txt
├── extension/
│   ├── manifest.json
│   └── src/
│       ├── content-scripts/  pr-detector.ts, badge-injector.ts
│       ├── background/       service-worker.ts
│       ├── popup/            Popup.tsx, ScoreCard.tsx
│       ├── options/          OptionsPage.tsx
│       └── shared/           types.ts, storage.ts, messaging.ts, api.ts
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

Run the tests:

```bash
pytest
```

### Extension

```bash
cd extension
npm install
npm run build
```

Then in Chrome:

1. Go to `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked**, select `extension/dist`.
3. Click the extension icon → open its **Options** page → enter your GitHub username, personal access token, and backend URL (defaults to `http://localhost:8000`) → **Save**.
4. Open any GitHub pull request. A risk badge appears next to the title within a second or two.

## Security notes

- GitHub tokens are never stored in plaintext — they're encrypted at rest with Fernet before hitting PostgreSQL, and decrypted only in memory.
- The extension requests host permissions for exactly two origins (`github.com`, `api.github.com`) — nothing broader.
- The content script has no network access of its own; every backend/GitHub call is made by the background service worker.

## Roadmap (v2)

- Live updates via polling or WebSockets, so the badge refreshes if new commits land while you're viewing the PR
- A score-history dashboard reusing the `pr_scores` table already being populated
- Shared scoring thresholds across a team

## License

MIT — see [LICENSE](LICENSE).
