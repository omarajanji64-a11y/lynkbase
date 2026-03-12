import os
import shutil
import tempfile
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app import models
from app.db.database import get_db
from app.services.scheduler_service import cancel_post, get_scheduled_posts, schedule_post

router = APIRouter(prefix="/posts", tags=["posts"])


class ScheduledPostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    media_url: str
    caption: str | None
    post_type: models.PostType
    scheduled_time: datetime
    status: models.PostStatus
    created_at: datetime
    job_id: str | None
    error_message: str | None


@router.post("/schedule", response_model=ScheduledPostOut, status_code=status.HTTP_201_CREATED)
def schedule_post_endpoint(
    account_id: int = Form(...),
    post_type: models.PostType = Form(...),
    caption: str | None = Form(None),
    scheduled_time: datetime = Form(...),
    media: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> models.ScheduledPost:
    account = db.get(models.Account, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    suffix = os.path.splitext(media.filename or "")[-1]
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        with temp_file:
            shutil.copyfileobj(media.file, temp_file)

        try:
            return schedule_post(
                account_id=account_id,
                media_path=temp_file.name,
                caption=caption or "",
                post_type=post_type.value,
                scheduled_time=scheduled_time,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    finally:
        try:
            os.unlink(temp_file.name)
        except FileNotFoundError:
            pass


@router.get("", response_model=list[ScheduledPostOut])
def list_all_posts(db: Session = Depends(get_db)) -> list[models.ScheduledPost]:
    return (
        db.query(models.ScheduledPost)
        .order_by(models.ScheduledPost.scheduled_time.asc())
        .all()
    )


@router.get("/{account_id}", response_model=list[ScheduledPostOut])
def list_account_posts(account_id: int) -> list[models.ScheduledPost]:
    return get_scheduled_posts(account_id)


@router.delete("/{post_id}")
def delete_post(post_id: int) -> dict[str, Any]:
    if not cancel_post(post_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return {"status": "cancelled"}
