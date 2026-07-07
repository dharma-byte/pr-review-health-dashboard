from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    github_username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    github_token_encrypted: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    repositories: Mapped[list["Repository"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Repository(Base):
    __tablename__ = "repositories"
    __table_args__ = (UniqueConstraint("owner", "name", "user_id", name="uq_repository_owner_name_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    user: Mapped["User"] = relationship(back_populates="repositories")
    pr_scores: Mapped[list["PRScore"]] = relationship(back_populates="repository", cascade="all, delete-orphan")


class PRScore(Base):
    __tablename__ = "pr_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repo_id: Mapped[int] = mapped_column(Integer, ForeignKey("repositories.id"), nullable=False)
    pr_number: Mapped[int] = mapped_column(Integer, nullable=False)
    score_level: Mapped[str] = mapped_column(String, nullable=False)  # "low" | "medium" | "high"
    score_points: Mapped[int] = mapped_column(Integer, nullable=False)
    reasons: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    scored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    repository: Mapped["Repository"] = relationship(back_populates="pr_scores")
    snapshot: Mapped["PRSnapshot"] = relationship(
        back_populates="pr_score", cascade="all, delete-orphan", uselist=False
    )


class PRSnapshot(Base):
    __tablename__ = "pr_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pr_score_id: Mapped[int] = mapped_column(Integer, ForeignKey("pr_scores.id"), nullable=False, unique=True)
    lines_changed: Mapped[int] = mapped_column(Integer, nullable=False)
    files_changed: Mapped[int] = mapped_column(Integer, nullable=False)
    days_open: Mapped[int] = mapped_column(Integer, nullable=False)
    touched_tests: Mapped[bool] = mapped_column(Boolean, nullable=False)

    pr_score: Mapped["PRScore"] = relationship(back_populates="snapshot")
