import {
  Activity,
  Bot,
  Braces,
  Fingerprint,
  FlaskConical,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  ShieldEllipsis,
  SlidersHorizontal,
  X,
} from "lucide-react"
import type { ComponentType } from "react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/firewall-shared"
import { cn } from "@/lib/utils"
import type { DashboardSection } from "@/lib/firewall-demo-data"

const navGroups: {
  label: string
  items: { label: DashboardSection; icon: ComponentType<{ className?: string }> }[]
}[] = [
  {
    label: "PROTECT",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Policy Engine", icon: SlidersHorizontal },
      { label: "Data Guardian", icon: Fingerprint },
      { label: "Action Gate", icon: ShieldCheck },
    ],
  },
  {
    label: "LEARN & VERIFY",
    items: [
      { label: "Living Red Team", icon: FlaskConical },
      { label: "Audit Log", icon: ScrollText },
    ],
  },
  {
    label: "ISOLATION",
    items: [{ label: "Agents & Sandbox", icon: Bot }],
  },
]

export function FirewallSidebar({
  activeSection,
  pendingCount,
  isOpen,
  onNavigate,
  onClose,
  sessionUser,
  onLogout,
}: {
  activeSection: DashboardSection
  pendingCount: number
  isOpen: boolean
  onNavigate: (section: DashboardSection) => void
  onClose: () => void
  sessionUser?: { username: string; role: string }
  onLogout?: () => void
}) {
  return (
    <aside className={cn("sidebar", isOpen && "sidebar--open")} aria-label="Main navigation">
      <div className="sidebar__brand-row">
        <div className="brand-mark" aria-hidden="true">
          <ShieldEllipsis />
        </div>
        <div className="brand-copy">
          <span className="brand-name">Shihezu</span>
          <span className="brand-caption">PERSONAL AI FIREWALL</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="sidebar__close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <button type="button" className="workspace-switcher" onClick={() => onNavigate("Overview")}>
        <span className="workspace-switcher__avatar">P</span>
        <span className="workspace-switcher__copy">
          <span>Personal workspace</span>
          <span>Local demo environment</span>
        </span>
        <Braces className="workspace-switcher__icon" aria-hidden="true" />
      </button>

      <nav className="sidebar__nav">
        {navGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-group__label">{group.label}</p>
            <div className="nav-group__items">
              {group.items.map(({ label, icon: Icon }) => {
                const isActive = activeSection === label
                return (
                  <Button
                    key={label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn("sidebar-link", isActive && "sidebar-link--active")}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onNavigate(label)}
                  >
                    <Icon className="sidebar-link__icon" aria-hidden="true" />
                    <span className="sidebar-link__label">{label}</span>
                    {label === "Action Gate" && pendingCount > 0 ? (
                      <span className="sidebar-link__count" aria-label={`${pendingCount} pending approvals`}>
                        {pendingCount}
                      </span>
                    ) : null}
                    {isActive ? <span className="sidebar-link__active-mark" aria-hidden="true" /> : null}
                  </Button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <div className="sidebar-status-card">
          <div className="sidebar-status-card__top">
            <span className="sidebar-status-card__icon"><Activity aria-hidden="true" /></span>
            <StatusBadge tone="safe">LOCAL</StatusBadge>
          </div>
          <p className="sidebar-status-card__title">Protection layers</p>
          <p className="sidebar-status-card__body">Policy, data, and tool controls are represented with sample data.</p>
          <div className="sidebar-status-card__meter"><span /></div>
          <div className="sidebar-status-card__meta"><span>3 of 3 layers shown</span><span>UI only</span></div>
        </div>

        <div className="sidebar-profile">
          <div className="sidebar-profile__avatar">{(sessionUser?.username || "admin")[0]?.toUpperCase()}</div>
          <div className="sidebar-profile__copy">
            <span>{sessionUser?.username || "Workspace owner"}</span>
            <span>{sessionUser?.role || "Personal setup"}</span>
          </div>
          {onLogout ? (
            <button type="button" className="sidebar-logout" onClick={onLogout} title="Sign out">
              Out
            </button>
          ) : (
            <span className="sidebar-profile__dot" aria-label="Profile active" />
          )}
        </div>
      </div>
    </aside>
  )
}
