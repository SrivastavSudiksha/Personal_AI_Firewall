#!/usr/bin/env python3
"""Offline demo of Personal AI Firewall."""

import asyncio
import sys
sys.path.insert(0, ".")

from src.guardian.guardian import DataGuardian
from src.policy.engine import PolicyEngine
from src.gate.action_gate import ActionGate
from src.models.schemas import RedactionAction, ToolCall, AuditEvent
from src.redteam.loop import RedTeamLoop
from src.audit.logger import AuditLogger


async def main():
    print("=" * 60)
    print("  Personal AI Firewall – Offline Demo")
    print("=" * 60)

    guardian = DataGuardian()
    policy = PolicyEngine()
    gate = ActionGate(policy, guardian)
    audit = AuditLogger()
    redteam = RedTeamLoop(policy, gate)

    sample = (
        "Dear Bank, my PAN is ABCDE1234F, Aadhaar 2345 6789 0123, "
        "Account 123456789012, IFSC SBIN0001234, Phone +919876543210, "
        "Email ramesh@gmail.com, UPI ramesh@oksbi, Card 4111 1111 1111 1111."
    )
    print("\n[1] Data Guardian – Protect text")
    print("-" * 40)
    result = await guardian.protect(sample, action=RedactionAction.REDACT)
    print("Original:", sample[:100] + "...")
    print("Cleaned :", result.cleaned_text)
    print(f"\nDetected {len(result.entities)} entities (latency {result.latency_ms} ms):")
    for e in result.entities:
        print(f"  {e.entity_type:12} | {e.original_value:25} | conf={e.confidence:.2f} | {e.sensitivity.value}")

    print("\n[2] Action Gate – Evaluate risky tool call")
    print("-" * 40)
    decision = await gate.evaluate(ToolCall(
        tool_name="email_send",
        arguments={"body": sample, "to": "vendor@example.com"},
        destination="external",
        agent_id="demo",
        session_id="demo-1",
    ))
    print(f"Action        : {decision.action.value}")
    print(f"Risk Level    : {decision.risk.level.value}  (score={decision.risk.score})")
    print(f"Explanation   : {decision.risk.explanation}")
    print(f"Matched Policy: {decision.risk.matched_policies}")
    if decision.approval_prompt:
        print("\nApproval Prompt:")
        print(decision.approval_prompt)

    audit.log(AuditEvent(
        event_type="demo_run",
        agent_id="demo",
        session_id="demo-1",
        tool_name="email_send",
        risk_level=decision.risk.level,
        decision=decision.action,
        details={"note": "offline demo"},
    ))
    print(f"\n[3] Audit chain valid: {audit.verify_chain()}")

    print("\n[4] Living Red-Team (3 attacks)")
    print("-" * 40)
    rt = await redteam.run_cycle(3)
    print(f"Block rate: {rt['block_rate']*100:.0f}%")
    for r in rt["results"]:
        status = "BLOCKED" if r["blocked"] else "BYPASSED"
        print(f"  [{status:8}] {r['attack_type']:20} risk={r['risk_level']:8} → {r['action']}")

    print("\n" + "=" * 60)
    print("Demo complete.")
    print("To start API (after pip install fastapi uvicorn):")
    print("  uvicorn src.api.main:app --reload --port 8000")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
