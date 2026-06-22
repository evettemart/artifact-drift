import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardTitle } from "@/components/Card";
import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/severity";
import { formatDateTime } from "@/lib/format";
import { layerLabel } from "@/lib/layers";
import { computeComplianceScore } from "@/lib/scoring";
import type { DriftRun } from "@/api/types";

export function RecentRunsTable({ runs }: { runs: DriftRun[] }) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardTitle>Recent Drift Runs</CardTitle>
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-panel text-left text-xs uppercase tracking-wide text-fg-subtle">
            <tr>
              <th className="px-4 py-2.5 font-medium">Comparison</th>
              <th className="px-4 py-2.5 font-medium">Findings</th>
              <th className="px-4 py-2.5 font-medium">Score</th>
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((run) => {
              const total = SEVERITY_ORDER.reduce(
                (sum, s) => sum + run.summary[s],
                0,
              );
              return (
                <tr
                  key={run.id}
                  className="cursor-pointer transition-colors hover:bg-bg-panel"
                  onClick={() => navigate("/drift")}
                >
                  <td className="px-4 py-3 font-medium text-fg">
                    {layerLabel(run.baseLayer)} → {layerLabel(run.targetLayer)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {SEVERITY_ORDER.filter((s) => run.summary[s] > 0).map(
                        (s) => (
                          <span
                            key={s}
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_META[s].bg} ${SEVERITY_META[s].text}`}
                          >
                            {run.summary[s]}
                          </span>
                        ),
                      )}
                      {total === 0 && (
                        <span className="text-xs text-fg-subtle">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {computeComplianceScore(run.summary)}
                  </td>
                  <td className="px-4 py-3 text-fg-subtle">
                    {formatDateTime(run.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ArrowRight className="ml-auto h-4 w-4 text-fg-subtle" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
