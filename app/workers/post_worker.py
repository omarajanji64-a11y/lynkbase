import os
import tempfile
from typing import Any

import boto3
from bullmq import Worker
from dotenv import load_dotenv

from app import models
from app.db.database import SessionLocal
from app.services.instagram_service import load_session

load_dotenv()

QUEUE_NAME = "scheduled_posts"


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


def _object_key_from_media_url(media_url: str) -> str | None:
    config = _get_r2_config()
    prefix = f"{_r2_endpoint(config['account_id'])}/{config['bucket']}/"
    if media_url.startswith(prefix):
        return media_url[len(prefix) :]
    return None


def _proxy_dict(proxy: models.Proxy | None) -> dict[str, Any] | None:
    if not proxy:
        return None
    return {
        "host": proxy.host,
        "port": proxy.port,
        "username": proxy.username,
        "password": proxy.password,
    }


def _upload_to_instagram(
    client: Any,
    post_type: str,
    media_path: str,
    caption: str | None,
) -> Any:
    caption = caption or ""
    if post_type == models.PostType.FEED.value:
        return client.photo_upload(media_path, caption=caption)
    if post_type == models.PostType.REEL.value:
        return client.video_upload(media_path, caption=caption)
    if post_type == models.PostType.STORY.value:
        return client.photo_upload_to_story(media_path)
    raise ValueError(f"Unsupported post_type: {post_type}")


async def process(job, token) -> dict[str, Any]:
    data = job.data or {}
    post_id = data.get("post_id")
    account_id = data.get("account_id")
    object_key = data.get("object_key")
    media_url = data.get("media_url")
    post_type = data.get("post_type")
    caption = data.get("caption")

    if not object_key and media_url:
        object_key = _object_key_from_media_url(media_url)

    db = SessionLocal()
    temp_path = None

    try:
        post = db.get(models.ScheduledPost, post_id)
        if not post:
            raise ValueError("ScheduledPost not found")

        if post.status == models.PostStatus.CANCELLED:
            return {"status": "cancelled"}

        account = db.get(models.Account, account_id or post.account_id)
        if not account or not account.encrypted_session:
            raise ValueError("Account session not available")

        proxy = _proxy_dict(account.proxy)
        client = load_session(account.encrypted_session, proxy)

        if not object_key:
            raise ValueError("Missing media object key")

        r2_client = _r2_client()
        _, ext = os.path.splitext(object_key)
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            temp_path = temp_file.name

        config = _get_r2_config()
        r2_client.download_file(config["bucket"], object_key, temp_path)

        _upload_to_instagram(client, post_type, temp_path, caption)

        post.status = models.PostStatus.PUBLISHED
        post.error_message = None
        db.commit()
        return {"status": "published"}
    except Exception as exc:
        post = db.get(models.ScheduledPost, post_id) if post_id else None
        if post:
            post.status = models.PostStatus.FAILED
            post.error_message = str(exc)
            db.commit()
        raise
    finally:
        db.close()
        if temp_path:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass


if __name__ == "__main__":
    import asyncio

    async def main() -> None:
        redis_url = os.getenv("REDIS_URL")
        worker_options = {"connection": redis_url} if redis_url else {}
        Worker(QUEUE_NAME, process, worker_options)
        await asyncio.Event().wait()

    asyncio.run(main())
