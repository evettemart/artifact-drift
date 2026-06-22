import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { BrandLogo } from "@/components/BrandLogo";
import { navItems } from "@/app/layout/navItems";

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-bg-subtle">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <BrandLogo size={32} className="shrink-0" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-fg">Drift Copilot</div>
          <div className="text-[11px] text-fg-subtle">Architecture Governance</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand/15 text-fg"
                  : "text-fg-muted hover:bg-bg-panel hover:text-fg",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-3 text-[11px] text-fg-subtle">
        <span className="font-mono">v0.7.0</span> · Mock data mode
      </div>
    </aside>
  );
}
