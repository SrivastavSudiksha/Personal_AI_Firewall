import { Bell, ChevronRight, Menu, Plus, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/firewall-shared"
import type { DashboardSection } from "@/lib/firewall-demo-data"

export function FirewallTopbar({
  activeSection,
  pendingCount,
  query,
  onQueryChange,
  onNavigate,
  onNewPolicy,
  onOpenMenu,
}: {
  activeSection: DashboardSection
  pendingCount: number
  query: string
  onQueryChange: (value: string) => void
  onNavigate: (section: DashboardSection) => void
  onNewPolicy: () => void
  onOpenMenu: () => void
}) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="topbar__menu"
          aria-label="Open navigation"
          onClick={onOpenMenu}
        >
          <Menu />
        </Button>
        <div className="breadcrumbs" aria-label="Breadcrumb">
          <span className="breadcrumbs__root">Workspace</span>
          <ChevronRight aria-hidden="true" />
          <span className="breadcrumbs__current">{activeSection}</span>
        </div>
      </div>

      <div className="topbar__right">
        <StatusBadge tone="info" className="topbar__demo-badge">LOCAL</StatusBadge>
        <label className="global-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search current view</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search events, policies..."
          />
          <kbd>/</kbd>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="topbar__icon-button topbar__notifications"
          aria-label={`${pendingCount} pending approvals`}
          title="Open approval queue"
          onClick={() => onNavigate("Action Gate")}
        >
          <Bell aria-hidden="true" />
          {pendingCount > 0 ? <Badge className="topbar__notification-count">{pendingCount}</Badge> : null}
        </Button>
        <Button
          type="button"
          variant="default"
          className="action-button action-button--primary topbar__new-policy"
          onClick={onNewPolicy}
        >
          <Plus data-icon="inline-start" aria-hidden="true" />
          <span>New policy</span>
        </Button>
      </div>
    </header>
  )
}
