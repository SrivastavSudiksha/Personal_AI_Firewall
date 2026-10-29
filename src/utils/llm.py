"""Optional OpenAI-compatible client (Nebius / NVIDIA NIM). Offline without a key."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from src.utils.config import get_settings

try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


class LLMClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.enabled = bool(settings.nebius_api_key) and HAS_OPENAI
        self.ultra = settings.nemotron_ultra_model
        self.super = settings.nemotron_super_model
        self.nano = settings.nemotron_nano_model
        if self.enabled:
            self.client = AsyncOpenAI(
                api_key=settings.nebius_api_key,
                base_url=settings.nebius_base_url,
            )
        else:
            self.client = None

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "nano",
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> str:
        if not self.enabled:
            raise RuntimeError("LLM not configured. Set NEBIUS_API_KEY or NVIDIA_API_KEY.")
        model_map = {"ultra": self.ultra, "super": self.super, "nano": self.nano}
        model_id = model_map.get(model, self.nano)
        resp = await self.client.chat.completions.create(
            model=model_id,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content or ""

    async def chat_json(
        self,
        messages: List[Dict[str, str]],
        model: str = "nano",
        temperature: float = 0.1,
    ) -> Dict[str, Any]:
        content = await self.chat(messages, model=model, temperature=temperature)
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                return json.loads(match.group())
            raise ValueError(f"Could not parse JSON: {content[:200]}")


_llm: Optional[LLMClient] = None


def get_llm() -> LLMClient:
    global _llm
    if _llm is None:
        _llm = LLMClient()
    return _llm
