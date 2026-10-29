/** Live client for Personal AI Firewall FastAPI backend. */

import { getToken } from "@/lib/auth"

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://127.0.0.1:8000"

const API_KEY =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_KEY) || ""

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  }
  const token = getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`
  if (API_KEY) headers["X-API-Key"] = API_KEY

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("shihezu_token")
      localStorage.removeItem("shihezu_user")
      window.dispatchEvent(new Event("shihezu-auth-lost"))
    }
    throw new Error("Session expired. Please sign in again.")
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `API ${res.status}: ${path}`)
  }
  return res.json() as Promise<T>
}

export type ProtectResult = {
  original_text: string
  cleaned_text: string
  entities: {
    entity_type: string
    original_value: string
    confidence: number
    sensitivity: string
    lineage_id: string
  }[]
  actions_taken: { type: string; action: string; replacement: string }[]
  latency_ms: number
}

export type GateDecision = {
  decision_id: string
  action: string
  requires_approval: boolean
  approval_prompt?: string
  risk: {
    score: number
    level: string
    explanation: string
    matched_policies: string[]
    factors: Record<string, number>
  }
  modified_arguments?: Record<string, unknown>
}

export type AuditRow = {
  event_id?: string
  timestamp?: string
  event_type?: string
  agent_id?: string
  session_id?: string
  tool_name?: string
  risk_level?: string
  decision?: string
  details?: string
  prev_hash?: string
  hash?: string
}

export type PolicyRuleDTO = {
  id: string
  name: string
  description?: string
  natural_language?: string
  effect: string
  conditions?: Record<string, unknown>
  priority?: number
  enabled?: boolean
  version?: string
  hash?: string | null
}

export const api = {
  base: API_BASE,

  health: () =>
    request<{ status: string; mode: string; auth_required: boolean; policies_loaded: number }>(
      "/health"
    ),

  stats: () =>
    request<{
      audit_events: number
      decisions: Record<string, number>
      policies: number
      chain_valid: boolean
    }>("/stats"),

  protect: (text: string, action: "redact" | "tokenize" | "synthetic" = "redact") =>
    request<ProtectResult>("/guardian/protect", {
      method: "POST",
      body: JSON.stringify({ text, action }),
    }),

  evaluate: (payload: {
    tool_name: string
    arguments: Record<string, unknown>
    destination?: string
    agent_id?: string
    session_id?: string
  }) =>
    request<GateDecision>("/gate/evaluate", {
      method: "POST",
      body: JSON.stringify({
        destination: "external",
        agent_id: "ui",
        session_id: `ui-${Date.now()}`,
        ...payload,
      }),
    }),

  redteam: (n = 3) =>
    request<{ block_rate: number; n_attacks: number; results: unknown[] }>(
      `/redteam/run?n_attacks=${n}`,
      { method: "POST" }
    ),

  auditEvents: (limit = 50) => request<AuditRow[]>(`/audit/events?limit=${limit}`),

  auditVerify: () => request<{ chain_valid: boolean }>("/audit/verify"),

  listPolicies: () => request<PolicyRuleDTO[]>("/policy/rules"),

  compilePolicy: (natural_language: string) =>
    request<{
      rule: PolicyRuleDTO
      edge_cases: string[]
      warnings: string[]
      conflicts?: string[]
    }>("/policy/compile", {
      method: "POST",
      body: JSON.stringify({ natural_language }),
    }),

  savePolicy: (rule: PolicyRuleDTO) =>
    request<{ saved: string; hash: string; id: string; name: string }>("/policy/save", {
      method: "POST",
      body: JSON.stringify(rule),
    }),
}
