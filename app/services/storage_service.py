import os
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_supabase_client: Client | None = None


def _get_config() -> dict[str, str]:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    bucket = os.getenv("SUPABASE_BUCKET")
    if not url or not key or not bucket:
        raise RuntimeError("Supabase storage credentials are not fully configured")
    return {"url": url, "key": key, "bucket": bucket}


def _get_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        config = _get_config()
        _supabase_client = create_client(config["url"], config["key"])
    return _supabase_client


def _get_bucket() -> str:
    return _get_config()["bucket"]


def _normalize_public_url(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("publicURL") or value.get("publicUrl") or ""
    return str(value)


def _path_from_url(url: str) -> str:
    config = _get_config()
    bucket = config["bucket"]
    parsed = urlparse(url)
    marker_public = f"/storage/v1/object/public/{bucket}/"
    marker_signed = f"/storage/v1/object/sign/{bucket}/"

    if marker_public in parsed.path:
        return parsed.path.split(marker_public, 1)[1]
    if marker_signed in parsed.path:
        return parsed.path.split(marker_signed, 1)[1]

    raise ValueError("URL does not match configured Supabase bucket")


def upload_media(file_path: str, destination: str) -> str:
    client = _get_client()
    bucket = _get_bucket()

    with open(file_path, "rb") as handle:
        client.storage.from_(bucket).upload(destination, handle)

    public_url = client.storage.from_(bucket).get_public_url(destination)
    return _normalize_public_url(public_url)


def download_media(url: str, local_path: str) -> None:
    client = _get_client()
    bucket = _get_bucket()
    storage_path = _path_from_url(url)

    data = client.storage.from_(bucket).download(storage_path)
    if hasattr(data, "data"):
        data = data.data

    with open(local_path, "wb") as handle:
        handle.write(data)


def delete_media(url: str) -> None:
    client = _get_client()
    bucket = _get_bucket()
    storage_path = _path_from_url(url)
    client.storage.from_(bucket).remove([storage_path])
