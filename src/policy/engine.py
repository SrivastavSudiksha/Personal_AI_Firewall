"""Policy Engine – load YAML rules + simple matching. LLM compile is optional."""

from __future__ import annotations
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import uuid4
import yaml
# logger stub
class _L:
    def info(self,*a,**k): pass
    def warning(self,*a,**k): print("[WARN]",*a)
    def error(self,*a,**k): print("[ERR]",*a)
logger = _L()
from src.models.schemas import (
    PolicyCompileRequest,
    PolicyCompileResponse,
    PolicyDocument,
    PolicyEffect,
    PolicyRule,
)
from src.utils.config import get_settings
from src.utils.llm import get_llm


class PolicyEngine:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.policy_dir = Path(self.settings.policy_dir)
        self.policy_dir.mkdir(parents=True, exist_ok=True)
        self._rules: List[PolicyRule] = []
        self._load_all()

    def _hash(self, rule: PolicyRule) -> str:
        payload = rule.model_dump(exclude={"hash", "created_at"})
        return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()[:12]

    def _load_all(self) -> None:
        self._rules = []
        for f in sorted(self.policy_dir.glob("*.yaml")):
            try:
                data = yaml.safe_load(f.read_text()) or {}
                doc = PolicyDocument.model_validate(data)
                self._rules.extend([r for r in doc.rules if r.enabled])
            except Exception as e:
                logger.error(f"Failed loading {f.name}: {e}")
        logger.info(f"Loaded {len(self._rules)} active policy rules")

    def list_rules(self) -> List[PolicyRule]:
        return list(self._rules)

    def match(self, data_types: List[str], destination: str, tool: str) -> List[PolicyRule]:
        matched = []
        for r in self._rules:
            cond = r.conditions or {}
            types = set(cond.get("data_types", ["*"]))
            dests = set(cond.get("destinations", ["*"]))
            tools = set(cond.get("tools", ["*"]))

            type_ok = "*" in types or bool(set(data_types) & types)
            dest_ok = "*" in dests or destination in dests or destination.startswith("external")
            tool_ok = "*" in tools or tool in tools

            if type_ok and dest_ok and tool_ok:
                matched.append(r)
        matched.sort(key=lambda x: x.priority)
        return matched

    def save_rule(self, rule: PolicyRule) -> str:
        rule.hash = self._hash(rule)
        rule.created_at = datetime.utcnow()
        fname = self.policy_dir / f"{rule.name}_{rule.hash}.yaml"
        doc = PolicyDocument(version=rule.version, rules=[rule])
        fname.write_text(yaml.dump(doc.model_dump(mode="json"), default_flow_style=False, allow_unicode=True))
        self._rules.append(rule)
        return str(fname)

    async def compile(self, req: PolicyCompileRequest) -> PolicyCompileResponse:
        """Uses LLM if available, otherwise creates a simple rule from keywords."""
        llm = get_llm()
        if llm.enabled:
            prompt = f"""Convert this natural language security rule into JSON:
{{
  "name": "short_snake_case",
  "description": "one sentence",
  "effect": "deny" | "require_approval" | "redact" | "allow",
  "conditions": {{
    "data_types": ["PAN","AADHAAR","ACCOUNT_NO","CREDIT_CARD","PHONE_IN","EMAIL","LOCATION",...],
    "destinations": ["external","local","*"],
    "tools": ["*"]
  }},
  "priority": 10,
  "edge_cases": ["..."]
}}
Rule: {req.natural_language}
Return ONLY JSON."""
            try:
                raw = await llm.chat_json(
                    [{"role": "system", "content": "Output only valid JSON."},
                     {"role": "user", "content": prompt}],
                    model="ultra",
                )
                edge = raw.pop("edge_cases", [])
                rule = PolicyRule(
                    name=raw.get("name", "custom_rule"),
                    description=raw.get("description", ""),
                    natural_language=req.natural_language,
                    effect=PolicyEffect(raw.get("effect", "deny")),
                    conditions=raw.get("conditions", {}),
                    priority=raw.get("priority", 50),
                )
                rule.hash = self._hash(rule)
                return PolicyCompileResponse(rule=rule, edge_cases=edge)
            except Exception as e:
                logger.warning(f"LLM compile failed, falling back: {e}")

        # Offline fallback – keyword heuristic
        text = req.natural_language.lower()
        data_types = []
        for kw, etype in [
            ("pan", "PAN"), ("aadhaar", "AADHAAR"), ("account", "ACCOUNT_NO"),
            ("balance", "ACCOUNT_NO"), ("card", "CREDIT_CARD"), ("phone", "PHONE_IN"),
            ("email", "EMAIL"), ("location", "LOCATION"), ("upi", "UPI"),
        ]:
            if kw in text:
                data_types.append(etype)
        if not data_types:
            data_types = ["*"]

        effect = PolicyEffect.DENY
        if "ask" in text or "approval" in text or "confirm" in text:
            effect = PolicyEffect.REQUIRE_APPROVAL
        elif "redact" in text:
            effect = PolicyEffect.REDACT

        rule = PolicyRule(
            name="offline_" + str(uuid4())[:8],
            description=req.natural_language[:120],
            natural_language=req.natural_language,
            effect=effect,
            conditions={"data_types": data_types, "destinations": ["external"], "tools": ["*"]},
            priority=20,
        )
        rule.hash = self._hash(rule)
        return PolicyCompileResponse(
            rule=rule,
            edge_cases=[],
            warnings=["Compiled offline (no LLM key) – review the rule"],
        )
