import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical, RotateCcw } from "lucide-react";
import { mockStore } from "@/mocks/store";

/**
 * Dev menu for the mock data layer. "Reset / Reseed test data" clears the MSW
 * in-memory store back to fixtures and refetches all queries.
 */
export function DevMenu() {
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();

  function handleReset() {
    setResetting(true);
    mockStore.reset();
    void queryClient.invalidateQueries().finally(() => {
      setResetting(false);
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-border bg-bg-panel px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <FlaskConical className="h-4 w-4" />
        Dev
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-border bg-bg-panel p-1 shadow-xl">
          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-fg-subtle">
            Mock data
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-fg-muted hover:bg-bg-subtle hover:text-fg disabled:opacity-60"
          >
            <RotateCcw className={resetting ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {resetting ? "Reseeding…" : "Reset / Reseed test data"}
          </button>
        </div>
      )}
    </div>
  );
}
