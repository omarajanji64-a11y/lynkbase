import csv
import io
import os
import shutil
import tempfile
import time
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.db.database import get_db
from app import models
from app.services.instagram_service import (
    get_device_fingerprint,
    load_session,
    login_account,
    test_session,
    update_profile,
    update_profile_photo,
)
from instagrapi.exceptions import ChallengeRequired, LoginRequired, TwoFactorRequired

router = APIRouter(prefix="/accounts", tags=["accounts"])


class AccountCreate(BaseModel):
    username: str
    password: str
    proxy_id: int | None = None


class AccountProfileUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    biography: str | None = None
    website: str | None = None


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    encrypted_session: str | None
    device_fingerprint: str | None
    proxy_id: int | None
    is_active: bool
    created_at: Any


class AccountListItem(BaseModel):
    id: int
    username: str
    is_active: bool
    created_at: Any
    session_alive: bool


class ImportSummary(BaseModel):
    created: list[dict[str, Any]]
    errors: list[dict[str, Any]]


def _serialize_instagram_object(obj: Any) -> Any:
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    return obj


def _proxy_dict(proxy: models.Proxy | None) -> dict[str, Any] | None:
    if not proxy:
        return None
    return {
        "host": proxy.host,
        "port": proxy.port,
        "username": proxy.username,
        "password": proxy.password,
    }


def _handle_auth_error(exc: Exception) -> None:
    if isinstance(exc, (LoginRequired, ChallengeRequired, TwoFactorRequired)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))


@router.post("/add", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def add_account(payload: AccountCreate, db: Session = Depends(get_db)) -> models.Account:
    proxy = None
    if payload.proxy_id is not None:
        proxy_model = db.get(models.Proxy, payload.proxy_id)
        if not proxy_model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Proxy not found"
            )
        proxy = _proxy_dict(proxy_model)

    try:
        encrypted_session = login_account(payload.username, payload.password, proxy)
    except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
        _handle_auth_error(exc)

    device_fingerprint = get_device_fingerprint(encrypted_session)

    account = models.Account(
        username=payload.username,
        encrypted_session=encrypted_session,
        device_fingerprint=device_fingerprint,
        proxy_id=payload.proxy_id,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("", response_model=list[AccountListItem])
def list_accounts(db: Session = Depends(get_db)) -> list[AccountListItem]:
    accounts = db.query(models.Account).all()
    results: list[AccountListItem] = []

    for account in accounts:
        session_alive = False
        if account.encrypted_session:
            try:
                proxy = _proxy_dict(account.proxy)
                client = load_session(account.encrypted_session, proxy)
                session_alive = test_session(client)
            except Exception:
                session_alive = False

        results.append(
            AccountListItem(
                id=account.id,
                username=account.username,
                is_active=account.is_active,
                created_at=account.created_at,
                session_alive=session_alive,
            )
        )

    return results


@router.post("/{account_id}/switch")
def switch_account(account_id: int, db: Session = Depends(get_db)) -> Any:
    account = db.get(models.Account, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    db.execute(update(models.Account).values(is_active=False))
    account.is_active = True
    db.commit()

    try:
        proxy = _proxy_dict(account.proxy)
        client = load_session(account.encrypted_session, proxy)
        profile = client.account_info()
    except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
        _handle_auth_error(exc)

    return _serialize_instagram_object(profile)


@router.put("/{account_id}/profile")
def update_account_profile(
    account_id: int,
    payload: AccountProfileUpdate,
    db: Session = Depends(get_db),
) -> Any:
    account = db.get(models.Account, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    fields = payload.model_dump(exclude_none=True)
    try:
        result = update_profile(account.encrypted_session, fields)
    except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
        _handle_auth_error(exc)

    if "username" in fields:
        account.username = fields["username"]
        db.commit()

    return _serialize_instagram_object(result)


@router.put("/{account_id}/photo")
def update_account_photo(
    account_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> Any:
    account = db.get(models.Account, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    suffix = os.path.splitext(file.filename or "")[-1]
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        with temp_file:
            shutil.copyfileobj(file.file, temp_file)

        result = update_profile_photo(account.encrypted_session, temp_file.name)
    except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
        _handle_auth_error(exc)
    finally:
        try:
            os.unlink(temp_file.name)
        except FileNotFoundError:
            pass

    return _serialize_instagram_object(result)


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    account = db.get(models.Account, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    db.delete(account)
    db.commit()
    return {"status": "deleted"}


@router.post("/import", response_model=ImportSummary)
def import_accounts(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ImportSummary:
    content = file.file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))

    required = {
        "username",
        "password",
        "proxy_host",
        "proxy_port",
        "proxy_username",
        "proxy_password",
    }
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        missing = sorted(required - set(reader.fieldnames or []))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV is missing required columns: {', '.join(missing)}",
        )

    created: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for index, row in enumerate(reader, start=1):
        username = (row.get("username") or "").strip()
        password = (row.get("password") or "").strip()

        if not username or not password:
            errors.append({"row": index, "error": "username and password required"})
            time.sleep(5)
            continue

        proxy = None
        proxy_id = None
        proxy_host = (row.get("proxy_host") or "").strip()
        proxy_port = (row.get("proxy_port") or "").strip()
        proxy_username = (row.get("proxy_username") or "").strip() or None
        proxy_password = (row.get("proxy_password") or "").strip() or None

        try:
            if proxy_host and proxy_port:
                proxy_model = models.Proxy(
                    host=proxy_host,
                    port=int(proxy_port),
                    username=proxy_username,
                    password=proxy_password,
                )
                db.add(proxy_model)
                db.flush()
                proxy_id = proxy_model.id
                proxy = _proxy_dict(proxy_model)

            encrypted_session = login_account(username, password, proxy)
            device_fingerprint = get_device_fingerprint(encrypted_session)

            account = models.Account(
                username=username,
                encrypted_session=encrypted_session,
                device_fingerprint=device_fingerprint,
                proxy_id=proxy_id,
            )
            db.add(account)
            db.commit()
            db.refresh(account)

            created.append({"id": account.id, "username": account.username})
        except (LoginRequired, ChallengeRequired, TwoFactorRequired) as exc:
            db.rollback()
            errors.append({"row": index, "username": username, "error": str(exc)})
        except Exception as exc:
            db.rollback()
            errors.append({"row": index, "username": username, "error": str(exc)})
        finally:
            time.sleep(5)

    return ImportSummary(created=created, errors=errors)
