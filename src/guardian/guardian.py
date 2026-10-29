"""Multi-stage Data Guardian – offline-first, hardened."""

from __future__ import annotations
import time
from typing import List, Optional

from src.guardian.recognizers import deterministic_scan
from src.guardian.vault import TokenVault
from src.models.schemas import (
    DetectedEntity,
    GuardianResult,
    RedactionAction,
    SensitivityLabel,
)

SENSITIVITY = {
    "AADHAAR": SensitivityLabel.RESTRICTED,
    "PAN": SensitivityLabel.RESTRICTED,
    "ACCOUNT_NO": SensitivityLabel.RESTRICTED,
    "CREDIT_CARD": SensitivityLabel.RESTRICTED,
    "API_KEY": SensitivityLabel.RESTRICTED,
    "BALANCE": SensitivityLabel.RESTRICTED,
    "IFSC": SensitivityLabel.CONFIDENTIAL,
    "UPI": SensitivityLabel.CONFIDENTIAL,
    "PHONE_IN": SensitivityLabel.CONFIDENTIAL,
    "EMAIL": SensitivityLabel.INTERNAL,
}


class DataGuardian:
    def __init__(self) -> None:
        self.vault = TokenVault()

    async def protect(
        self,
        text: str,
        action: RedactionAction = RedactionAction.REDACT,
        source_document: Optional[str] = None,
        min_confidence: float = 0.50,
    ) -> GuardianResult:
        t0 = time.perf_counter()
        matches = deterministic_scan(text)
        matches = [m for m in matches if m.confidence >= min_confidence]

        entities: List[DetectedEntity] = []
        actions_taken: List[dict] = []
        cleaned = text

        for m in sorted(matches, key=lambda x: x.start, reverse=True):
            sens = SENSITIVITY.get(m.entity_type, SensitivityLabel.INTERNAL)
            ent = DetectedEntity(
                entity_type=m.entity_type,
                original_value=m.value,
                start=m.start,
                end=m.end,
                confidence=m.confidence,
                sensitivity=sens,
                source_document=source_document,
            )
            entities.append(ent)

            if action == RedactionAction.REDACT:
                replacement = f"[REDACTED:{m.entity_type}]"
            elif action == RedactionAction.TOKENIZE:
                replacement = self.vault.tokenize(m.value, m.entity_type)
            elif action == RedactionAction.SYNTHETIC:
                replacement = self.vault.synthetic(m.entity_type)
            else:
                replacement = m.value

            cleaned = cleaned[: m.start] + replacement + cleaned[m.end :]
            actions_taken.append({
                "entity_id": ent.entity_id,
                "lineage_id": ent.lineage_id,
                "type": m.entity_type,
                "action": action.value,
                "replacement": replacement,
                "confidence": m.confidence,
            })

        entities.reverse()
        latency = (time.perf_counter() - t0) * 1000
        return GuardianResult(
            original_text=text,
            cleaned_text=cleaned,
            entities=entities,
            actions_taken=actions_taken,
            latency_ms=round(latency, 2),
        )
