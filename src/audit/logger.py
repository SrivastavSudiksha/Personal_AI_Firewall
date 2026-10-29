"""Append-only audit log with SHA-256 chain (no raw PII)."""

from __future__ import annotations
import hashlib
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
# logger stub
class _L:
    def info(self,*a,**k): pass
    def warning(self,*a,**k): print("[WARN]",*a)
    def error(self,*a,**k): print("[ERR]",*a)
logger = _L()
from src.models.schemas import AuditEvent, ActionType, RiskLevel
from src.utils.config import get_settings


class AuditLogger:
    def __init__(self) -> None:
        self.db_path = Path(get_settings().audit_db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _init(self) -> None:
        with sqlite3.connect(self.db_path) as c:
            c.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    event_id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    agent_id TEXT,
                    session_id TEXT,
                    tool_name TEXT,
                    risk_level TEXT,
                    decision TEXT,
                    lineage_ids TEXT,
                    tokens_used TEXT,
                    details TEXT,
                    prev_hash TEXT,
                    hash TEXT NOT NULL
                )
            """)
            c.execute("CREATE INDEX IF NOT EXISTS idx_sess ON audit_log(session_id)")
            c.commit()

    def _last_hash(self) -> Optional[str]:
        with sqlite3.connect(self.db_path) as c:
            row = c.execute("SELECT hash FROM audit_log ORDER BY timestamp DESC LIMIT 1").fetchone()
            return row[0] if row else None

    def _hash(self, event: AuditEvent, prev: Optional[str]) -> str:
        payload = {
            "event_id": event.event_id,
            "timestamp": event.timestamp.isoformat(),
            "event_type": event.event_type,
            "agent_id": event.agent_id,
            "session_id": event.session_id,
            "tool_name": event.tool_name,
            "risk_level": event.risk_level.value if event.risk_level else None,
            "decision": event.decision.value if event.decision else None,
            "lineage_ids": event.lineage_ids,
            "tokens_used": event.tokens_used,
            "details": event.details,
            "prev_hash": prev,
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()

    def log(self, event: AuditEvent) -> AuditEvent:
        prev = self._last_hash()
        event.prev_hash = prev
        event.hash = self._hash(event, prev)
        with sqlite3.connect(self.db_path) as c:
            c.execute(
                """INSERT INTO audit_log VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    event.event_id, event.timestamp.isoformat(), event.event_type,
                    event.agent_id, event.session_id, event.tool_name,
                    event.risk_level.value if event.risk_level else None,
                    event.decision.value if event.decision else None,
                    json.dumps(event.lineage_ids), json.dumps(event.tokens_used),
                    json.dumps(event.details, default=str),
                    event.prev_hash, event.hash,
                ),
            )
            c.commit()
        return event

    def verify_chain(self) -> bool:
        with sqlite3.connect(self.db_path) as c:
            rows = c.execute(
                "SELECT event_id,timestamp,event_type,agent_id,session_id,tool_name,"
                "risk_level,decision,lineage_ids,tokens_used,details,prev_hash,hash "
                "FROM audit_log ORDER BY timestamp ASC"
            ).fetchall()
        prev = None
        for row in rows:
            ev = AuditEvent(
                event_id=row[0],
                timestamp=datetime.fromisoformat(row[1]),
                event_type=row[2],
                agent_id=row[3] or "",
                session_id=row[4] or "",
                tool_name=row[5],
                risk_level=RiskLevel(row[6]) if row[6] else None,
                decision=ActionType(row[7]) if row[7] else None,
                lineage_ids=json.loads(row[8] or "[]"),
                tokens_used=json.loads(row[9] or "[]"),
                details=json.loads(row[10] or "{}"),
                prev_hash=row[11],
                hash=row[12],
            )
            expected = self._hash(ev, prev)
            if ev.hash != expected or ev.prev_hash != prev:
                logger.error(f"Chain broken at {ev.event_id}")
                return False
            prev = ev.hash
        return True

    def query(self, session_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as c:
            c.row_factory = sqlite3.Row
            if session_id:
                rows = c.execute(
                    "SELECT * FROM audit_log WHERE session_id=? ORDER BY timestamp DESC LIMIT ?",
                    (session_id, limit),
                ).fetchall()
            else:
                rows = c.execute(
                    "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?", (limit,)
                ).fetchall()
            return [dict(r) for r in rows]
