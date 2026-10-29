"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { FirewallOverview } from "@/components/firewall-overview"
import { FirewallSidebar } from "@/components/firewall-sidebar"
import { FirewallTopbar } from "@/components/firewall-topbar"
import { PolicyEnginePage } from "@/components/firewall-policy-page"
import {
  ActionGatePage,
  AgentsPage,
  AuditLogPage,
  DataGuardianPage,
  RedTeamPage,
} from "@/components/firewall-security-pages"
import { Button } from "@/components/ui/button"
import type {
  ApprovalDecision,
  ApprovalRequest,
  DashboardSection,
  FirewallPolicy,
} from "@/lib/firewall-demo-data"
import { api } from "@/lib/api"
import {
  demoAgents,
  initialApprovals,
  initialAuditEvents,
  initialPolicies,
} from "@/lib/firewall-demo-data"

type PolicyDraft = Pick<FirewallPolicy, "name" | "rule" | "scope">

export function FirewallDashboard({
  sessionUser,
  onLogout,
}: {
  sessionUser?: { username: string; role: string }
  onLogout?: () => void
} = {}) {
  const [activeSection, setActiveSection] = useState<DashboardSection>("Overview")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(initialApprovals)
  const [policies, setPolicies] = useState<FirewallPolicy[]>(initialPolicies)
  const [policyComposerOpen, setPolicyComposerOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [lastDemoCheck, setLastDemoCheck] = useState("Last sample check · 2 min ago")
  const [redTeamRuns, setRedTeamRuns] = useState(4)
  const [chainVerified, setChainVerified] = useState(false)
  const [agentsActive, setAgentsActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(demoAgents.map((agent) => [agent.id, true]))
  )

  const pendingCount = approvals.filter((approval) => approval.status === "pending").length

  function notify(message: string) {
    setNotice(message)
  }

  function navigate(section: DashboardSection) {
    setActiveSection(section)
    setMobileNavOpen(false)
  }

  function openPolicyComposer() {
    setActiveSection("Policy Engine")
    setPolicyComposerOpen(true)
    setMobileNavOpen(false)
  }

  function resolveApproval(id: string, decision: ApprovalDecision) {
    const request = approvals.find((approval) => approval.id === id)
    setApprovals((current) => current.map((approval) =>
      approval.id === id ? { ...approval, status: decision } : approval
    ))
    if (request) {
      const result = decision === "allowed" ? "allowed once" : decision === "redacted" ? "allowed with redaction" : "denied"
      notify(`${request.id} ${result}. This choice is stored in local UI state only.`)
    }
  }

  function createPolicy(draft: PolicyDraft) {
    const newPolicy: FirewallPolicy = {
      ...draft,
      id: `POL-${String(Date.now()).slice(-4)}`,
      status: "Draft",
      version: "draft",
      hash: "pending",
      updated: "Just now",
    }
    setPolicies((current) => [newPolicy, ...current])
    setPolicyComposerOpen(false)
    notify("Policy saved as a local draft. No compiler or validator was called.")
  }

  function runDemoCheck() {
    setLastDemoCheck("Last sample check · just now")
    notify("Demo check complete. Sample policy and data-guardrail states were refreshed locally.")
  }

  async function runRedTeamDemo() {
    try {
      const res = await api.redteam(3)
      setRedTeamRuns((current) => current + 1)
      notify(`Red-team finished: block rate ${(res.block_rate * 100).toFixed(0)}% on ${res.n_attacks} attacks.`)
    } catch (e) {
      notify(e instanceof Error ? e.message : "Red-team API unreachable. Start backend on :8000.")
    }
  }

  async function verifyDemoChain() {
    try {
      const res = await api.auditVerify()
      setChainVerified(res.chain_valid)
      notify(res.chain_valid ? "Audit hash chain verified against SQLite." : "Chain verification failed.")
    } catch (e) {
      notify(e instanceof Error ? e.message : "Audit API unreachable. Start backend on :8000.")
    }
  }

  function toggleAgent(id: string) {
    const agent = demoAgents.find((item) => item.id === id)
    setAgentsActive((current) => ({ ...current, [id]: !current[id] }))
    notify(`${agent?.name ?? "Agent"} status changed in local UI state.`)
  }

  function toggleAllAgents() {
    const anyActive = Object.values(agentsActive).some(Boolean)
    const nextValue = !anyActive
    setAgentsActive(Object.fromEntries(demoAgents.map((agent) => [agent.id, nextValue])))
    notify(nextValue ? "All sample agents resumed in the UI." : "Emergency pause applied to all sample agents in the UI.")
  }

  const activePage = (() => {
    switch (activeSection) {
      case "Policy Engine":
        return (
          <PolicyEnginePage
            policies={policies}
            query={query}
            composerOpen={policyComposerOpen}
            onToggleComposer={() => setPolicyComposerOpen((open) => !open)}
            onCreatePolicy={createPolicy}
            onNotify={notify}
          />
        )
      case "Data Guardian":
        return <DataGuardianPage />
      case "Action Gate":
        return <ActionGatePage approvals={approvals} onResolve={resolveApproval} />
      case "Living Red Team":
        return <RedTeamPage runs={redTeamRuns} onRunSuite={runRedTeamDemo} />
      case "Audit Log":
        return <AuditLogPage events={initialAuditEvents} query={query} chainVerified={chainVerified} onVerify={verifyDemoChain} onNotify={notify} />
      case "Agents & Sandbox":
        return <AgentsPage agents={demoAgents} activeStates={agentsActive} onToggleAgent={toggleAgent} onToggleAll={toggleAllAgents} onNotify={notify} />
      case "Overview":
      default:
        return <FirewallOverview approvals={approvals} events={initialAuditEvents} query={query} onNavigate={navigate} onRunDemoCheck={runDemoCheck} lastDemoCheck={lastDemoCheck} />
    }
  })()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {mobileNavOpen ? <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} /> : null}
      <FirewallSidebar
        activeSection={activeSection}
        pendingCount={pendingCount}
        isOpen={mobileNavOpen}
        onNavigate={navigate}
        onClose={() => setMobileNavOpen(false)}
        sessionUser={sessionUser}
        onLogout={onLogout}
      />

      <div className="app-main">
        <FirewallTopbar
          activeSection={activeSection}
          pendingCount={pendingCount}
          query={query}
          onQueryChange={setQuery}
          onNavigate={navigate}
          onNewPolicy={openPolicyComposer}
          onOpenMenu={() => setMobileNavOpen(true)}
        />
        <main className="main-content" id="main-content" tabIndex={-1}>
          {activePage}
        </main>
        <footer className="app-footer">
          <span><span className="footer-status-dot" />Shihezu console · local firewall</span>
          <span>Backend: FastAPI :8000 · UI can call live protect / gate / audit</span>
        </footer>
      </div>

      {notice ? (
        <div className="toast-notice" role="status" aria-live="polite">
          <span className="toast-notice__icon"><Check aria-hidden="true" /></span>
          <p>{notice}</p>
          <Button type="button" variant="ghost" size="icon-sm" className="toast-notice__close" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X aria-hidden="true" /></Button>
        </div>
      ) : null}
    </div>
  )
}
