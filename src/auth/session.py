"""Simple HMAC session tokens (stdlib only — no JWT dependency)."""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Optional

from src.utils.config import get_settings


@dataclass
class AuthUser:
    username: str
    role: str = "owner"


def _secret() -> bytes:
    s = get_settings().auth_secret or get_settings().api_key or "shihezu-dev-secret-change-me"
    return s.encode("utf-8")


def create_token(username: str, role: str = "owner", ttl_seconds: int = 60 * 60 * 24 * 7) -> str:
    payload = {
        "u": username,
        "r": role,
        "exp": int(time.time()) + ttl_seconds,
    }
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    sig = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()
    # body.sig — both hex-safe
    import base64
    token = base64.urlsafe_b64encode(f"{body}.{sig}".encode()).decode()
    return token


def verify_token(token: str) -> Optional[AuthUser]:
    if not token:
        return None
    try:
        import base64
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        body, sig = raw.rsplit(".", 1)
        expected = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(body)
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return AuthUser(username=str(payload["u"]), role=str(payload.get("r", "owner")))
    except Exception:
        return None


def check_password(username: str, password: str) -> Optional[AuthUser]:
    settings = get_settings()
    if username == settings.auth_username and password == settings.auth_password:
        return AuthUser(username=username, role="owner")
    return None
