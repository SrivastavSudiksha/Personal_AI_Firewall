"use client"

import { useMemo, useState } from "react"
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CircleAlert,
  Clock3,
  Fingerprint,
  LockKeyhole,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { MetricCard, PanelHeading, StatusBadge } from "@/components/firewall-shared"
import { activityByRange } from "@/lib/firewall-demo-data"
import type {
  ApprovalRequest,
  DashboardSection,
  FirewallEvent,
} from "@/lib/firewall-demo-data"

const chartConfig = {
  inspected: { label: "Calls inspected", color: "var(--chart-1)" },
  blocked: { label: "Blocked", color: "var(--chart-2)" },
  approvals: { label: "Approval queue", color: "var(--chart-3)" },
} satisfies ChartConfig

function decisionTone(decision: FirewallEvent["decision"]) {
  if (decision === "Blocked") return "danger" as const
  if (decision === "Approval needed") return "warning" as const
  if (decision === "Allowed") return "safe" as const
  return "neutral" as const
}

export function FirewallOverview({
  approvals,
  events,
  query,
  onNavigate,
  onRunDemoCheck,
  lastDemoCheck,
}: {
  approvals: ApprovalRequest[]
  events: FirewallEvent[]
  query: string
  onNavigate: (section: DashboardSection) => void
  onRunDemoCheck: () => void
  lastDemoCheck: string
}) {
  const [range, setRange] = useState<"24 hours" | "7 days">("7 days")
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending")
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleEvents = useMemo(
    () =>
      events
        .filter((event) =>
          [event.id, event.actor, event.tool, event.summary, event.finding, event.lineage]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery)
        )
        .slice(0, 4),
    [events, normalizedQuery]
  )

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PROTECTION OVERVIEW · THURSDAY, OCTOBER 29</p>
          <h1>Your AI, safely connected.</h1>
          <p className="page-heading__description">
            One clear view of sensitive data, policy decisions, and every tool call.
          </p>
        </div>
        <div className="page-heading__actions">
          <span className="last-checked"><span className="live-dot" />{lastDemoCheck}</span>
          <Button
            type="button"
            variant="default"
            className="action-button action-button--primary"
            onClick={onRunDemoCheck}
          >
            <ScanLine data-icon="inline-start" aria-hidden="true" />
            Run demo check
          </Button>
        </div>
      </div>

      <div className="demo-notice" role="note">
        <span className="demo-notice__icon"><Activity aria-hidden="true" /></span>
        <p><strong>Overview metrics are illustrative.</strong> Data Guardian, Red Team, and Audit can hit the live API on port 8000.</p>
        <StatusBadge tone="info">MIXED · LIVE + SAMPLE</StatusBadge>
      </div>

      <div className="metrics-grid">
        <MetricCard
          label="Calls inspected"
          value="12,842"
          trend="+11.8%"
          helper="sample tool calls · last 24 hours"
          icon={<Activity />}
          tone="safe"
        />
        <MetricCard
          label="Sensitive findings"
          value="46"
          trend="3 types"
          helper="masked or tokenized in the demo"
          icon={<Fingerprint />}
          tone="info"
        />
        <MetricCard
          label="High-risk actions"
          value="19"
          trend="7 blocked"
          helper="held before reaching a tool"
          icon={<ShieldAlert />}
          tone="warning"
        />
        <MetricCard
          label="Needs your approval"
          value={pendingApprovals.length}
          trend={pendingApprovals.length === 0 ? "All clear" : "Review"}
          helper="requests waiting in the sample queue"
          icon={<Clock3 />}
          tone={pendingApprovals.length > 0 ? "warning" : "safe"}
        />
      </div>

      <div className="overview-grid">
        <div className="overview-main-column">
          <Card className="panel-card activity-panel">
            <PanelHeading
              title="Tool-call activity"
              description="Inspection and intervention volume across your agents."
              action={
                <label className="range-select-wrap">
                  <span className="sr-only">Activity chart range</span>
                  <select value={range} onChange={(event) => setRange(event.target.value as "24 hours" | "7 days")}>
                    <option>7 days</option>
                    <option>24 hours</option>
                  </select>
                  <ArrowRight aria-hidden="true" />
                </label>
              }
            />
            <CardContent className="activity-panel__content">
              <div className="chart-legend" aria-label="Chart legend">
                <span><i className="chart-legend__dot chart-legend__dot--inspected" />Calls inspected</span>
                <span><i className="chart-legend__dot chart-legend__dot--blocked" />Blocked</span>
                <span><i className="chart-legend__dot chart-legend__dot--approval" />Approval queue</span>
              </div>
              <ChartContainer
                config={chartConfig}
                className="activity-chart min-h-[250px] w-full"
                aria-label={`Tool-call activity over the last ${range}`}
              >
                <AreaChart data={activityByRange[range]} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inspected-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-inspected)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--color-inspected)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "#84928d", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={8}
                    width={40}
                    tickFormatter={(value: number) => value >= 1000 ? `${value / 1000}k` : String(value)}
                    tick={{ fill: "#84928d", fontSize: 11 }}
                  />
                  <ChartTooltip cursor={{ stroke: "#cdd9d4", strokeDasharray: "4 4" }} content={<ChartTooltipContent indicator="line" />} />
                  <Area
                    dataKey="inspected"
                    type="monotone"
                    stroke="var(--color-inspected)"
                    fill="url(#inspected-fill)"
  strokeWidth={2.6}
  isAnimationActive={false}
  activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Line
                    dataKey="blocked"
                    type="monotone"
                    stroke="var(--color-blocked)"
  strokeWidth={2}
  isAnimationActive={false}
  dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Line
                    dataKey="approvals"
                    type="monotone"
                    stroke="var(--color-approvals)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ChartContainer>
              <div className="activity-panel__footnote">
                <span><Check aria-hidden="true" /> Decisions are represented separately from total calls.</span>
                <span>Illustrative metrics</span>
              </div>
            </CardContent>
          </Card>

          <Card className="panel-card event-panel">
            <PanelHeading
              title="Recent decisions"
              description="A searchable, value-free preview of the audit trail."
              action={
                <Button type="button" variant="ghost" className="text-action" onClick={() => onNavigate("Audit Log")}>
                  Full audit log <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
                </Button>
              }
            />
            <CardContent className="event-list">
              {visibleEvents.length > 0 ? visibleEvents.map((event) => (
                <div className="event-row" key={event.id}>
                  <span className={`event-row__icon event-row__icon--${decisionTone(event.decision)}`} aria-hidden="true">
                    {event.decision === "Blocked" ? <ShieldX /> : event.decision === "Approval needed" ? <CircleAlert /> : event.decision === "Allowed" ? <BadgeCheck /> : <LockKeyhole />}
                  </span>
                  <div className="event-row__main">
                    <div className="event-row__title-line">
                      <p className="event-row__title">{event.summary}</p>
                      <StatusBadge tone={decisionTone(event.decision)}>{event.decision}</StatusBadge>
                    </div>
                    <p className="event-row__meta">{event.actor}<span>·</span>{event.tool}<span>·</span>{event.finding}</p>
                  </div>
                  <span className="event-row__time">{event.time}</span>
                </div>
              )) : (
                <div className="empty-search">
                  <Search aria-hidden="true" />
                  <p>No sample events match “{query}”.</p>
                  <Button type="button" variant="ghost" className="text-action" onClick={() => onNavigate("Audit Log")}>Open audit log</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="overview-side-column">
          <Card className="panel-card posture-panel">
            <PanelHeading
              title="Security posture"
              description="A snapshot of the configured guardrail layers."
              action={<ShieldCheck className="panel-heading__standalone-icon" aria-hidden="true" />}
            />
            <CardContent>
              <div className="posture-score-row">
                <div className="score-ring" role="img" aria-label="Sample protection score: 96 out of 100">
                  <div className="score-ring__center"><strong>96</strong><span>/100</span></div>
                </div>
                <div className="posture-score-copy">
                  <StatusBadge tone="safe">STRONG</StatusBadge>
                  <p>Sample posture score</p>
                  <span>Based on 3 demo checks</span>
                </div>
              </div>
              <div className="posture-checks">
                <div className="posture-check">
                  <span className="posture-check__icon"><Fingerprint aria-hidden="true" /></span>
                  <span className="posture-check__copy"><strong>Data detection</strong><small>India-specific patterns · sample</small></span>
                  <StatusBadge tone="safe">Ready</StatusBadge>
                </div>
                <div className="posture-check">
                  <span className="posture-check__icon"><ShieldCheck aria-hidden="true" /></span>
                  <span className="posture-check__copy"><strong>Policy validation</strong><small>Conflict review · sample</small></span>
                  <StatusBadge tone="warning">1 review</StatusBadge>
                </div>
                <div className="posture-check">
                  <span className="posture-check__icon"><LockKeyhole aria-hidden="true" /></span>
                  <span className="posture-check__copy"><strong>Audit integrity</strong><small>Hash-chain UI preview</small></span>
                  <StatusBadge tone="info">Demo</StatusBadge>
                </div>
              </div>
              <div className="posture-panel__foot"><span>Last demo check</span><strong>{lastDemoCheck}</strong></div>
            </CardContent>
          </Card>

          <Card className="panel-card approval-preview">
            <PanelHeading
              title="Approval queue"
              description="Nothing sensitive leaves without a decision."
              action={<StatusBadge tone={pendingApprovals.length > 0 ? "warning" : "safe"}>{pendingApprovals.length} pending</StatusBadge>}
            />
            <CardContent className="approval-preview__content">
              {pendingApprovals.length > 0 ? pendingApprovals.slice(0, 2).map((approval) => (
                <button
                  type="button"
                  className="approval-preview__item"
                  key={approval.id}
                  onClick={() => onNavigate("Action Gate")}
                >
                  <span className="approval-preview__item-icon"><CircleAlert aria-hidden="true" /></span>
                  <span className="approval-preview__item-copy">
                    <strong>{approval.title}</strong>
                    <small>{approval.agent} · {approval.dataType}</small>
                  </span>
                  <ArrowRight className="approval-preview__arrow" aria-hidden="true" />
                </button>
              )) : (
                <div className="approval-preview__empty"><Check aria-hidden="true" /><span>All sample requests are resolved.</span></div>
              )}
              <Button type="button" variant="outline" className="action-button action-button--quiet approval-preview__review" onClick={() => onNavigate("Action Gate")}>
                Review approval queue <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="flow-strip" aria-label="Firewall processing flow">
        <div className="flow-strip__intro"><span className="flow-strip__spark"><ShieldCheck aria-hidden="true" /></span><div><strong>Every tool call, one protected path</strong><span>Illustrative architecture from the project brief</span></div></div>
        <div className="flow-step"><span>01</span><strong>Agent request</strong></div>
        <ArrowRight className="flow-arrow" aria-hidden="true" />
        <div className="flow-step"><span>02</span><strong>Policy + data checks</strong></div>
        <ArrowRight className="flow-arrow" aria-hidden="true" />
        <div className="flow-step"><span>03</span><strong>Action Gate</strong></div>
        <ArrowRight className="flow-arrow" aria-hidden="true" />
        <div className="flow-step"><span>04</span><strong>Tool or safe block</strong></div>
      </div>
    </div>
  )
}
