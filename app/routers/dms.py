from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from instagrapi.exceptions import ChallengeRequired, LoginRequired, TwoFactorRequired

from app import models
from app.db.database import get_db
from app.services.dm_service import fetch_messages, poll_all_accounts, send_message

router = APIRouter(prefix="/dms", tags=["dms"])


class DMThreadOut(BaseModel):
    account_id: int
    username: str
    thread_id: str
    last_message: str | None
    updated_at: datetime


class DmReplyIn(BaseModel):
    text: str


class PollResult(BaseModel):
    new_messages: int


def _handle_auth_error(exc: Exception) -> None:
    if isinstance(exc, (LoginRequired, ChallengeRequired, TwoFactorRequired)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))


@router.get("", response_model=list[DMThreadOut])
def list_threads(db: Session = Depends(get_db)) -> list[DMThreadOut]:
    rows = (
        db.query(models.DMThread, models.Account.username)
        .join(models.Account, models.DMThread.account_id == models.Account.id)
        .order_by(models.DMThread.updated_at.desc())
        .all()
    )

    result: list[DMThreadOut] = []
    for thread, username in rows:
        result.append(
            DMThreadOut(
                account_id=thread.account_id,
                username=username,
                thread_id=thread.thread_id,
                last_message=thread.last_message,
                updated_at=thread.updated_at,
            )
        )
    return result


@router.get("/{account_id}/{thread_id}")
def get_thread_messages(account_id: int, thread_id: str) -> list[dict[str, Any]]:
    try:
        return fetch_messages(account_id, thread_id)
    except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
        _handle_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{account_id}/{thread_id}/reply")
def reply_thread(
    account_id: int,
    thread_id: str,
    payload: DmReplyIn,
) -> dict[str, Any]:
    try:
        return send_message(account_id, thread_id, payload.text)
    except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
        _handle_auth_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/poll", response_model=PollResult)
def poll_threads() -> PollResult:
    count = poll_all_accounts()
    return PollResult(new_messages=count)
