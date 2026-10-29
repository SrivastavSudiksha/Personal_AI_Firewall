"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Cloud,
  Fingerprint,
  GitBranch,
  Globe,
  KeyRound,
  Layers,
  LockKeyhole,
  Network,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Timer,
  TriangleAlert,
  UserRound,
  WandSparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MetricCard, PanelHeading, SectionHeading, StatusBadge } from "@/components/firewall-shared"
import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalStatus,
  DemoAgent,
  FirewallEvent,
} from "@/lib/firewall-demo-data"
import { api, type ProtectResult, type GateDecision, type AuditRow } from "@/lib/api"

function riskTone(risk: string) {
  if (risk === "Critical") return "danger" as const
  if (risk === "High") return "warning" as const
  if (risk === "Medium") return "info" as const
  return "safe" as const
}

function approvalTone(status: ApprovalStatus) {
  if (status === "allowed" || status === "redacted") return "safe" as const
  if (status === "blocked" || status === "denied") return "danger" as const
  return "warning" as const
}

function approvalLabel(status: ApprovalStatus) {
  if (status === "allowed") return "Allowed once"
  if (status === "redacted") return "Allowed with redaction"
  if (status === "blocked") return "Blocked · session stopped"
  if (status === "denied") return "Denied"
  return "Pending"
}

