/** Compact grouped navigation menu for the desktop top bar. */
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { prefetchRoute } from "@/lib/prefetch";
import type { MenuItem } from "./nav-config";

const MegaMenuPanel: React.FC<{
  items: MenuItem[];
  cols?: number;
  onNavigate?: () => void;
}> = ({ items, cols = 2, onNavigate }) => (
  <div
    className="nav-menu-panel w-[min(680px,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-white p-3 shadow-[0_18px_45px_rgba(36,52,76,0.16)]"
    role="menu"
  >
    <div className="mb-2 flex items-center justify-between border-b border-[var(--border)] px-2 pb-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
        Navigate workspace
      </span>
      <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
        {items.length} modules
      </span>
    </div>
    <div className={`grid gap-1.5 ${cols === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            to={item.href}
            role="menuitem"
            onClick={onNavigate}
            onMouseEnter={() => prefetchRoute(item.href)}
            className="group flex min-w-0 items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-[var(--border-focus)] hover:bg-indigo-50"
          >
              <span className={`nav-menu-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] ${item.bg}`}>
                <Icon className={`h-4 w-4 ${item.color}`} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="nav-menu-title block truncate text-[12px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                {item.title}
              </span>
              <span className="nav-menu-desc mt-0.5 block truncate text-[10px] text-[var(--text-secondary)]">
                {item.desc}
              </span>
            </span>
            <ArrowRight className="nav-menu-arrow h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  </div>
);

export default MegaMenuPanel;