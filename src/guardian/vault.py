"""Encrypted tokenization vault (Fernet)."""

from __future__ import annotations
import json
from pathlib import Path
from typing import Dict, Optional
from uuid import uuid4
from cryptography.fernet import Fernet
from src.utils.config import get_settings


class _L:
    def info(self, *a, **k): pass
    def warning(self, *a, **k): print("[WARN]", *a)
    def error(self, *a, **k): print("[ERR]", *a)


logger = _L()


class TokenVault:
    def __init__(self) -> None:
        settings = get_settings()
        self.vault_dir = Path(settings.vault_dir)
        self.vault_dir.mkdir(parents=True, exist_ok=True)
        self.store_path = self.vault_dir / "tokens.json"

        key = settings.fernet_key
        if not key:
            key = Fernet.generate_key().decode()
            logger.warning("No FERNET_KEY set – using ephemeral key (data lost on restart)")
        self.fernet = Fernet(key.encode() if isinstance(key, str) else key)
        self._cache: Dict[str, str] = self._load()

    def _load(self) -> Dict[str, str]:
        if not self.store_path.exists():
            return {}
        try:
            data = json.loads(self.store_path.read_text())
            return {k: self.fernet.decrypt(v.encode()).decode() for k, v in data.items()}
        except Exception as e:
            logger.error(f"Vault load error: {e}")
            return {}

    def _save(self) -> None:
        encrypted = {k: self.fernet.encrypt(v.encode()).decode() for k, v in self._cache.items()}
        self.store_path.write_text(json.dumps(encrypted, indent=2))

    def tokenize(self, value: str, entity_type: str) -> str:
        token = f"tok_{entity_type.lower()}_{uuid4().hex[:10]}"
        self._cache[token] = value
        self._save()
        return token

    def detokenize(self, token: str) -> Optional[str]:
        return self._cache.get(token)

    def synthetic(self, entity_type: str) -> str:
        fakes = {
            "PAN": "ABCDE1234F",
            "AADHAAR": "XXXX XXXX XXXX",
            "PHONE_IN": "+91 99999 99999",
            "EMAIL": "user@example.com",
            "CREDIT_CARD": "4111 1111 1111 1111",
            "ACCOUNT_NO": "000000000000",
            "IFSC": "SBIN0000001",
            "UPI": "user@upi",
            "API_KEY": "sk_live_xxxxxxxxxxxxxxxx",
            "BALANCE": "Rs. 0.00",
        }
        return fakes.get(entity_type, f"[FAKE_{entity_type}]")
