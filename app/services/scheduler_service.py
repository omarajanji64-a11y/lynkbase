import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import boto3
from bullmq import Job, Queue
from dotenv import load_dotenv

from app import models
from app.db.database import SessionLocal

load_dotenv()

QUEUE_NAME = "scheduled_posts"


def _get_redis_url() -> str:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        raise RuntimeError("REDIS_URL is not set")
    return redis_url


def _get_queue() -> Queue:
    return Queue(QUEUE_NAME, {"connection": _get_redis_url()})


def _get_r2_config() -> dict[str, str]:
    account_id = os.getenv("R2_ACCOUNT_ID")
    access_key = os.getenv("R2_ACCESS_KEY")
    secret_key = os.getenv("R2_SECRET_KEY")
    bucket = os.getenv("R2_BUCKET_NAME")

    if not account_id or not access_key or not secret_key or not bucket:
        raise RuntimeError("R2 credentials are not fully configured")

    return {
        "account_id": account_id,
        "access_key": access_key,
        "secret_key": secret_key,
        "bucket": bucket,
    }


def _r2_endpoint(account_id: str) -> str:
    return f"https://{account_id}.r2.cloudflarestorage.com"


def _r2_client() -> Any:
    config = _get_r2_config()
    return boto3.client(
        "s3",
        endpoint_url=_r2_endpoint(config["account_id"]),
        aws_access_key_id=config["access_key"],
        aws_secret_access_key=config["secret_key"],
        region_name="auto",
    )


def _upload_to_r2(media_path: str, account_id: int) -> tuple[str, str]:
    config = _get_r2_config()
    client = _r2_client()

    _, ext = os.path.splitext(media_path)
    object_key = f"scheduled-posts/{account_id}/{uuid.uuid4().hex}{ext}"
    client.upload_file(media_path, config["bucket"], object_key)

    media_url = f"{_r2_endpoint(config['account_id'])}/{config['bucket']}/{object_key}"
    return media_url, object_key


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _delay_ms(scheduled_time: datetime) -> int:
    scheduled_time = _ensure_aware(scheduled_time)
    now = datetime.now(timezone.utc)
    delay = (scheduled_time - now).total_seconds()
    return max(0, int(delay * 1000))


def _run_async(coro: Any) -> Any:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    raise RuntimeError("This function cannot run inside an active event loop")


async def _enqueue_job(data: dict[str, Any], delay_ms: int) -> Job:
    queue = _get_queue()
    try:
        job = await queue.add("publish", data, {"delay": delay_ms})
        return job
    finally:
        await queue.close()


async def _remove_job(job_id: str) -> None:
    queue = _get_queue()
    try:
        job = await Job.fromId(queue, job_id)
        if job:
            await job.remove()
    finally:
        await queue.close()


def schedule_post(
    account_id: int,
    media_path: str,
    caption: str,
    post_type: str,
    scheduled_time: datetime,
) -> models.ScheduledPost:
    db = SessionLocal()
    post: models.ScheduledPost | None = None

    try:
        account = db.get(models.Account, account_id)
        if not account:
            raise ValueError("Account not found")

        media_url, object_key = _upload_to_r2(media_path, account_id)
        normalized_type = (
            post_type
            if isinstance(post_type, models.PostType)
            else models.PostType(post_type)
        )
        scheduled_time = _ensure_aware(scheduled_time)

        post = models.ScheduledPost(
            account_id=account_id,
            media_url=media_url,
            caption=caption,
            post_type=normalized_type,
            scheduled_time=scheduled_time,
            status=models.PostStatus.PENDING,
        )
        db.add(post)
        db.commit()
        db.refresh(post)

        job_data = {
            "post_id": post.id,
            "account_id": account_id,
            "object_key": object_key,
            "media_url": media_url,
            "post_type": normalized_type.value,
            "caption": caption,
        }
        delay_ms = _delay_ms(scheduled_time)
        job = _run_async(_enqueue_job(job_data, delay_ms))

        post.job_id = str(job.id)
        db.commit()
        db.refresh(post)
        return post
    except Exception as exc:
        db.rollback()
        if post and post.id:
            post.status = models.PostStatus.FAILED
            post.error_message = str(exc)
            db.commit()
        raise
    finally:
        db.close()


def cancel_post(post_id: int) -> bool:
    db = SessionLocal()
    try:
        post = db.get(models.ScheduledPost, post_id)
        if not post:
            return False

        if post.job_id:
            _run_async(_remove_job(post.job_id))

        post.status = models.PostStatus.CANCELLED
        db.commit()
        return True
    finally:
        db.close()


def get_scheduled_posts(account_id: int) -> list[models.ScheduledPost]:
    db = SessionLocal()
    try:
        return (
            db.query(models.ScheduledPost)
            .filter(models.ScheduledPost.account_id == account_id)
            .order_by(models.ScheduledPost.scheduled_time.asc())
            .all()
        )
    finally:
        db.close()
