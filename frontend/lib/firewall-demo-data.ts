export type DashboardSection =
  | "Overview"
  | "Policy Engine"
  | "Data Guardian"
  | "Action Gate"
  | "Living Red Team"
  | "Audit Log"
  | "Agents & Sandbox"

export type ApprovalStatus = "pending" | "allowed" | "redacted" | "denied" | "blocked"
export type ApprovalDecision = "allowed" | "redacted" | "denied"
export type RiskLevel = "Low" | "Medium" | "High" | "Critical"

export interface ApprovalRequest {
  id: string
  title: string
  agent: string
  tool: string
  dataType: string
  reason: string
  lineage: string
  risk: Extract<RiskLevel, "High" | "Critical">
  time: string
  status: ApprovalStatus
}

export interface FirewallEvent {
  id: string
  time: string
  actor: string
  tool: string
  summary: string
  finding: string
  decision: "Blocked" | "Approval needed" | "Allowed" | "Logged"
  risk: RiskLevel
  lineage: string
  hash: string
  previousHash: string
}

export interface FirewallPolicy {
  id: string
  name: string
  rule: string
  scope: string
  status: "Active" | "Draft" | "Needs review"
  version: string
  hash: string
  updated: string
  conflict?: boolean
}

export interface DemoAgent {
  id: string
  name: string
  purpose: string
  model: string
  namespace: string
  tools: { name: string; access: string }[]
}

export interface ActivityPoint {
  label: string
  inspected: number
  blocked: number
  approvals: number
}

export const initialApprovals: ApprovalRequest[] = [
  {
    id: "APR-091",
    title: "Send a statement summary to an external email tool",
    agent: "Finance assistant",
    tool: "Email MCP · external",
    dataType: "Bank details · 2 fields",
    reason: "A bank statement reference was found in the agent context. The destination is outside the trusted workspace.",
    lineage: "LIN-7D42",
    risk: "High",
    time: "2 min ago",
    status: "pending",
  },
  {
    id: "APR-090",
    title: "Share precise location with a maps tool",
    agent: "Travel planner",
    tool: "Maps MCP · external",
    dataType: "Precise location · 1 field",
    reason: "The request would disclose a precise location. Your policy asks for confirmation before external sharing.",
    lineage: "LIN-A2B1",
    risk: "High",
    time: "8 min ago",
    status: "pending",
  },
  {
    id: "APR-087",
    title: "Medical report routed to a cloud drive",
    agent: "Inbox triage",
    tool: "Drive MCP · external",
    dataType: "Medical report · 3 fields",
    reason: "Medical reports are restricted to local models by policy. The critical call was blocked and its sample session stopped.",
    lineage: "LIN-C811",
    risk: "Critical",
    time: "21 min ago",
    status: "blocked",
  },
]

export const initialAuditEvents: FirewallEvent[] = [
  {
    id: "EVT-2048",
    time: "11:42:08",
    actor: "Finance assistant",
    tool: "Email MCP",
    summary: "External send paused for review",
    finding: "Bank details · 2 fields",
    decision: "Approval needed",
    risk: "High",
    lineage: "LIN-7D42",
    hash: "a81f…93c2",
    previousHash: "42d0…f8b1",
  },
  {
    id: "EVT-2047",
    time: "11:39:51",
    actor: "Research scout",
    tool: "Browser fetch",
    summary: "Indirect prompt injection blocked",
    finding: "Untrusted web content",
    decision: "Blocked",
    risk: "Critical",
    lineage: "LIN-6BA9",
    hash: "6f03…c21a",
    previousHash: "a927…041e",
  },
  {
    id: "EVT-2046",
    time: "11:33:14",
    actor: "Finance assistant",
    tool: "Local reasoning model",
    summary: "Sensitive reference tokenized",
    finding: "Bank details · 1 field",
    decision: "Allowed",
    risk: "Medium",
    lineage: "LIN-7D42",
    hash: "c409…8b17",
    previousHash: "dda2…9c40",
  },
  {
    id: "EVT-2045",
    time: "11:20:03",
    actor: "Travel planner",
    tool: "Maps MCP",
    summary: "Location share held for approval",
    finding: "Precise location · 1 field",
    decision: "Approval needed",
    risk: "High",
    lineage: "LIN-A2B1",
    hash: "e511…ab20",
    previousHash: "50f1…b223",
  },
  {
    id: "EVT-2044",
    time: "11:06:42",
    actor: "Inbox triage",
    tool: "Files read",
    summary: "Read-only document access permitted",
    finding: "No sensitive values",
    decision: "Logged",
    risk: "Low",
    lineage: "LIN-2CC4",
    hash: "d821…13e4",
    previousHash: "1c07…99af",
  },
  {
    id: "EVT-2043",
    time: "10:58:17",
    actor: "Research scout",
    tool: "Browser fetch",
    summary: "Untrusted HTML stripped before review",
    finding: "Prompt-like content · 1 block",
    decision: "Blocked",
    risk: "Critical",
    lineage: "LIN-6BA9",
    hash: "ab99…d10c",
    previousHash: "f14a…a31d",
  },
  {
    id: "EVT-2042",
    time: "10:44:09",
    actor: "Finance assistant",
    tool: "Files read",
    summary: "Statement scanned with local recognizers",
    finding: "PAN · masked in preview",
    decision: "Allowed",
    risk: "Medium",
    lineage: "LIN-7D42",
    hash: "b314…7ac0",
    previousHash: "a0e0…6f5d",
  },
  {
    id: "EVT-2041",
    time: "10:28:33",
    actor: "Inbox triage",
    tool: "Email MCP",
    summary: "Routine reply sent after policy check",
    finding: "No sensitive values",
    decision: "Logged",
    risk: "Low",
    lineage: "LIN-2CC4",
    hash: "8ec2…2249",
    previousHash: "6174…d908",
  },
]

