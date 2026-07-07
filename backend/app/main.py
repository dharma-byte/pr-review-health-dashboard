from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, prs

settings = get_settings()

app = FastAPI(
    title="PR Review Health Dashboard API",
    description="Scores GitHub pull requests for review risk based on diff size, test coverage, and staleness.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(prs.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
