import logging
import time
from datetime import datetime, timezone
from typing import Any

from instagrapi.exceptions import ChallengeRequired, LoginRequired, TwoFactorRequired

from app import models
from app.db.database import SessionLocal
from app.services.instagram_service import load_session

logger = logging.getLogger(__name__)


def _proxy_dict(proxy: models.Proxy | None) -> dict[str, Any] | None:
    if not proxy:
        return None
    return {
        "host": proxy.host,
        "port": proxy.port,
        "username": proxy.username,
        "password": proxy.password,
    }


def _thread_timestamp(thread: Any) -> datetime:
    for attr in ("updated_at", "last_activity_at", "last_activity_at_utc"):
        value = getattr(thread, attr, None)
        if value:
            if isinstance(value, datetime):
                return value
            try:
                return datetime.fromtimestamp(float(value), tz=timezone.utc)
            except (TypeError, ValueError):
                continue
    return datetime.now(timezone.utc)


def _extract_last_message(thread: Any) -> str | None:
    last_message = getattr(thread, "last_message", None)
    if last_message is None:
        return None
    if isinstance(last_message, str):
        return last_message
    return getattr(last_message, "text", None) or str(last_message)


def fetch_threads(account_id: int) -> int:
    db = SessionLocal()
    new_count = 0
    try:
        account = db.get(models.Account, account_id)
        if not account or not account.encrypted_session:
            raise ValueError("Account session not available")

        client = load_session(account.encrypted_session, _proxy_dict(account.proxy))
        threads = client.direct_threads(amount=20)

        for thread in threads:
            thread_id = str(getattr(thread, "id", None) or getattr(thread, "thread_id", ""))
            if not thread_id:
                continue

            last_message = _extract_last_message(thread)
            updated_at = _thread_timestamp(thread)

            existing = (
                db.query(models.DMThread)
                .filter(
                    models.DMThread.account_id == account_id,
                    models.DMThread.thread_id == thread_id,
                )
                .one_or_none()
            )

            if existing:
                if existing.last_message != last_message or existing.updated_at != updated_at:
                    existing.last_message = last_message
                    existing.updated_at = updated_at
                    new_count += 1
            else:
                db.add(
                    models.DMThread(
                        account_id=account_id,
                        thread_id=thread_id,
                        last_message=last_message,
                        updated_at=updated_at,
                    )
                )
                new_count += 1

        db.commit()
        return new_count
    finally:
        db.close()


def fetch_messages(account_id: int, thread_id: str) -> list[dict[str, Any]]:
    db = SessionLocal()
    try:
        account = db.get(models.Account, account_id)
        if not account or not account.encrypted_session:
            raise ValueError("Account session not available")

        client = load_session(account.encrypted_session, _proxy_dict(account.proxy))
        messages = client.direct_messages(thread_id, amount=0)

        result: list[dict[str, Any]] = []
        for message in messages:
            sender = None
            user = getattr(message, "user", None)
            if user is not None:
                sender = getattr(user, "username", None) or getattr(user, "pk", None)
            if sender is None:
                sender = getattr(message, "user_id", None)

            timestamp = getattr(message, "timestamp", None)
            if isinstance(timestamp, datetime):
                ts = timestamp
            else:
                try:
                    ts = datetime.fromtimestamp(float(timestamp), tz=timezone.utc)
                except (TypeError, ValueError):
                    ts = None

            result.append(
                {
                    "sender": str(sender) if sender is not None else None,
                    "text": getattr(message, "text", None),
                    "timestamp": ts,
                }
            )

        return result
    finally:
        db.close()


def send_message(account_id: int, thread_id: str, text: str) -> dict[str, Any]:
    db = SessionLocal()
    try:
        account = db.get(models.Account, account_id)
        if not account or not account.encrypted_session:
            raise ValueError("Account session not available")

        client = load_session(account.encrypted_session, _proxy_dict(account.proxy))
        client.direct_send(text, thread_ids=[thread_id])
        return {"status": "sent"}
    finally:
        db.close()


def poll_all_accounts() -> int:
    db = SessionLocal()
    total_new = 0
    try:
        accounts = db.query(models.Account).all()
    finally:
        db.close()

    for account in accounts:
        try:
            total_new += fetch_threads(account.id)
        except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
            logger.warning(
                "Skipping account %s due to session error: %s", account.id, str(exc)
            )
        except Exception as exc:
            logger.warning(
                "Skipping account %s due to error: %s", account.id, str(exc)
            )
        finally:
            time.sleep(3)

    return total_new
