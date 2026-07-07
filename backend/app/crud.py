from sqlalchemy.orm import Session

from app import models


def get_user_by_username(db: Session, github_username: str) -> models.User | None:
    return db.query(models.User).filter(models.User.github_username == github_username).first()


def get_or_create_repository(db: Session, user: models.User, owner: str, name: str) -> models.Repository:
    repo = (
        db.query(models.Repository)
        .filter(
            models.Repository.user_id == user.id,
            models.Repository.owner == owner,
            models.Repository.name == name,
        )
        .first()
    )
    if repo is None:
        repo = models.Repository(owner=owner, name=name, user_id=user.id)
        db.add(repo)
        db.flush()
    return repo
