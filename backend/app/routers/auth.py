from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.database import get_db
from app.security import encrypt_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/token", response_model=schemas.TokenStatusResponse, status_code=status.HTTP_201_CREATED)
def register_token(payload: schemas.TokenRegisterRequest, db: Session = Depends(get_db)):
    """Store (or replace) a user's encrypted GitHub token.

    The raw token is never persisted — only its Fernet-encrypted form.
    """
    user = crud.get_user_by_username(db, payload.github_username)
    encrypted = encrypt_token(payload.github_token)

    if user is None:
        user = models.User(github_username=payload.github_username, github_token_encrypted=encrypted)
        db.add(user)
    else:
        user.github_token_encrypted = encrypted

    db.commit()
    return schemas.TokenStatusResponse(github_username=payload.github_username, connected=True)


@router.get("/status", response_model=schemas.TokenStatusResponse)
def token_status(github_username: str, db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, github_username)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown github_username")
    return schemas.TokenStatusResponse(github_username=github_username, connected=True)