export function DataGuardianPage() {
  const [action, setAction] = useState<"redact" | "tokenize" | "synthetic">("redact")
  const [input, setInput] = useState(
    "My PAN is ABCDE1234F, Aadhaar 2345 6789 0123, account 123456789012, balance Rs. 50,000, phone +919876543210."
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProtectResult | null>(null)

  async function runProtect() {
    setBusy(true)
    setError(null)
    try {
      const data = await api.protect(input, action)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "API unreachable. Start the backend on :8000.")
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const actionCopy = {
    redact: {
      title: "Masked before the model sees it",
      output: "[REDACTED:ACCOUNT_REFERENCE]",
      note: "A one-way mask removes the value from the outgoing payload.",
    },
    tokenize: {
      title: "Reversible token issued locally",
      output: "tok_finance_LIN-7D42",
      note: "Only a token leaves the agent boundary; the encrypted vault stays local.",
    },
    synthetic: {
      title: "Format-preserving sample substituted",
      output: "[SYNTHETIC:FINANCIAL_REFERENCE]",
      note: "The agent receives a fake, valid-looking value for tasks that need a format.",
    },
  } as const

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="DATA GUARDIAN · CLASSIFY BEFORE CONTEXT"
        title="Sensitive data, handled on purpose."
        description="The cheapest recognizers run first. Context review comes last, and every transformation keeps a traceable lineage ID."
        action={<StatusBadge tone="info">SAMPLE PIPELINE</StatusBadge>}
      />

      <Card className="panel-card">
        <PanelHeading
          title="Live scan"
          description="Calls the local FastAPI Data Guardian. Start the backend on port 8000."
          action={<StatusBadge tone="safe">API</StatusBadge>}
        />
        <CardContent>
          <label className="form-field">
            <span>Text to protect</span>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} />
          </label>
          <div className="transform-tabs" role="group" aria-label="Transformation" style={{ marginTop: 12 }}>
            <button type="button" aria-pressed={action === "redact"} className={action === "redact" ? "transform-tab transform-tab--active" : "transform-tab"} onClick={() => setAction("redact")}><ShieldX aria-hidden="true" /><span>Redact</span></button>
            <button type="button" aria-pressed={action === "tokenize"} className={action === "tokenize" ? "transform-tab transform-tab--active" : "transform-tab"} onClick={() => setAction("tokenize")}><KeyRound aria-hidden="true" /><span>Tokenize</span></button>
            <button type="button" aria-pressed={action === "synthetic"} className={action === "synthetic" ? "transform-tab transform-tab--active" : "transform-tab"} onClick={() => setAction("synthetic")}><WandSparkles aria-hidden="true" /><span>Synthetic</span></button>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <Button type="button" className="action-button action-button--primary" disabled={busy} onClick={runProtect}>
              {busy ? "Scanning…" : "Run protect"}
            </Button>
            {result ? <span className="table-secondary">{result.latency_ms} ms · {result.entities.length} findings</span> : null}
          </div>
          {error ? <p className="form-error" role="alert" style={{ marginTop: 10 }}>{error}</p> : null}
          {result ? (
            <div style={{ marginTop: 14 }}>
              <span className="mini-label">CLEANED OUTPUT</span>
              <p className="output-token" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{result.cleaned_text}</p>
              {result.entities.length > 0 ? (
                <div className="recognizer-tags" style={{ marginTop: 10 }}>
                  {result.entities.map((e, i) => (
                    <StatusBadge key={`${e.entity_type}-${i}`} tone="neutral">
                      {e.entity_type} · {Math.round(e.confidence * 100)}%
                    </StatusBadge>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="pipeline-stage-grid">
        <Card className="panel-card pipeline-stage">
          <CardContent className="pipeline-stage__content">
            <div className="pipeline-stage__top"><span className="pipeline-stage__number">01</span><StatusBadge tone="safe">FASTEST</StatusBadge></div>
            <span className="pipeline-stage__icon pipeline-stage__icon--safe"><ScanLineFallback /></span>
            <h3>Deterministic checks</h3>
            <p>Patterns with checksum validation catch known formats before model calls.</p>
            <div className="recognizer-tags"><StatusBadge tone="neutral">Aadhaar · Verhoeff</StatusBadge><StatusBadge tone="neutral">PAN</StatusBadge><StatusBadge tone="neutral">IFSC</StatusBadge><StatusBadge tone="neutral">UPI ID</StatusBadge><StatusBadge tone="neutral">Card · Luhn</StatusBadge><StatusBadge tone="neutral">Secrets</StatusBadge></div>
          </CardContent>
        </Card>
        <Card className="panel-card pipeline-stage">
          <CardContent className="pipeline-stage__content">
            <div className="pipeline-stage__top"><span className="pipeline-stage__number">02</span><StatusBadge tone="info">MULTILINGUAL</StatusBadge></div>
            <span className="pipeline-stage__icon pipeline-stage__icon--info"><Layers aria-hidden="true" /></span>
            <h3>NER + Presidio</h3>
            <p>Custom recognizers add Hindi and Hinglish context to the entity pass.</p>
            <div className="language-pills"><span>हिन्दी</span><span>Hinglish</span><span>English</span></div>
          </CardContent>
        </Card>
        <Card className="panel-card pipeline-stage">
          <CardContent className="pipeline-stage__content">
            <div className="pipeline-stage__top"><span className="pipeline-stage__number">03</span><StatusBadge tone="accent">LAST RESORT</StatusBadge></div>
            <span className="pipeline-stage__icon pipeline-stage__icon--accent"><WandSparkles aria-hidden="true" /></span>
            <h3>Context review</h3>
            <p>Ambiguous values are checked against their document and destination.</p>
            <div className="model-route"><span className="model-route__dot" /><span>Nemotron Nano</span><small>illustrative route</small></div>
          </CardContent>
        </Card>
      </div>

      <div className="guardian-grid">
        <Card className="panel-card transformation-panel">
          <PanelHeading title="Choose a safe transformation" description="Preview how a detected value can be handled before a tool call." action={<StatusBadge tone="safe">LOCAL-FIRST DESIGN</StatusBadge>} />
          <CardContent>
            <div className="transform-tabs" role="group" aria-label="Sensitive data transformation">
              <button type="button" aria-pressed={action === "redact"} className={action === "redact" ? "transform-tab transform-tab--active" : "transform-tab"} onClick={() => setAction("redact")}><ShieldX aria-hidden="true" /><span>Redact</span></button>
              <button type="button" aria-pressed={action === "tokenize"} className={action === "tokenize" ? "transform-tab transform-tab--active" : "transform-tab"} onClick={() => setAction("tokenize")}><KeyRound aria-hidden="true" /><span>Tokenize</span></button>
              <button type="button" aria-pressed={action === "synthetic"} className={action === "synthetic" ? "transform-tab transform-tab--active" : "transform-tab"} onClick={() => setAction("synthetic")}><WandSparkles aria-hidden="true" /><span>Synthetic</span></button>
            </div>
            <div className="transformation-preview">
              <div className="transformation-preview__column">
                <span className="mini-label">INPUT CONTEXT · SAMPLE</span>
                <p>“Prepare this statement summary for an external assistant.”</p>
                <div className="finding-chip"><Fingerprint aria-hidden="true" /><span>Bank details · 2 fields detected</span></div>
              </div>
              <ArrowRight className="transformation-preview__arrow" aria-hidden="true" />
              <div className="transformation-preview__column transformation-preview__column--output">
                <span className="mini-label">SAFE OUTPUT</span>
                <p className="output-token">{actionCopy[action].output}</p>
                <strong>{actionCopy[action].title}</strong>
              </div>
            </div>
            <div className="transformation-footnote"><LockKeyhole aria-hidden="true" /><span>{actionCopy[action].note}</span></div>
          </CardContent>
        </Card>

        <Card className="panel-card lineage-panel">
          <PanelHeading title="Lineage stays attached" description="Explain where a finding came from without logging its raw value." action={<StatusBadge tone="info">LIN-7D42</StatusBadge>} />
          <CardContent>
            <div className="lineage-flow">
              <div className="lineage-node"><span className="lineage-node__icon"><GitBranch aria-hidden="true" /></span><div><small>SOURCE</small><strong>bank_statement.pdf</strong><span>Document · local</span></div></div>
              <div className="lineage-connector"><span /></div>
              <div className="lineage-node"><span className="lineage-node__icon lineage-node__icon--teal"><UserRound aria-hidden="true" /></span><div><small>AGENT</small><strong>Finance assistant</strong><span>Namespace · agent.finance.01</span></div></div>
              <div className="lineage-connector"><span /></div>
              <div className="lineage-node"><span className="lineage-node__icon lineage-node__icon--amber"><Globe aria-hidden="true" /></span><div><small>DESTINATION</small><strong>Email MCP</strong><span>External · approval required</span></div></div>
            </div>
            <div className="lineage-footer"><span>Raw value</span><strong>Never stored in the audit preview</strong><StatusBadge tone="safe">TOKEN ONLY</StatusBadge></div>
          </CardContent>
        </Card>
      </div>

      <Card className="panel-card recognizer-coverage">
        <PanelHeading title="Recognizer coverage" description="Coverage shown here is a design inventory, not an evaluation result." action={<StatusBadge tone="muted">ILLUSTRATIVE</StatusBadge>} />
        <CardContent className="recognizer-coverage__grid">
          <div className="coverage-item"><span className="coverage-item__icon"><Fingerprint aria-hidden="true" /></span><div><strong>India-specific identifiers</strong><p>Aadhaar checksum · PAN · IFSC · UPI</p></div><span className="coverage-item__status"><Check aria-hidden="true" />In scope</span></div>
          <div className="coverage-item"><span className="coverage-item__icon"><KeyRound aria-hidden="true" /></span><div><strong>Financial & contact data</strong><p>Card Luhn · phone · email · API secrets</p></div><span className="coverage-item__status"><Check aria-hidden="true" />In scope</span></div>
          <div className="coverage-item"><span className="coverage-item__icon"><Cloud aria-hidden="true" /></span><div><strong>Local encrypted vault</strong><p>Fernet key management is not connected</p></div><StatusBadge tone="warning">PLANNED</StatusBadge></div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ActionGatePage({
  approvals,
  onResolve,
}: {
  approvals: ApprovalRequest[]
  onResolve: (id: string, decision: ApprovalDecision) => void
}) {
  const pending = approvals.filter((approval) => approval.status === "pending")
  const resolved = approvals.filter((approval) => approval.status !== "pending")
  const [toolBody, setToolBody] = useState("Please email my PAN ABCDE1234F and balance Rs. 1,25,000 to vendor@example.com")
  const [gateBusy, setGateBusy] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)
  const [gateResult, setGateResult] = useState<GateDecision | null>(null)

  async function runEvaluate() {
    setGateBusy(true)
    setGateError(null)
    try {
      const decision = await api.evaluate({
        tool_name: "email_send",
        arguments: { body: toolBody, to: "vendor@example.com" },
        destination: "external",
        agent_id: "finance",
      })
      setGateResult(decision)
    } catch (e) {
      setGateError(e instanceof Error ? e.message : "Gate API unreachable")
      setGateResult(null)
    } finally {
      setGateBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="ACTION GATE · HUMAN CONTROL"
        title="A clear pause before risky actions."
        description="Risk combines data sensitivity, destination trust, action type, and policy match. High-risk calls wait for you; critical calls stop the session."
        action={<StatusBadge tone={pending.length ? "warning" : "safe"}>{pending.length} waiting</StatusBadge>}
      />

      <Card className="panel-card">
        <PanelHeading title="Live tool-call check" description="Sends a sample email_send payload through the real Action Gate." action={<StatusBadge tone="safe">API</StatusBadge>} />
        <CardContent>
          <label className="form-field">
            <span>Tool argument body</span>
            <textarea value={toolBody} onChange={(e) => setToolBody(e.target.value)} rows={3} />
          </label>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <Button type="button" className="action-button action-button--primary" disabled={gateBusy} onClick={runEvaluate}>
              {gateBusy ? "Evaluating…" : "Evaluate call"}
            </Button>
          </div>
          {gateError ? <p className="form-error" role="alert" style={{ marginTop: 10 }}>{gateError}</p> : null}
          {gateResult ? (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              <div><StatusBadge tone={gateResult.risk.level === "critical" || gateResult.risk.level === "high" ? "danger" : "safe"}>{gateResult.action}</StatusBadge>
              <span className="table-secondary" style={{ marginLeft: 8 }}>{gateResult.risk.level} · score {gateResult.risk.score}</span></div>
              <p className="table-secondary">{gateResult.risk.explanation}</p>
              {gateResult.approval_prompt ? <p style={{ whiteSpace: "pre-wrap" }}>{gateResult.approval_prompt}</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="risk-ladder-grid">
        {[
          { level: "Low", action: "Allow automatically", description: "Trusted destination · no sensitive values", tone: "safe", icon: <Check aria-hidden="true" /> },
          { level: "Medium", action: "Allow + log", description: "Soft notification · value-free record", tone: "info", icon: <LockKeyhole aria-hidden="true" /> },
          { level: "High", action: "Pause for approval", description: "Explain the data and destination", tone: "warning", icon: <CircleAlert aria-hidden="true" /> },
          { level: "Critical", action: "Block + stop session", description: "Kill switch · no external call", tone: "danger", icon: <ShieldX aria-hidden="true" /> },
        ].map((item) => (
          <Card className={`panel-card risk-level risk-level--${item.tone}`} key={item.level}>
            <CardContent>
              <div className="risk-level__top"><span>{item.icon}</span><StatusBadge tone={item.tone as "safe" | "info" | "warning" | "danger"}>{item.level.toUpperCase()}</StatusBadge></div>
              <strong>{item.action}</strong>
              <p>{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="action-gate-grid">
        <Card className="panel-card approval-list-panel">
          <PanelHeading title="Needs your decision" description="Approval prompts include a reason, destination, and lineage — never the raw value." action={<StatusBadge tone={pending.length ? "warning" : "safe"}>{pending.length} pending</StatusBadge>} />
          <CardContent className="approval-list">
            {pending.length ? pending.map((approval) => (
              <article className="approval-request" key={approval.id}>
                <div className="approval-request__top">
                  <div><StatusBadge tone={riskTone(approval.risk)}>{approval.risk} risk</StatusBadge><span className="approval-request__id">{approval.id}</span></div>
                  <time>{approval.time}</time>
                </div>
                <h3>{approval.title}</h3>
                <p className="approval-request__reason">{approval.reason}</p>
                <div className="approval-request__facts">
                  <div><span>AGENT</span><strong>{approval.agent}</strong></div>
                  <div><span>DESTINATION</span><strong>{approval.tool}</strong></div>
                  <div><span>FINDING</span><strong>{approval.dataType}</strong></div>
                  <div><span>LINEAGE</span><strong><code>{approval.lineage}</code></strong></div>
                </div>
                <div className="approval-request__footer">
                  <span className="approval-request__privacy"><LockKeyhole aria-hidden="true" />Raw values are hidden</span>
                  <div className="approval-request__actions">
                    <Button type="button" variant="ghost" className="action-button action-button--danger-quiet" onClick={() => onResolve(approval.id, "denied")}>Deny</Button>
                    <Button type="button" variant="outline" className="action-button action-button--quiet" onClick={() => onResolve(approval.id, "redacted")}>Allow with redaction</Button>
                    <Button type="button" variant="default" className="action-button action-button--primary" onClick={() => onResolve(approval.id, "allowed")}>Allow once</Button>
                  </div>
                </div>
              </article>
            )) : (
              <div className="empty-state"><span className="empty-state__icon"><BadgeCheck aria-hidden="true" /></span><h3>No sample requests are waiting.</h3><p>New high-risk tool calls would appear here before they leave the agent boundary.</p></div>
            )}
          </CardContent>
        </Card>

        <aside className="action-gate-side">
          <Card className="panel-card gate-explainer">
            <PanelHeading title="Why this is held" description="A useful prompt answers three questions." />
            <CardContent className="gate-questions">
              <div><span>01</span><strong>What data?</strong><p>Only the type and field count are shown.</p></div>
              <div><span>02</span><strong>Where is it going?</strong><p>Trusted, local, or external destination.</p></div>
              <div><span>03</span><strong>What are my choices?</strong><p>Allow once, redact first, or deny.</p></div>
            </CardContent>
          </Card>
          <Card className="panel-card gate-safety-card">
            <CardContent>
              <div className="gate-safety-card__icon"><ShieldAlert aria-hidden="true" /></div>
              <StatusBadge tone="danger">CRITICAL · AUTO-BLOCK</StatusBadge>
              <h3>Some calls do not get an override prompt.</h3>
              <p>Critical calls are blocked and the agent session is stopped, as defined in the project brief.</p>
              <div className="gate-safety-card__foot"><span>Kill switch</span><strong>Available in design</strong></div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card className="panel-card resolved-panel">
        <PanelHeading title="Recent decisions" description="Choices made in this local prototype session." action={<StatusBadge tone="muted">LOCAL STATE</StatusBadge>} />
        <CardContent>
          {resolved.length ? (
            <div className="resolved-list">
              {resolved.map((approval) => (
                <div className="resolved-row" key={approval.id}>
                  <span className={`resolved-row__mark resolved-row__mark--${approvalTone(approval.status)}`}>
                    {approval.status === "allowed" || approval.status === "redacted" ? <Check aria-hidden="true" /> : <ShieldX aria-hidden="true" />}
                  </span>
                  <div><strong>{approval.title}</strong><small>{approval.id} · {approval.lineage}</small></div>
                  <StatusBadge tone={approvalTone(approval.status)}>{approvalLabel(approval.status)}</StatusBadge>
                </div>
              ))}
            </div>
          ) : <p className="muted-empty">No resolved requests yet.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

export function RedTeamPage({ runs, onRunSuite }: { runs: number; onRunSuite: () => void }) {
  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="LIVING RED TEAM · SELF-HEALING LOOP"
        title="Keep the patch honest."
        description="Held-out attacks and self-generated attacks stay in separate buckets so learning progress is never confused with benchmark performance."
        action={<Button type="button" variant="default" className="action-button action-button--primary" onClick={onRunSuite}><Play data-icon="inline-start" aria-hidden="true" />Simulate demo run</Button>}
      />

      <div className="demo-notice" role="note">
        <span className="demo-notice__icon"><TriangleAlert aria-hidden="true" /></span>
        <p><strong>Run hits the live red-team endpoint.</strong> Score cards below stay illustrative; the toast reports the real block rate.</p>
        <StatusBadge tone="info">{runs} RUNS</StatusBadge>
      </div>

      <div className="redteam-score-grid">
        <Card className="panel-card score-bucket score-bucket--heldout">
          <CardContent>
            <div className="score-bucket__top"><div><StatusBadge tone="info">HELD-OUT PUBLIC</StatusBadge><span className="score-bucket__lock"><LockKeyhole aria-hidden="true" />Never used for patching</span></div><span className="score-bucket__icon"><Globe aria-hidden="true" /></span></div>
            <div className="score-bucket__main"><strong>94.5<span>%</span></strong><div><span>412 / 436 blocked</span><small>sample benchmark set</small></div></div>
            <div className="score-meter"><span style={{ width: "94.5%" }} /></div>
            <p>Public attacks remain independent from the patch-learning loop.</p>
          </CardContent>
        </Card>
        <Card className="panel-card score-bucket score-bucket--generated">
          <CardContent>
            <div className="score-bucket__top"><div><StatusBadge tone="accent">SELF-GENERATED</StatusBadge><span className="score-bucket__lock"><GitBranch aria-hidden="true" />Feeds patch learning</span></div><span className="score-bucket__icon"><RefreshCw aria-hidden="true" /></span></div>
            <div className="score-bucket__main"><strong>99.1<span>%</span></strong><div><span>1,241 / 1,252 blocked</span><small>sample generated set</small></div></div>
            <div className="score-meter score-meter--teal"><span style={{ width: "99.1%" }} /></div>
            <p>Higher self-generated coverage is expected and reported separately.</p>
          </CardContent>
        </Card>
      </div>

      <div className="redteam-main-grid">
        <Card className="panel-card attack-coverage-panel">
          <PanelHeading title="Attack families" description="Representative test buckets from the project brief." action={<StatusBadge tone="muted">SAMPLE SET</StatusBadge>} />
          <CardContent className="attack-family-list">
            {[
              { name: "Direct prompt injection", detail: "Instructions embedded in user content", status: "Blocked", tone: "safe" },
              { name: "Indirect injection", detail: "Poisoned HTML, PDFs, or tool output", status: "Blocked", tone: "safe" },
              { name: "Exfiltration", detail: "Markdown image and URL-based leaks", status: "Blocked", tone: "safe" },
              { name: "Policy bypass", detail: "Conflicting or shadowed instructions", status: "Review", tone: "warning" },
              { name: "Multi-agent collusion", detail: "Cross-agent data handoff attempts", status: "Blocked", tone: "safe" },
            ].map((attack) => (
              <div className="attack-family-row" key={attack.name}><span className="attack-family-row__icon"><ShieldAlert aria-hidden="true" /></span><div><strong>{attack.name}</strong><small>{attack.detail}</small></div><StatusBadge tone={attack.tone as "safe" | "warning"}>{attack.status}</StatusBadge></div>
            ))}
          </CardContent>
        </Card>
        <Card className="panel-card regression-panel">
          <PanelHeading title="Regression gate" description="A patch is only eligible after all three checks pass." action={<StatusBadge tone="safe">3 / 3 PASS</StatusBadge>} />
          <CardContent className="regression-checks">
            <div className="regression-check"><span className="regression-check__icon"><Check aria-hidden="true" /></span><div><strong>Previous attacks remain blocked</strong><small>Held-out baseline · sample pass</small></div><span className="regression-check__result">PASS</span></div>
            <div className="regression-check"><span className="regression-check__icon"><Check aria-hidden="true" /></span><div><strong>False positives stay below threshold</strong><small>1.2% sample rate · 2.0% threshold</small></div><span className="regression-check__result">PASS</span></div>
            <div className="regression-check"><span className="regression-check__icon"><Check aria-hidden="true" /></span><div><strong>Latency stays within budget</strong><small>118 ms sample · 180 ms budget</small></div><span className="regression-check__result">PASS</span></div>
            <div className="regression-panel__foot"><Timer aria-hidden="true" /><span>Thresholds shown for UI demonstration only.</span></div>
          </CardContent>
        </Card>
      </div>

      <Card className="panel-card patch-history-panel">
        <PanelHeading title="Patch history" description="Defender suggestions, regression results, and versioned merges." action={<StatusBadge tone="info">{runs} demo runs</StatusBadge>} />
        <CardContent className="patch-history">
          <div className="patch-history__item"><span className="patch-history__mark patch-history__mark--current"><Check aria-hidden="true" /></span><div className="patch-history__copy"><div><strong>Indirect HTML instruction boundary tightened</strong><StatusBadge tone="safe">MERGED · SAMPLE</StatusBadge></div><p>Defender proposal · regression suite passed · no raw trace values retained.</p><small><code>PATCH-018</code> · <code>sha 4fe9a31</code> · 18 minutes ago</small></div><Button type="button" variant="ghost" size="icon" className="table-action" aria-label="View patch PATCH-018" onClick={onRunSuite}><ArrowUpRight aria-hidden="true" /></Button></div>
          <div className="patch-history__item"><span className="patch-history__mark"><GitBranch aria-hidden="true" /></span><div className="patch-history__copy"><div><strong>Markdown image exfiltration pattern added</strong><StatusBadge tone="muted">ROLLED BACK · SAMPLE</StatusBadge></div><p>False-positive threshold exceeded on the legitimate-task suite.</p><small><code>PATCH-017</code> · <code>sha 9c118d0</code> · yesterday</small></div><Button type="button" variant="ghost" size="icon" className="table-action" aria-label="Review patch PATCH-017" onClick={onRunSuite}><ArrowUpRight aria-hidden="true" /></Button></div>
        </CardContent>
      </Card>
    </div>
  )
}

export function AuditLogPage({
  events,
  query,
  chainVerified,
  onVerify,
  onNotify,
}: {
  events: FirewallEvent[]
  query: string
  chainVerified: boolean
  onVerify: () => void
  onNotify: (message: string) => void
}) {
  const [liveRows, setLiveRows] = useState<AuditRow[] | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [loadingLive, setLoadingLive] = useState(false)

  async function loadLive() {
    setLoadingLive(true)
    setLiveError(null)
    try {
      const rows = await api.auditEvents(50)
      setLiveRows(rows)
      onNotify(`Loaded ${rows.length} live audit rows from SQLite.`)
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : "Audit API unreachable")
      setLiveRows(null)
    } finally {
      setLoadingLive(false)
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleEvents = useMemo(
    () => events.filter((event) =>
      [event.id, event.time, event.actor, event.tool, event.summary, event.finding, event.decision, event.risk, event.lineage, event.hash]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    ),
    [events, normalizedQuery]
  )

  function exportSampleCsv() {
    const columns = ["time", "event_id", "actor", "tool", "summary", "finding_type", "decision", "risk", "lineage_id", "previous_hash", "hash"]
    const rows = visibleEvents.map((event) => [event.time, event.id, event.actor, event.tool, event.summary, event.finding, event.decision, event.risk, event.lineage, event.previousHash, event.hash])
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
    const csv = [columns, ...rows].map((row) => row.map((value) => escape(String(value))).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "shihezu-sample-audit-log.csv"
    link.click()
    URL.revokeObjectURL(url)
    onNotify("Sample audit CSV exported. It contains event metadata and lineage IDs only.")
  }

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="AUDIT LOG · APPEND-ONLY BY DESIGN"
        title="A trail you can verify."
        description="Each sample row carries a previous hash and a current hash. The preview contains tokens and lineage IDs — never raw sensitive values."
        action={<div className="audit-actions"><Button type="button" variant="outline" className="action-button action-button--quiet" onClick={loadLive}>{loadingLive ? "Loading…" : "Load live"}</Button><Button type="button" variant="outline" className="action-button action-button--quiet" onClick={exportSampleCsv}><ArrowDownToLine data-icon="inline-start" aria-hidden="true" />Export CSV</Button><Button type="button" variant="default" className="action-button action-button--primary" onClick={onVerify}><ShieldCheck data-icon="inline-start" aria-hidden="true" />Verify chain</Button></div>}
      />

      <div className="audit-integrity-banner">
        <span className={chainVerified ? "audit-integrity-banner__icon audit-integrity-banner__icon--verified" : "audit-integrity-banner__icon"}>{chainVerified ? <CircleCheck aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}</span>
        <div><strong>{chainVerified ? "Sample chain verified in this session" : "Hash-chain verification is available"}</strong><p>{chainVerified ? "The button ran a local UI confirmation; no SQLite database was queried." : "A production verifier would recompute SHA-256 links from the append-only store."}</p></div>
        <StatusBadge tone={chainVerified ? "safe" : "info"}>{chainVerified ? "DEMO PASS" : "SAMPLE CHAIN"}</StatusBadge>
      </div>

      <div className="metrics-grid metrics-grid--three">
        <MetricCard label="Sample events" value={events.length.toLocaleString()} trend="Value-free" helper="metadata + lineage only" icon={<GitBranch />} tone="info" />
        <MetricCard label="Sensitive values logged" value="0" trend="Protected" helper="raw values do not appear in the preview" icon={<LockKeyhole />} tone="safe" />
        <MetricCard label="Hash links" value={events.length.toLocaleString()} trend={chainVerified ? "Demo pass" : "Ready to verify"} helper="previous hash → current hash" icon={<ShieldCheck />} tone={chainVerified ? "safe" : "warning"} />
      </div>

      {liveError ? <p className="form-error" role="alert">{liveError}</p> : null}
      {liveRows && liveRows.length > 0 ? (
        <Card className="panel-card audit-table-card">
          <PanelHeading title="Live audit (SQLite)" description="From the running firewall API." action={<StatusBadge tone="safe">{liveRows.length} rows</StatusBadge>} />
          <CardContent className="table-scroll">
            <table className="data-table audit-table">
              <thead><tr><th>TIME</th><th>TYPE</th><th>AGENT / TOOL</th><th>DECISION</th><th>HASH</th></tr></thead>
              <tbody>
                {liveRows.map((row, i) => (
                  <tr key={row.event_id || String(i)}>
                    <td><code>{row.timestamp || "—"}</code></td>
                    <td>{row.event_type || "—"}</td>
                    <td><div className="audit-table__actor"><strong>{row.agent_id || "—"}</strong><small>{row.tool_name || "—"}</small></div></td>
                    <td><StatusBadge tone="neutral">{row.decision || row.risk_level || "—"}</StatusBadge></td>
                    <td><code className="lineage-code">{(row.hash || "").slice(0, 12)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <Card className="panel-card audit-table-card">
        <PanelHeading title="Sample event stream" description="Illustrative rows for layout. Use Load live for real data." action={<StatusBadge tone="muted">{visibleEvents.length} visible</StatusBadge>} />
        <CardContent className="table-scroll">
          {visibleEvents.length ? (
            <table className="data-table audit-table">
              <thead><tr><th>TIME / EVENT</th><th>AGENT / TOOL</th><th>DECISION</th><th>LINEAGE</th><th>PREV → HASH</th></tr></thead>
              <tbody>
                {visibleEvents.map((event) => (
                  <tr key={event.id}>
                    <td><div className="audit-table__event"><strong>{event.summary}</strong><span><time>{event.time}</time><code>{event.id}</code></span></div></td>
                    <td><div className="audit-table__actor"><strong>{event.actor}</strong><small>{event.tool}</small></div></td>
                    <td><div className="audit-table__decision"><StatusBadge tone={event.decision === "Blocked" ? "danger" : event.decision === "Approval needed" ? "warning" : event.decision === "Allowed" ? "safe" : "neutral"}>{event.decision}</StatusBadge><small>{event.risk} risk</small></div></td>
                    <td><code className="lineage-code">{event.lineage}</code></td>
                    <td><div className="hash-pair"><code>{event.previousHash}</code><ArrowRight aria-hidden="true" /><code>{event.hash}</code></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty-search"><CircleHelp aria-hidden="true" /><p>No audit entries match “{query}”.</p></div>}
        </CardContent>
      </Card>
      <div className="audit-footnote"><LockKeyhole aria-hidden="true" /><span>Verify chain calls the live SQLite hash verifier. The table still shows sample rows until you point it at /audit/events.</span></div>
    </div>
  )
}

export function AgentsPage({
  agents,
  activeStates,
  onToggleAgent,
  onToggleAll,
  onNotify,
}: {
  agents: DemoAgent[]
  activeStates: Record<string, boolean>
  onToggleAgent: (id: string) => void
  onToggleAll: () => void
  onNotify: (message: string) => void
}) {
  const activeCount = agents.filter((agent) => activeStates[agent.id]).length
  const allPaused = activeCount === 0

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="AGENT RUNTIME · ISOLATION & LEAST PRIVILEGE"
        title="Every agent gets its own boundary."
        description="Separate context, separate memory namespace, explicit tool allowlists, and no direct agent-to-agent handoff."
        action={<Button type="button" variant={allPaused ? "default" : "destructive"} className={allPaused ? "action-button action-button--primary" : "action-button action-button--stop"} onClick={onToggleAll}>{allPaused ? <Play data-icon="inline-start" aria-hidden="true" /> : <Pause data-icon="inline-start" aria-hidden="true" />}{allPaused ? "Resume all" : "Panic stop all"}</Button>}
      />

      <div className="runtime-banner">
        <span className="runtime-banner__icon"><Network aria-hidden="true" /></span>
        <div><strong>{activeCount} of {agents.length} sample agents enabled</strong><p>Inter-agent data exchange is routed through the firewall in this architecture preview.</p></div>
        <StatusBadge tone={activeCount ? "safe" : "warning"}>{activeCount ? "ISOLATION ON" : "ALL PAUSED"}</StatusBadge>
      </div>

      <div className="agent-grid">
        {agents.map((agent) => {
          const active = Boolean(activeStates[agent.id])
          return (
            <Card className={`panel-card agent-card ${active ? "agent-card--active" : "agent-card--paused"}`} key={agent.id}>
              <div className="agent-card__topline" />
              <div className="agent-card__header">
                <span className="agent-card__avatar"><UserRound aria-hidden="true" /></span>
                <div className="agent-card__identity"><h3>{agent.name}</h3><p>{agent.purpose}</p></div>
                <button type="button" role="switch" aria-checked={active} aria-label={`${active ? "Pause" : "Enable"} ${agent.name}`} className={active ? "agent-switch agent-switch--on" : "agent-switch"} onClick={() => onToggleAgent(agent.id)}><span /></button>
              </div>
              <CardContent>
                <div className="agent-model-row"><span className="agent-model-row__icon"><WandSparkles aria-hidden="true" /></span><div><small>MODEL ROUTE · SAMPLE</small><strong>{agent.model}</strong></div><StatusBadge tone="info">DEMO</StatusBadge></div>
                <div className="agent-namespace"><span>MEMORY NAMESPACE</span><code>{agent.namespace}</code><StatusBadge tone="safe">ISOLATED</StatusBadge></div>
                <div className="agent-tools-heading"><strong>Tool allowlist</strong><span>{agent.tools.length} scoped tools</span></div>
                <div className="agent-tool-list">{agent.tools.map((tool) => <div className="agent-tool" key={tool.name}><span className="agent-tool__icon"><LockKeyhole aria-hidden="true" /></span><strong>{tool.name}</strong><StatusBadge tone={tool.access === "Not allowed" ? "danger" : tool.access === "Approval gate" ? "warning" : "safe"}>{tool.access}</StatusBadge></div>)}</div>
                <Button type="button" variant="outline" className="action-button action-button--quiet agent-details-button" onClick={() => onNotify(`${agent.name} details are sample UI only.`)}>View agent details <ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Button>
              </CardContent>
            </Card>
          )
        })}
        <button type="button" className="agent-create-card" onClick={() => onNotify("Agent creation is not connected in this frontend prototype.")}>
          <span className="agent-create-card__plus">+</span><strong>Add an agent</strong><span>Define a new namespace and tool allowlist.</span>
        </button>
      </div>

      <div className="isolation-grid">
        <Card className="panel-card isolation-card"><CardContent><span className="isolation-card__icon"><Layers aria-hidden="true" /></span><div><strong>Context isolation</strong><p>Each agent has an independent context and memory namespace.</p></div><StatusBadge tone="safe">DESIGNED</StatusBadge></CardContent></Card>
        <Card className="panel-card isolation-card"><CardContent><span className="isolation-card__icon"><ShieldCheck aria-hidden="true" /></span><div><strong>Tool allowlist</strong><p>Least privilege is explicit; write tools can be gated.</p></div><StatusBadge tone="safe">DESIGNED</StatusBadge></CardContent></Card>
        <Card className="panel-card isolation-card"><CardContent><span className="isolation-card__icon"><Globe aria-hidden="true" /></span><div><strong>OpenShell sandbox</strong><p>Runtime setup is an integration point, not connected here.</p></div><StatusBadge tone="warning">PLANNED</StatusBadge></CardContent></Card>
      </div>
      <div className="audit-footnote"><CircleHelp aria-hidden="true" /><span>All agent statuses are local browser state and reset when the page reloads.</span></div>
    </div>
  )
}

function ScanLineFallback() {
  return <span aria-hidden="true" className="scan-fallback"><Fingerprint /></span>
}
