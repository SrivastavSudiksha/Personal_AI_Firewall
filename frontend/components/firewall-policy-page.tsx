"use client"

import { useMemo, useState, type FormEvent } from "react"
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  GitBranch,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MetricCard, PanelHeading, SectionHeading, StatusBadge } from "@/components/firewall-shared"
import type { FirewallPolicy } from "@/lib/firewall-demo-data"
import { api } from "@/lib/api"

type DraftPolicy = Pick<FirewallPolicy, "name" | "rule" | "scope">

export function PolicyEnginePage({
  policies,
  query,
  composerOpen,
  onToggleComposer,
  onCreatePolicy,
  onNotify,
}: {
  policies: FirewallPolicy[]
  query: string
  composerOpen: boolean
  onToggleComposer: () => void
  onCreatePolicy: (policy: DraftPolicy) => void
  onNotify: (message: string) => void
}) {
  const [name, setName] = useState("")
  const [rule, setRule] = useState("")
  const [scope, setScope] = useState("External tools")
  const [error, setError] = useState("")
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visiblePolicies = useMemo(
    () => policies.filter((policy) =>
      [policy.id, policy.name, policy.rule, policy.scope, policy.status]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    ),
    [policies, normalizedQuery]
  )

  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !rule.trim()) {
      setError("Add a policy name and a plain-language rule to save this draft.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const compiled = await api.compilePolicy(rule.trim())
      const ruleDto = {
        ...compiled.rule,
        name: name.trim() || compiled.rule.name,
        natural_language: rule.trim(),
        description: compiled.rule.description || name.trim(),
      }
      const saved = await api.savePolicy(ruleDto as never)
      onCreatePolicy({ name: name.trim(), rule: rule.trim(), scope })
      onNotify(`Policy saved on server (${saved.name} · ${saved.hash}).`)
      setName("")
      setRule("")
      setScope("External tools")
    } catch (e) {
      // still keep local draft so UI stays usable offline
      onCreatePolicy({ name: name.trim(), rule: rule.trim(), scope })
      onNotify(
        e instanceof Error
          ? `Local draft saved. Server: ${e.message}`
          : "Local draft saved. Server unreachable."
      )
      setName("")
      setRule("")
      setScope("External tools")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="POLICY ENGINE · NATURAL LANGUAGE → SAFE RULES"
        title="Write the rule. Keep the control."
        description="Turn plain-language intent into versioned, reviewable policy drafts. Compilation and validation are represented with sample states only."
        action={
          <Button
            type="button"
            variant="default"
            className="action-button action-button--primary"
            onClick={onToggleComposer}
          >
            {composerOpen ? <X data-icon="inline-start" aria-hidden="true" /> : <Plus data-icon="inline-start" aria-hidden="true" />}
            {composerOpen ? "Close composer" : "New policy"}
          </Button>
        }
      />

      <div className="demo-notice" role="note">
        <span className="demo-notice__icon"><CircleHelp aria-hidden="true" /></span>
        <p><strong>Drafts stay in the browser for now.</strong> The backend already loads YAML policies and can compile natural-language rules when a key is set.</p>
        <StatusBadge tone="info">LOCAL DRAFTS</StatusBadge>
      </div>

      <div className="metrics-grid metrics-grid--three">
        <MetricCard label="Active policies" value={policies.filter((policy) => policy.status === "Active").length} trend="Enforced in sample" helper="versioned policy records" icon={<GitBranch />} tone="safe" />
        <MetricCard label="Drafts" value={policies.filter((policy) => policy.status === "Draft").length} trend="Review first" helper="not applied to tool calls" icon={<Sparkles />} tone="info" />
        <MetricCard label="Needs review" value={policies.filter((policy) => policy.status === "Needs review").length} trend="1 overlap" helper="potential conflict or shadowing" icon={<AlertTriangle />} tone="warning" />
      </div>

      {composerOpen ? (
        <Card className="panel-card composer-card">
          <PanelHeading
            title="Draft a plain-language rule"
            description="Keep the policy human-readable; the production compiler would validate structured output before enforcement."
            action={<StatusBadge tone="accent">DRAFT MODE</StatusBadge>}
          />
          <CardContent>
            <form className="policy-form" onSubmit={handleSubmit}>
              <div className="policy-form__fields">
                <label className="form-field">
                  <span>Policy name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Keep tax documents private" />
                </label>
                <label className="form-field">
                  <span>Scope</span>
                  <span className="select-control">
                    <select value={scope} onChange={(event) => setScope(event.target.value)}>
                      <option>External tools</option>
                      <option>All agents</option>
                      <option>Cloud models</option>
                      <option>Specific data type</option>
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>
              </div>
              <label className="form-field">
                <span>Rule in your own words</span>
                <textarea
                  value={rule}
                  onChange={(event) => setRule(event.target.value)}
                  rows={3}
                  placeholder="Never send account numbers or balances from my bank statements to an external tool."
                />
                <small>Tip: say what data is protected, where it can go, and when you want to be asked.</small>
              </label>
              <div className="policy-form__footer">
                <div className="policy-form__notice"><Sparkles aria-hidden="true" /><span>Structured preview will appear after a real compiler is connected.</span></div>
                <div className="policy-form__actions">
                  <Button type="button" variant="ghost" className="action-button action-button--quiet" onClick={onToggleComposer}>Cancel</Button>
                  <Button type="submit" variant="default" className="action-button action-button--primary" disabled={saving}><Check data-icon="inline-start" aria-hidden="true" />{saving ? "Saving…" : "Save policy"}</Button>
                </div>
              </div>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="panel-card policy-table-card">
        <PanelHeading
          title="Policy library"
          description="Each rule has a stable ID, version hash, and explicit scope."
          action={<StatusBadge tone="neutral">{policies.length} rules</StatusBadge>}
        />
        <CardContent className="table-scroll">
          {visiblePolicies.length > 0 ? (
            <table className="data-table policy-table">
              <thead>
                <tr><th>POLICY</th><th>SCOPE</th><th>STATUS</th><th>VERSION</th><th>LAST UPDATED</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {visiblePolicies.map((policy) => (
                  <tr key={policy.id}>
                    <td>
                      <div className="policy-table__name"><span className="policy-table__glyph"><GitBranch aria-hidden="true" /></span><div><strong>{policy.name}</strong><span>{policy.id} · {policy.rule}</span></div></div>
                    </td>
                    <td><span className="table-secondary">{policy.scope}</span></td>
                    <td><StatusBadge tone={policy.status === "Active" ? "safe" : policy.status === "Draft" ? "info" : "warning"}>{policy.status}</StatusBadge>{policy.conflict ? <span className="conflict-dot" title="Potential overlap detected" /> : null}</td>
                    <td><span className="version-pill">{policy.version}</span><small className="hash-small">{policy.hash}</small></td>
                    <td><span className="table-secondary">{policy.updated}</span></td>
                    <td><Button type="button" variant="ghost" size="icon" className="table-action" aria-label={`Rollback ${policy.name}`} title="Rollback to this version" onClick={() => onNotify(`Demo rollback preview opened for ${policy.id}.`)}><RotateCcw aria-hidden="true" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-search"><SearchIconFallback /><p>No policies match “{query}”.</p></div>
          )}
        </CardContent>
      </Card>

      <div className="policy-bottom-grid">
        <Card className="panel-card conflict-panel">
          <PanelHeading title="Conflict & shadowing review" description="Simple checks catch overlapping allow and deny conditions." action={<StatusBadge tone="warning">1 flagged</StatusBadge>} />
          <CardContent className="conflict-panel__body">
            <div className="conflict-panel__icon"><AlertTriangle aria-hidden="true" /></div>
            <div className="conflict-panel__copy"><strong>Two rules may overlap on cloud summaries.</strong><p>POL-011 masks personal identifiers before cloud routing; a newer draft should not broaden that destination.</p><span><code>POL-011</code><ArrowDownLeft aria-hidden="true" /><code>POL-014</code></span></div>
            <Button type="button" variant="outline" className="action-button action-button--quiet" onClick={() => onNotify("Conflict details are sample data in this frontend prototype.")}>Review conflict <ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Button>
          </CardContent>
        </Card>
        <Card className="panel-card policy-version-panel">
          <PanelHeading title="Version history" description="Git-style hashes · sample history" action={<StatusBadge tone="info">CHAINED</StatusBadge>} />
          <CardContent className="version-history">
            <div className="version-history__item"><span className="version-history__marker version-history__marker--current" /><div><strong>Banking details stay private <code>9f2a7c1</code></strong><small>POL-014 · active · 2 hours ago</small></div><StatusBadge tone="safe">Current</StatusBadge></div>
            <div className="version-history__item"><span className="version-history__marker" /><div><strong>Location share confirmation <code>e82d531</code></strong><small>POL-012 · active · Oct 26</small></div><Button type="button" variant="ghost" className="text-action" onClick={() => onNotify("Rollback preview opened; no policy was changed.")}>Rollback</Button></div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SearchIconFallback() {
  return <span className="empty-search__mark" aria-hidden="true">⌕</span>
}
