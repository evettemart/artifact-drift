import { RefreshCw, CalendarClock, Check } from "lucide-react";
import { useStartScan, useScanSchedule, useSetScanSchedule } from "@/hooks/useScan";
import { cn } from "@/lib/cn";

const SCHEDULES: { value: string; label: string }[] = [
  { value: "off", label: "Manual only" },
  { value: "hourly", label: "Every hour" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

/** Trigger an on-demand drift scan and configure a recurring schedule. */
export function ScanControls() {
  const startScan = useStartScan();
  const scheduleQuery = useScanSchedule();
  const setSchedule = useSetScanSchedule();
  const schedule = scheduleQuery.data?.schedule ?? "off";

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-panel px-2.5 py-1.5">
        <CalendarClock className="h-3.5 w-3.5 text-fg-subtle" />
        <select
          value={schedule}
          onChange={(e) => setSchedule.mutate(e.target.value)}
          className="bg-transparent text-xs text-fg focus:outline-none"
          title="Scan schedule"
        >
          {SCHEDULES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {setSchedule.isSuccess && !setSchedule.isPending && (
          <Check className="h-3.5 w-3.5 text-severity-low" />
        )}
      </div>

      <button
        onClick={() => startScan.mutate({})}
        disabled={startScan.isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-60"
      >
        <RefreshCw className={cn("h-4 w-4", startScan.isPending && "animate-spin")} />
        {startScan.isPending ? "Scanning…" : "Scan now"}
      </button>
    </div>
  );
}
