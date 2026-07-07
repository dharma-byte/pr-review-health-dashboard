from sqlalchemy.orm import Session

from app import models


def get_user_by_username(db: Session, github_username: str) -> models.User | None:
    return db.query(models.User).filter(models.User.github_username == github_username).first()
