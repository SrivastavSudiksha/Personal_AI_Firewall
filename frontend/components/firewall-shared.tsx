import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StatusTone =
  | "safe"
  | "warning"
  | "danger"
  | "neutral"
  | "info"
  | "accent"
  | "muted"

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("status-badge", `status-badge--${tone}`, className)}
    >
      {children}
    </Badge>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="section-heading">
      <div className="section-heading__copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p className="section-heading__description">{description}</p> : null}
      </div>
      {action ? <div className="section-heading__action">{action}</div> : null}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  trend,
  helper,
  icon,
  tone = "safe",
}: {
  label: string
  value: string | number
  trend?: string
  helper: string
  icon: ReactNode
  tone?: StatusTone
}) {
  return (
    <Card className="metric-card">
      <CardHeader className="metric-card__header">
        <div className="metric-card__label-row">
          <CardTitle className="metric-card__label">{label}</CardTitle>
          <span className={cn("metric-card__icon", `metric-card__icon--${tone}`)} aria-hidden="true">
            {icon}
          </span>
        </div>
      </CardHeader>
      <CardContent className="metric-card__content">
        <div className="metric-card__value-row">
          <span className="metric-card__value">{value}</span>
          {trend ? <StatusBadge tone={tone}>{trend}</StatusBadge> : null}
        </div>
        <p className="metric-card__helper">{helper}</p>
      </CardContent>
    </Card>
  )
}

export function PanelHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <CardHeader className="panel-heading">
      <div className="panel-heading__copy">
        <CardTitle className="panel-heading__title">{title}</CardTitle>
        {description ? <p className="panel-heading__description">{description}</p> : null}
      </div>
      {action ? <div className="panel-heading__action">{action}</div> : null}
    </CardHeader>
  )
}
