import { ChevronsUpDown } from "lucide-react";
import { DevMenu } from "@/app/layout/DevMenu";

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg-subtle px-6">
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 rounded-md border border-border bg-bg-panel px-3 py-1.5 text-sm text-fg-muted hover:text-fg">
          <span className="h-2 w-2 rounded-full bg-severity-low" />
          Acme Corp
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </button>
        <span className="text-fg-subtle">/</span>
        <button className="flex items-center gap-2 rounded-md border border-border bg-bg-panel px-3 py-1.5 text-sm text-fg-muted hover:text-fg">
          Run · latest
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <DevMenu />
    </header>
  );
}
