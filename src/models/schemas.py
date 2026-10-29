"""Pydantic schemas for Personal AI Firewall."""

from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ActionType(str, Enum):
    ALLOW = "allow"
    ALLOW_LOG = "allow_log"
    REQUIRE_APPROVAL = "require_approval"
    BLOCK = "block"
    KILL_SESSION = "kill_session"


class RedactionAction(str, Enum):
    REDACT = "redact"
    TOKENIZE = "tokenize"
    SYNTHETIC = "synthetic"
    NONE = "none"


class PolicyEffect(str, Enum):
    ALLOW = "allow"
    DENY = "deny"
    REQUIRE_APPROVAL = "require_approval"
    REDACT = "redact"


class SensitivityLabel(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class PolicyRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str = ""
    natural_language: str = ""
    effect: PolicyEffect
    conditions: Dict[str, Any] = Field(default_factory=dict)
    priority: int = 100
    enabled: bool = True
    version: str = "1.0.0"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    hash: Optional[str] = None


class PolicyDocument(BaseModel):
    version: str = "1.0.0"
    rules: List[PolicyRule] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PolicyCompileRequest(BaseModel):
    natural_language: str


class PolicyCompileResponse(BaseModel):
    rule: PolicyRule
    edge_cases: List[str] = Field(default_factory=list)
    conflicts: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class DetectedEntity(BaseModel):
    entity_id: str = Field(default_factory=lambda: str(uuid4()))
    entity_type: str
    original_value: str
    start: int
    end: int
    confidence: float
    sensitivity: SensitivityLabel = SensitivityLabel.CONFIDENTIAL
    lineage_id: str = Field(default_factory=lambda: str(uuid4()))
    source_document: Optional[str] = None


class GuardianResult(BaseModel):
    original_text: str
    cleaned_text: str
    entities: List[DetectedEntity]
    actions_taken: List[Dict[str, Any]]
    latency_ms: float


class ToolCall(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]
    destination: str = "external"
    agent_id: str = "default"
    session_id: str = "default"


class RiskScore(BaseModel):
    score: float
    level: RiskLevel
    factors: Dict[str, float]
    matched_policies: List[str]
    explanation: str


class GateDecision(BaseModel):
    decision_id: str = Field(default_factory=lambda: str(uuid4()))
    action: ActionType
    risk: RiskScore
    requires_approval: bool
    approval_prompt: Optional[str] = None
    modified_arguments: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ApprovalRequest(BaseModel):
    decision_id: str
    choice: str  # allow | deny | allow_with_redaction
    user_note: Optional[str] = None


class AuditEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    event_type: str
    agent_id: str = ""
    session_id: str = ""
    tool_name: Optional[str] = None
    risk_level: Optional[RiskLevel] = None
    decision: Optional[ActionType] = None
    lineage_ids: List[str] = Field(default_factory=list)
    tokens_used: List[str] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)
    prev_hash: Optional[str] = None
    hash: Optional[str] = None
