"""Action Gate – calibrated risk scoring + policy enforcement."""

from __future__ import annotations
from typing import Dict, List, Set
from src.models.schemas import (
    ActionType,
    GateDecision,
    PolicyEffect,
    RedactionAction,
    RiskLevel,
    RiskScore,
    ToolCall,
)
from src.policy.engine import PolicyEngine
from src.guardian.guardian import DataGuardian

# Tools that can leave the machine / exfiltrate
EXFIL_TOOLS: Set[str] = {
    "email_send", "http_post", "http_request", "file_upload",
    "browser", "shell", "sms_send", "webhook", "slack_post",
    "discord_post", "telegram_send",
}

# High-value restricted types
RESTRICTED_TYPES = {"PAN", "AADHAAR", "ACCOUNT_NO", "CREDIT_CARD", "API_KEY", "BALANCE"}


class ActionGate:
    def __init__(self, policy_engine: PolicyEngine, guardian: DataGuardian) -> None:
        self.policy = policy_engine
        self.guardian = guardian
        # per-agent tool allowlist (empty = allow all, then risk decides)
        self.agent_allowlists: Dict[str, Set[str]] = {}

    def set_allowlist(self, agent_id: str, tools: List[str]) -> None:
        self.agent_allowlists[agent_id] = set(tools)

    def _risk(
        self,
        tool_call: ToolCall,
        detected_types: List[str],
        max_sens: str,
        matched: List,
    ) -> RiskScore:
        factors: Dict[str, float] = {}

        # 1. Sensitivity of data present
        sens_map = {"public": 0.05, "internal": 0.20, "confidential": 0.50, "restricted": 0.85}
        factors["sensitivity"] = sens_map.get(max_sens, 0.25)

        # boost if multiple restricted types
        restricted_count = sum(1 for t in detected_types if t in RESTRICTED_TYPES)
        if restricted_count >= 2:
            factors["sensitivity"] = min(1.0, factors["sensitivity"] + 0.10)

        # 2. Destination
        dest = tool_call.destination.lower()
        if dest in ("local", "internal", "sandbox"):
            factors["destination"] = 0.05
        elif dest.startswith("agent:"):
            factors["destination"] = 0.35
        else:
            factors["destination"] = 0.70

        # 3. Tool danger
        tool = tool_call.tool_name.lower()
        if tool in EXFIL_TOOLS:
            factors["tool"] = 0.75
        elif tool in ("file_read", "file_write", "db_query"):
            factors["tool"] = 0.40
        else:
            factors["tool"] = 0.20

        # 4. Policy signal
        policy_score = 0.0
        has_deny = False
        has_approval = False
        for p in matched:
            if p.effect == PolicyEffect.DENY:
                policy_score = max(policy_score, 0.90)
                has_deny = True
            elif p.effect == PolicyEffect.REQUIRE_APPROVAL:
                policy_score = max(policy_score, 0.60)
                has_approval = True
            elif p.effect == PolicyEffect.REDACT:
                policy_score = max(policy_score, 0.40)
        factors["policy"] = policy_score

        # Weighted score
        score = (
            0.35 * factors["sensitivity"]
            + 0.25 * factors["destination"]
            + 0.20 * factors["tool"]
            + 0.20 * factors["policy"]
        )
        score = min(1.0, max(0.0, score))

        # Level bands (calibrated – not everything is critical)
        if score < 0.30:
            level = RiskLevel.LOW
        elif score < 0.55:
            level = RiskLevel.MEDIUM
        elif score < 0.80:
            level = RiskLevel.HIGH
        else:
            level = RiskLevel.CRITICAL

        # Hard overrides for clear deny + restricted + external exfil
        if has_deny and max_sens == "restricted" and dest not in ("local", "internal", "sandbox"):
            if tool in EXFIL_TOOLS:
                level = RiskLevel.CRITICAL
                score = max(score, 0.85)
            else:
                level = RiskLevel.HIGH
                score = max(score, 0.70)

        explanation = (
            f"sens={max_sens}({factors['sensitivity']:.2f}) "
            f"dest={dest}({factors['destination']:.2f}) "
            f"tool={tool_call.tool_name}({factors['tool']:.2f}) "
            f"policy={policy_score:.2f} → {level.value}"
        )
        return RiskScore(
            score=round(score, 3),
            level=level,
            factors={k: round(v, 3) for k, v in factors.items()},
            matched_policies=[p.name for p in matched],
            explanation=explanation,
        )

    async def evaluate(self, tool_call: ToolCall) -> GateDecision:
        # Allowlist hard block
        allow = self.agent_allowlists.get(tool_call.agent_id)
        if allow is not None and tool_call.tool_name not in allow:
            risk = RiskScore(
                score=1.0,
                level=RiskLevel.CRITICAL,
                factors={"allowlist": 1.0},
                matched_policies=[],
                explanation=f"Tool `{tool_call.tool_name}` not in allowlist for agent `{tool_call.agent_id}`",
            )
            return GateDecision(
                action=ActionType.KILL_SESSION,
                risk=risk,
                requires_approval=False,
                approval_prompt="Tool not permitted for this agent – session terminated.",
            )

        # Scan all string arguments
        arg_text = " ".join(str(v) for v in tool_call.arguments.values() if isinstance(v, (str, int, float)))
        guard = await self.guardian.protect(arg_text, action=RedactionAction.REDACT, min_confidence=0.50)

        detected_types = [e.entity_type for e in guard.entities]
        max_sens = "public"
        for e in guard.entities:
            if e.sensitivity.value == "restricted":
                max_sens = "restricted"
                break
            if e.sensitivity.value == "confidential" and max_sens != "restricted":
                max_sens = "confidential"
            if e.sensitivity.value == "internal" and max_sens == "public":
                max_sens = "internal"

        matched = self.policy.match(detected_types, tool_call.destination, tool_call.tool_name)
        risk = self._risk(tool_call, detected_types, max_sens, matched)

        # Map level → action
        if risk.level == RiskLevel.LOW:
            action, need_approval, prompt = ActionType.ALLOW, False, None
        elif risk.level == RiskLevel.MEDIUM:
            action, need_approval, prompt = ActionType.ALLOW_LOG, False, None
        elif risk.level == RiskLevel.HIGH:
            action, need_approval = ActionType.REQUIRE_APPROVAL, True
            ents = ", ".join(sorted(set(detected_types))) or "sensitive data"
            prompt = (
                f"Tool `{tool_call.tool_name}` is about to send [{ents}] "
                f"to `{tool_call.destination}`.\n"
                f"Risk: {risk.explanation}\n"
                f"Allow / Deny / Allow with redaction?"
            )
        else:  # CRITICAL
            # Only kill when restricted + external exfil tool; otherwise require approval
            if (
                max_sens == "restricted"
                and tool_call.destination.lower() not in ("local", "internal", "sandbox")
                and tool_call.tool_name.lower() in EXFIL_TOOLS
            ):
                action, need_approval, prompt = (
                    ActionType.KILL_SESSION,
                    False,
                    "Critical risk (restricted data + external exfil) – session terminated.",
                )
            else:
                action, need_approval = ActionType.REQUIRE_APPROVAL, True
                ents = ", ".join(sorted(set(detected_types))) or "sensitive data"
                prompt = (
                    f"HIGH/CRITICAL: Tool `{tool_call.tool_name}` sending [{ents}] "
                    f"to `{tool_call.destination}`.\n{risk.explanation}\n"
                    f"Allow / Deny / Allow with redaction?"
                )

        # Prepare redacted args
        modified = None
        if guard.entities:
            modified = {}
            for k, v in tool_call.arguments.items():
                if isinstance(v, str):
                    g2 = await self.guardian.protect(v, action=RedactionAction.REDACT)
                    modified[k] = g2.cleaned_text
                else:
                    modified[k] = v

        return GateDecision(
            action=action,
            risk=risk,
            requires_approval=need_approval,
            approval_prompt=prompt,
            modified_arguments=modified,
        )
