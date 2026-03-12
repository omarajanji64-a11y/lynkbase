import json
import os
from typing import Any

from dotenv import load_dotenv
from cryptography.fernet import Fernet, InvalidToken
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired, TwoFactorRequired

load_dotenv()

_ALLOWED_PROFILE_FIELDS = {"username", "full_name", "biography", "website"}


def _get_fernet() -> Fernet:
    key = os.getenv("SECRET_KEY")
    if not key:
        raise RuntimeError("SECRET_KEY is not set")
    try:
        return Fernet(key.encode())
    except (TypeError, ValueError) as exc:
        raise RuntimeError(
            "SECRET_KEY must be a urlsafe base64-encoded 32-byte Fernet key"
        ) from exc


def _encrypt_settings(settings: dict[str, Any]) -> str:
    payload = json.dumps(settings, separators=(",", ":"), sort_keys=True).encode()
    return _get_fernet().encrypt(payload).decode()


def _decrypt_settings(encrypted_session: str) -> dict[str, Any]:
    try:
        decrypted = _get_fernet().decrypt(encrypted_session.encode())
    except InvalidToken as exc:
        raise ValueError("encrypted_session could not be decrypted") from exc
    return json.loads(decrypted)


def _build_proxy_url(proxy: dict[str, Any]) -> str:
    host = proxy.get("host")
    port = proxy.get("port")
    if not host or not port:
        raise ValueError("proxy must include host and port")
    scheme = proxy.get("scheme", "http")
    username = proxy.get("username")
    password = proxy.get("password")

    if username and password:
        return f"{scheme}://{username}:{password}@{host}:{port}"
    return f"{scheme}://{host}:{port}"


def _apply_proxy(client: Client, proxy: dict[str, Any] | None) -> None:
    if not proxy:
        return
    client.set_proxy(_build_proxy_url(proxy))


def _device_fingerprint(settings: dict[str, Any]) -> str:
    fingerprint_payload = {
        "device_settings": settings.get("device_settings"),
        "user_agent": settings.get("user_agent"),
    }
    return json.dumps(fingerprint_payload, separators=(",", ":"), sort_keys=True)


def _raise_auth_error(exc: Exception) -> None:
    if isinstance(exc, LoginRequired):
        raise LoginRequired(
            "Login required. The session is invalid or expired."
        ) from exc
    if isinstance(exc, ChallengeRequired):
        raise ChallengeRequired(
            "Challenge required. Instagram requires verification for this login."
        ) from exc
    if isinstance(exc, TwoFactorRequired):
        raise TwoFactorRequired(
            "Two-factor authentication required. Complete 2FA to proceed."
        ) from exc


def login_account(username: str, password: str, proxy: dict | None = None) -> str:
    client = Client()
    _apply_proxy(client, proxy)

    try:
        client.login(username, password)
    except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
        _raise_auth_error(exc)

    settings = client.get_settings()
    settings["device_fingerprint"] = _device_fingerprint(settings)
    return _encrypt_settings(settings)


def load_session(encrypted_session: str, proxy: dict | None = None) -> Client:
    settings = _decrypt_settings(encrypted_session)
    client = Client()
    _apply_proxy(client, proxy)
    client.set_settings(settings)
    return client


def test_session(client: Client) -> bool:
    try:
        client.account_info()
        return True
    except (LoginRequired, ChallengeRequired, TwoFactorRequired):
        return False
    except Exception:
        return False


def update_profile(encrypted_session: str, fields: dict) -> Any:
    if not fields:
        raise ValueError("fields must include at least one profile field")

    payload = {k: v for k, v in fields.items() if k in _ALLOWED_PROFILE_FIELDS}
    if not payload:
        raise ValueError(
            "fields must include at least one of: username, full_name, biography, website"
        )

    if "website" in payload:
        payload["external_url"] = payload.pop("website")

    client = load_session(encrypted_session)
    try:
        return client.account_edit(**payload)
    except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
        _raise_auth_error(exc)


def update_profile_photo(encrypted_session: str, image_path: str) -> Any:
    client = load_session(encrypted_session)
    try:
        return client.account_change_picture(image_path)
    except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
        _raise_auth_error(exc)
