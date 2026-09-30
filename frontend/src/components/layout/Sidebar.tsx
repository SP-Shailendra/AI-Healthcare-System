import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, ChevronDown, ChevronsLeft, ChevronsRight } from "lucide-react";
import { normalizeUserRole, useAuthStore } from "@/lib/auth";
import {
  type MenuItem,
  operationsItems,
  diagnosticsItems,
  intelligenceItems,
  healthcareSystemItems,
  filterMenuItemsForRole,
} from "./nav-config";

interface SidebarSection {
  key: string;
  label: string;
  items: MenuItem[];
}

function isActiveRoute(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

/** Mirrors TopNav's per-role grouping so the sidebar and mega-menu never drift apart. */
function buildSectionsForRole(role: string): SidebarSection[] {
  const pickItems = (items: MenuItem[], ids: string[]) => {
    const allowed = new Set(ids);
    return items.filter((item) => allowed.has(item.id));
  };

  // Staff roles see every Operations module; patients only see what applies to them.
  const roleOperationsItems = role === "admin" || role === "doctor" || role === "nurse"
    ? operationsItems
    : pickItems(operationsItems, ["dashboard", "telemedicine"]);

  const sections: SidebarSection[] = [
    { key: "operations", label: "Operations", items: roleOperationsItems },
  ];

  if (role === "admin" || role === "doctor") {
    sections.push({ key: "diagnostics", label: "Diagnostics AI", items: diagnosticsItems });
  }

  if (role === "admin" || role === "doctor" || role === "patient") {
    sections.push({ key: "intelligence", label: "Intelligence", items: intelligenceItems });
  }

  if (role === "admin" || role === "doctor" || role === "nurse") {
    sections.push({ key: "ai-system", label: "AI System", items: healthcareSystemItems });
  } else {
    const items = filterMenuItemsForRole(healthcareSystemItems, role);
    if (items.length > 0) sections.push({ key: "ai-system", label: "AI System", items });
  }

  return sections.filter((section) => section.items.length > 0);
}

interface SidebarProps {
  systemStatus?: string | null;
  hidden?: boolean;
  onToggleHidden?: () => void;
}

export default function Sidebar({ systemStatus, hidden, onToggleHidden }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuthStore();
  const role = normalizeUserRole(user?.role || "doctor");
  const sections = buildSectionsForRole(role);
  const displayName = user?.full_name || user?.username || "Clinician";

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) =>
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (hidden) {
    return (
      <button
        type="button"
        onClick={onToggleHidden}
        aria-label="Show sidebar"
        title="Show sidebar"
        className="hidden lg:flex fixed left-0 top-24 z-40 items-center gap-1 rounded-r-xl border border-l-0 border-[var(--border)] bg-[var(--bg-card)] px-1.5 py-3 text-[var(--text-secondary)] shadow-[var(--shadow-soft)] hover:text-[var(--accent)]"
      >
        <ChevronsRight size={14} aria-hidden="true" />
      </button>
    );
  }

  return (
    <aside
      className="hidden lg:flex fixed left-4 top-20 bottom-4 z-40 w-64 flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)] overflow-hidden"
      aria-label="Primary navigation"
    >
      <div className="mb-5 flex items-center gap-2 px-2 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-[var(--shadow-glow-indigo)]">
          <Activity size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold text-[var(--text-primary)]">Compunnel</div>
          <div className="truncate text-[10px] text-[var(--text-secondary)]">Clinical Intelligence</div>
        </div>
        <button
          type="button"
          onClick={onToggleHidden}
          aria-label="Hide sidebar"
          title="Hide sidebar"
          className="ml-auto shrink-0 rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
        >
          <ChevronsLeft size={15} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto pr-1" aria-label="Role navigation">
        {sections.map((section) => {
          const collapsed = collapsedSections[section.key];
          return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                aria-expanded={!collapsed}
                className="mb-1.5 flex w-full items-center justify-between px-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <span>{section.label}</span>
                <ChevronDown
                  size={12}
                  aria-hidden="true"
                  className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
                />
              </button>
              {!collapsed && (
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = isActiveRoute(location.pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                          active
                            ? "bg-[var(--accent-muted)] text-[var(--accent)] ring-1 ring-[var(--accent-border)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <Icon size={16} aria-hidden="true" className="shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border-subtle)] pt-3 shrink-0">
        <div className="mb-2 truncate px-2 text-xs font-semibold text-[var(--text-primary)]">{displayName}</div>
        <div
          className={`flex items-center gap-2 px-2 text-[10px] font-medium ${systemStatus ? "text-[var(--warning)]" : "text-[var(--success)]"}`}
          role="status"
          aria-live="polite"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${systemStatus ? "bg-[var(--warning)]" : "bg-[var(--success)]"}`} />
          <span>{systemStatus ? "Connection degraded" : "All systems normal"}</span>
        </div>
      </div>
    </aside>
  );
}