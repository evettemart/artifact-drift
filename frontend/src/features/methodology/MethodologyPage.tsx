import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardTitle } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { useDriftRuns } from "@/hooks/useDriftRuns";
import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/severity";
import { layerLabel } from "@/lib/layers";
import {
  SCORE_BASELINE,
  SCORE_BANDS,
  SEVERITY_WEIGHTS,
  computeComplianceScore,
  scoreBand,
  scoreBreakdown,
} from "@/lib/scoring";

export function MethodologyPage() {
  const navigate = useNavigate();
  const runsQuery = useDriftRuns();
  const latestRun = runsQuery.data?.items[0];

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <button
        onClick={() => navigate("/dashboard")}
        className="mb-4 flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </button>

      <PageHeader
        title="How the Compliance Score is Calculated"
        description="The score is fully deterministic — identical drift always yields the same number. No machine learning or LLM influences it."
      />

      <div className="mt-6 space-y-6">
        {/* Formula */}
        <Card>
          <CardTitle>The Formula</CardTitle>
          <p className="mt-3 text-sm text-fg-muted">
            Every environment starts at a perfect baseline of{" "}
            <span className="font-semibold text-fg">{SCORE_BASELINE}</span>. Each
            open drift finding subtracts a fixed penalty determined by its
            severity. The result is clamped to the range 0–100.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-bg-panel px-4 py-3 font-mono text-sm text-fg">
            score = max(0, {SCORE_BASELINE} − Σ ( weight<sub>severity</sub> ×
            count<sub>severity</sub> ))
          </div>
        </Card>

        {/* Weights */}
        <Card>
          <CardTitle>Severity Weights</CardTitle>
          <p className="mt-3 text-sm text-fg-muted">
            Weights are deliberately steep for high-severity drift so a single
            critical security regression dominates many cosmetic differences.
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bg-panel text-left text-xs uppercase tracking-wide text-fg-subtle">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Severity</th>
                  <th className="px-4 py-2.5 font-medium">Penalty / finding</th>
                  <th className="px-4 py-2.5 font-medium">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {SEVERITY_ORDER.map((s) => (
                  <tr key={s}>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_META[s].bg} ${SEVERITY_META[s].text}`}
                      >
                        {SEVERITY_META[s].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-fg">
                      −{SEVERITY_WEIGHTS[s]}
                    </td>
                    <td className="px-4 py-3 text-fg-subtle">
                      {RATIONALE[s]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Bands */}
        <Card>
          <CardTitle>Score Bands</CardTitle>
          <div className="mt-4 flex flex-wrap gap-3">
            {SCORE_BANDS.map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2 rounded-lg border border-border bg-bg-panel px-3 py-2"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-sm font-medium text-fg">{b.label}</span>
                <span className="text-xs text-fg-subtle">
                  {b.min === 0 ? "0" : `${b.min}`}
                  {b.min === 0 ? "–64" : b.label === "Healthy" ? "–100" : "–84"}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Worked example */}
        <Card>
          <CardTitle>Worked Example — Latest Run</CardTitle>
          {runsQuery.isLoading && (
            <div className="mt-4">
              <Spinner label="Loading run…" />
            </div>
          )}
          {latestRun && <WorkedExample run={latestRun} />}
        </Card>
      </div>
    </div>
  );
}

const RATIONALE: Record<string, string> = {
  critical: "Security or data-exposure regression — must be fixed immediately.",
  high: "Material divergence from intent with real operational risk.",
  medium: "Notable difference worth review but not urgent.",
  low: "Cosmetic or low-impact drift (tags, naming).",
  info: "Informational only — no penalty applied.",
};

function WorkedExample({
  run,
}: {
  run: NonNullable<ReturnType<typeof useDriftRuns>["data"]>["items"][number];
}) {
  const rows = scoreBreakdown(run.summary);
  const totalPenalty = rows.reduce((sum, r) => sum + r.penalty, 0);
  const score = computeComplianceScore(run.summary);
  const band = scoreBand(score);

  return (
    <>
      <p className="mt-3 text-sm text-fg-muted">
        {layerLabel(run.baseLayer)} → {layerLabel(run.targetLayer)}
      </p>
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-panel text-left text-xs uppercase tracking-wide text-fg-subtle">
            <tr>
              <th className="px-4 py-2.5 font-medium">Severity</th>
              <th className="px-4 py-2.5 font-medium">Count</th>
              <th className="px-4 py-2.5 font-medium">Weight</th>
              <th className="px-4 py-2.5 font-medium">Penalty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.severity}>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_META[r.severity].bg} ${SEVERITY_META[r.severity].text}`}
                  >
                    {SEVERITY_META[r.severity].label}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-fg-muted">{r.count}</td>
                <td className="px-4 py-2.5 font-mono text-fg-muted">
                  {r.weight}
                </td>
                <td className="px-4 py-2.5 font-mono text-fg">−{r.penalty}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-bg-panel">
              <td className="px-4 py-2.5 font-medium text-fg" colSpan={3}>
                Total penalty
              </td>
              <td className="px-4 py-2.5 font-mono font-semibold text-fg">
                −{totalPenalty}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-bg-panel px-4 py-3 font-mono text-sm">
        <span className="text-fg-muted">
          max(0, {SCORE_BASELINE} − {totalPenalty}) =
        </span>
        <span className="text-lg font-semibold" style={{ color: band.color }}>
          {score}
        </span>
        <span className="text-fg-subtle">({band.label})</span>
      </div>
    </>
  );
}