export const initialPolicies: FirewallPolicy[] = [
  {
    id: "POL-014",
    name: "Banking details stay private",
    rule: "Never send account numbers or balances from bank statements to an external tool.",
    scope: "Financial data · external tools",
    status: "Active",
    version: "v1.4",
    hash: "9f2a7c1",
    updated: "Updated 2 hours ago",
  },
  {
    id: "POL-013",
    name: "Medical reports are local-only",
    rule: "Show medical reports only to local models. Block external destinations.",
    scope: "Health data · all agents",
    status: "Active",
    version: "v1.2",
    hash: "b1e44a9",
    updated: "Updated yesterday",
  },
  {
    id: "POL-012",
    name: "Confirm location sharing",
    rule: "Ask me before any tool call shares my precise location.",
    scope: "Location · external tools",
    status: "Active",
    version: "v1.1",
    hash: "e82d531",
    updated: "Updated Oct 26",
  },
  {
    id: "POL-011",
    name: "Mask identifiers in summaries",
    rule: "Replace personal identifiers with reversible tokens before a summary reaches a cloud model.",
    scope: "Personal identifiers · cloud models",
    status: "Needs review",
    version: "v0.9",
    hash: "7d2c3f0",
    updated: "Updated Oct 24",
    conflict: true,
  },
]

export const activityByRange: Record<"24 hours" | "7 days", ActivityPoint[]> = {
  "24 hours": [
    { label: "08:00", inspected: 54, blocked: 5, approvals: 3 },
    { label: "10:00", inspected: 76, blocked: 8, approvals: 4 },
    { label: "12:00", inspected: 62, blocked: 4, approvals: 6 },
    { label: "14:00", inspected: 98, blocked: 12, approvals: 7 },
    { label: "16:00", inspected: 83, blocked: 9, approvals: 5 },
    { label: "18:00", inspected: 114, blocked: 15, approvals: 8 },
    { label: "20:00", inspected: 91, blocked: 10, approvals: 6 },
    { label: "22:00", inspected: 126, blocked: 17, approvals: 10 },
  ],
  "7 days": [
    { label: "Mon", inspected: 680, blocked: 44, approvals: 26 },
    { label: "Tue", inspected: 810, blocked: 51, approvals: 38 },
    { label: "Wed", inspected: 745, blocked: 36, approvals: 29 },
    { label: "Thu", inspected: 970, blocked: 72, approvals: 48 },
    { label: "Fri", inspected: 890, blocked: 61, approvals: 41 },
    { label: "Sat", inspected: 612, blocked: 39, approvals: 23 },
    { label: "Sun", inspected: 1040, blocked: 88, approvals: 57 },
  ],
}

export const demoAgents: DemoAgent[] = [
  {
    id: "agent-finance",
    name: "Finance assistant",
    purpose: "Summarizes statements and prepares budget notes.",
    model: "Nemotron Nano · routed",
    namespace: "agent.finance.01",
    tools: [
      { name: "Files read", access: "Read-only" },
      { name: "Email send", access: "Approval gate" },
      { name: "Local model", access: "Trusted" },
    ],
  },
  {
    id: "agent-research",
    name: "Research scout",
    purpose: "Finds sources and returns a sourced brief.",
    model: "Nemotron Super · routed",
    namespace: "agent.research.02",
    tools: [
      { name: "Browser fetch", access: "Sandboxed" },
      { name: "Files read", access: "Read-only" },
      { name: "Email send", access: "Not allowed" },
    ],
  },
  {
    id: "agent-inbox",
    name: "Inbox triage",
    purpose: "Labels messages and drafts low-risk replies.",
    model: "Nemotron Nano · routed",
    namespace: "agent.inbox.03",
    tools: [
      { name: "Email read", access: "Scoped" },
      { name: "Email send", access: "Approval gate" },
      { name: "Drive write", access: "Not allowed" },
    ],
  },
]
