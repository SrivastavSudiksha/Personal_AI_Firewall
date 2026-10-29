"""Application settings loaded from environment / .env."""

from functools import lru_cache
from pathlib import Path
from typing import List, Optional
import os

_env_path = Path(".env")
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        os.environ.setdefault(k, v)


class Settings:
    def __init__(self) -> None:
        # Optional Nebius / NVIDIA NIM (OpenAI-compatible) for policy compile + context review
        self.nebius_api_key: str = os.getenv("NEBIUS_API_KEY", "") or os.getenv("NVIDIA_API_KEY", "")
        self.nebius_base_url: str = os.getenv(
            "NEBIUS_BASE_URL",
            os.getenv("NVIDIA_BASE_URL", "https://api.studio.nebius.ai/v1"),
        )
        # Nemotron model IDs (override if your NIM endpoint uses different names)
        self.nemotron_ultra_model: str = os.getenv(
            "NEMOTRON_ULTRA_MODEL", "nvidia/NVIDIA-Nemotron-Ultra-253B-A10B"
        )
        self.nemotron_super_model: str = os.getenv(
            "NEMOTRON_SUPER_MODEL", "nvidia/Llama-3_3-Nemotron-Super-49B-v1"
        )
        self.nemotron_nano_model: str = os.getenv(
            "NEMOTRON_NANO_MODEL", "nvidia/NVIDIA-Nemotron-Nano-9B-v2"
        )

        self.fernet_key: Optional[str] = os.getenv("FERNET_KEY") or None
        self.audit_db_path: str = os.getenv("AUDIT_DB_PATH", "./data/audit.db")
        self.policy_dir: str = os.getenv("POLICY_DIR", "./config/policies")
        self.vault_dir: str = os.getenv("VAULT_DIR", "./data/vault")
        self.api_key: str = os.getenv("FIREWALL_API_KEY", "")

        origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )
        self.cors_origins: List[str] = [o.strip() for o in origins.split(",") if o.strip()]
        self.min_confidence: float = float(os.getenv("MIN_CONFIDENCE", "0.55"))

        self.auth_username: str = os.getenv("AUTH_USERNAME", "admin")
        self.auth_password: str = os.getenv("AUTH_PASSWORD", "shihezu")
        self.auth_secret: str = (
            os.getenv("AUTH_SECRET")
            or os.getenv("FIREWALL_API_KEY")
            or "shihezu-dev-secret-change-me"
        )
        self.auth_required: bool = os.getenv("AUTH_REQUIRED", "true").lower() in (
            "1",
            "true",
            "yes",
        )

    def ensure_dirs(self) -> None:
        Path(self.policy_dir).mkdir(parents=True, exist_ok=True)
        Path(self.vault_dir).mkdir(parents=True, exist_ok=True)
        Path(self.audit_db_path).parent.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()
    return s
