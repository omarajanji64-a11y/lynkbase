import os
import tempfile
from typing import Any
from urllib.parse import urlparse
from bullmq import Worker
from dotenv import load_dotenv

from app import models
from app.db.database import SessionLocal
from app.services.instagram_service import load_session
from app.services.storage_service import download_media

load_dotenv()

QUEUE_NAME = "scheduled_posts"


def _suffix_from_url(media_url: str) -> str:
    parsed = urlparse(media_url)
    return os.path.splitext(parsed.path)[-1]


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
    media_url = data.get("media_url")
    post_type = data.get("post_type")
    caption = data.get("caption")

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

        if not media_url:
            media_url = post.media_url

        if not media_url:
            raise ValueError("Missing media URL")

        suffix = _suffix_from_url(media_url)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name

        download_media(media_url, temp_path)

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
