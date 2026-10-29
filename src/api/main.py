"""Personal AI Firewall – FastAPI application."""

from __future__ import annotations
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel, Field

from src.audit.logger import AuditLogger
from src.auth.session import AuthUser, check_password, create_token, verify_token
from src.gate.action_gate import ActionGate
from src.guardian.guardian import DataGuardian
from src.models.schemas import (
    ApprovalRequest,
    AuditEvent,
    GateDecision,
    GuardianResult,
    PolicyCompileRequest,
    PolicyCompileResponse,
    PolicyRule,
    RedactionAction,
    ToolCall,
)
from src.policy.engine import PolicyEngine
from src.redteam.loop import RedTeamLoop
from src.utils.config import get_settings

policy_engine: PolicyEngine
guardian: DataGuardian
gate: ActionGate
audit: AuditLogger
redteam: RedTeamLoop


class _L:
    def info(self, *a, **k): print("[INFO]", *a)
    def warning(self, *a, **k): print("[WARN]", *a)
    def error(self, *a, **k): print("[ERR]", *a)


logger = _L()


async def require_auth(
    authorization: Optional[str] = Header(default=None),
    x_api_key: Optional[str] = Header(default=None),
) -> Optional[AuthUser]:
    """Require login token (Bearer) or legacy X-API-Key when auth is enabled."""
    settings = get_settings()

    # API key path (service-to-service)
    if settings.api_key and x_api_key and x_api_key == settings.api_key:
        return AuthUser(username="service", role="service")

    # Bearer session token
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    user = verify_token(token) if token else None
    if user:
        return user

    if not settings.auth_required and not settings.api_key:
        return AuthUser(username="local", role="owner")

    raise HTTPException(status_code=401, detail="Login required")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global policy_engine, guardian, gate, audit, redteam
    logger.info("Starting Personal AI Firewall...")
    policy_engine = PolicyEngine()
    guardian = DataGuardian()
    gate = ActionGate(policy_engine, guardian)
    audit = AuditLogger()
    redteam = RedTeamLoop(policy_engine, gate)
    logger.info("Ready.")
    yield


app = FastAPI(
    title="Shihezu Personal AI Firewall",
    description="Security layer for personal AI agents",
    version="0.3.0",
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Auth ----
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


@app.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = check_password(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(user.username, user.role)
    try:
        audit.log(
            AuditEvent(
                event_type="login",
                agent_id=user.username,
                session_id="auth",
                decision="allowed",
                details={"role": user.role},
            )
        )
    except Exception:
        pass
    return LoginResponse(access_token=token, username=user.username, role=user.role)


@app.get("/auth/me")
async def me(user: AuthUser = Depends(require_auth)):
    return {"username": user.username, "role": user.role}


@app.post("/auth/logout")
async def logout(user: AuthUser = Depends(require_auth)):
    # Stateless tokens — client discards. Log the event.
    try:
        audit.log(
            AuditEvent(
                event_type="logout",
                agent_id=user.username,
                session_id="auth",
                decision="logged",
                details={},
            )
        )
    except Exception:
        pass
    return {"status": "ok"}


@app.get("/health")
async def health():
    s = get_settings()
    return {
        "status": "ok",
        "mode": "online" if s.nebius_api_key else "offline",
        "auth_required": s.auth_required,
        "policies_loaded": len(policy_engine.list_rules()) if policy_engine else 0,
    }


@app.get("/stats")
async def stats(user: AuthUser = Depends(require_auth)):
    events = audit.query(limit=500)
    decisions = {}
    for e in events:
        d = e.get("decision") or "unknown"
        decisions[d] = decisions.get(d, 0) + 1
    return {
        "audit_events": len(events),
        "decisions": decisions,
        "policies": len(policy_engine.list_rules()),
        "chain_valid": audit.verify_chain(),
        "user": user.username,
    }


# ---- Guardian ----
class ProtectRequest(BaseModel):
    text: str
    action: RedactionAction = RedactionAction.REDACT
    source_document: Optional[str] = None


@app.post("/guardian/protect", response_model=GuardianResult)
async def protect(req: ProtectRequest, user: AuthUser = Depends(require_auth)):
    return await guardian.protect(
        req.text,
        req.action,
        req.source_document,
        min_confidence=get_settings().min_confidence,
    )


# ---- Policy ----
@app.post("/policy/compile", response_model=PolicyCompileResponse)
async def compile_policy(req: PolicyCompileRequest, user: AuthUser = Depends(require_auth)):
    return await policy_engine.compile(req)


@app.post("/policy/save")
async def save_policy(rule: PolicyRule, user: AuthUser = Depends(require_auth)):
    path = policy_engine.save_rule(rule)
    return {"saved": path, "hash": rule.hash, "id": rule.id, "name": rule.name}


@app.get("/policy/rules", response_model=List[PolicyRule])
async def list_rules(user: AuthUser = Depends(require_auth)):
    return policy_engine.list_rules()


# ---- Gate ----
@app.post("/gate/evaluate", response_model=GateDecision)
async def evaluate(tool_call: ToolCall, user: AuthUser = Depends(require_auth)):
    decision = await gate.evaluate(tool_call)
    audit.log(
        AuditEvent(
            event_type="tool_call_evaluated",
            agent_id=tool_call.agent_id,
            session_id=tool_call.session_id,
            tool_name=tool_call.tool_name,
            risk_level=decision.risk.level,
            decision=decision.action,
            details={
                "score": decision.risk.score,
                "explanation": decision.risk.explanation,
                "matched_policies": decision.risk.matched_policies,
                "by": user.username,
            },
        )
    )
    return decision


@app.post("/gate/approve")
async def approve(req: ApprovalRequest, user: AuthUser = Depends(require_auth)):
    audit.log(
        AuditEvent(
            event_type="human_approval",
            agent_id=user.username,
            session_id="approval",
            details={
                "decision_id": req.decision_id,
                "choice": req.choice,
                "note": req.user_note,
            },
        )
    )
    return {"status": "recorded", "choice": req.choice}


# ---- Audit ----
@app.get("/audit/verify")
async def verify(user: AuthUser = Depends(require_auth)):
    return {"chain_valid": audit.verify_chain()}


@app.get("/audit/events")
async def events(
    session_id: Optional[str] = None,
    limit: int = 50,
    user: AuthUser = Depends(require_auth),
):
    return audit.query(session_id=session_id, limit=limit)


# ---- Red Team ----
@app.post("/redteam/run")
async def run_redteam(n_attacks: int = 3, user: AuthUser = Depends(require_auth)):
    return await redteam.run_cycle(n_attacks)


# ---- Full demo ----
class DemoRequest(BaseModel):
    text: str
    tool_name: str = "email_send"
    destination: str = "external"
    session_id: str = "demo"


@app.post("/demo/full")
async def demo_full(req: DemoRequest, user: AuthUser = Depends(require_auth)):
    guard = await guardian.protect(req.text, RedactionAction.TOKENIZE)
    decision = await gate.evaluate(
        ToolCall(
            tool_name=req.tool_name,
            arguments={"body": req.text},
            destination=req.destination,
            agent_id="demo",
            session_id=req.session_id,
        )
    )
    return {"guardian": guard, "gate": decision}
