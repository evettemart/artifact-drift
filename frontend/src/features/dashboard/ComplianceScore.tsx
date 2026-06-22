import { useNavigate } from "react-router-dom";
import { ShieldCheck, ShieldAlert, ShieldX, Info } from "lucide-react";
import { Card } from "@/components/Card";
import { scoreBand } from "@/lib/scoring";

/** Compliance score 0-100 with a deterministic colour band and radial gauge.
 * Clicking opens the scoring methodology page. */
export function ComplianceScore({ score }: { score: number }) {
  const navigate = useNavigate();
  const band = scoreBand(score);
  const Icon =
    band.label === "Healthy"
      ? ShieldCheck
      : band.label === "At risk"
        ? ShieldAlert
        : ShieldX;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 128 128" className="h-32 w-32 -rotate-90">
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="#1f2733"
              strokeWidth="10"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={band.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold text-fg">{score}</span>
            <span className="text-[11px] text-fg-subtle">/ 100</span>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-fg-muted">
            Compliance Score
          </div>
          <div
            className="mt-1 flex items-center gap-1.5 text-lg font-semibold"
            style={{ color: band.color }}
          >
            <Icon className="h-5 w-5" />
            {band.label}
          </div>
          <p className="mt-2 max-w-xs text-xs text-fg-subtle">
            Derived deterministically from open drift records, weighted by
            severity.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate("/methodology")}
        className="mt-4 inline-flex items-center gap-1 self-start rounded-md border border-border px-2.5 py-1.5 text-xs text-fg-muted transition-colors hover:border-brand/50 hover:text-fg"
        title="How is this score calculated?"
      >
        <Info className="h-3.5 w-3.5" />
        How is this calculated?
      </button>
    </Card>
  );
}
