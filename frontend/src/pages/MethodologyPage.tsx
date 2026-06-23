import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import apiClient from '../lib/api';
import { LoadingState } from '../components/LoadingSpinner';
import { SEVERITY_META, SEVERITY_ORDER } from '../lib/severity';
import {
  SCORE_BASELINE,
  SCORE_BANDS,
  SEVERITY_WEIGHTS,
  computeComplianceScore,
  scoreBand,
  scoreBreakdown,
} from '../lib/scoring';
import type { DriftRun } from '../components/drift/types';

const RATIONALE: Record<string, string> = {
  critical: 'Security or data-exposure regression — must be fixed immediately.',
  high: 'Material divergence from intent with real operational risk.',
  medium: 'Notable difference worth review but not urgent.',
  low: 'Cosmetic or low-impact drift (tags, naming).',
  info: 'Informational only — no penalty applied.',
};

export function MethodologyPage() {
  const navigate = useNavigate();
  const { data: runsData, isLoading } = useQuery({
    queryKey: ['drift-runs'],
    queryFn: async () => (await apiClient.getDriftRuns()).data as { runs: DriftRun[] },
  });
  const latestRun = runsData?.runs?.[0];

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => navigate('/')}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">
          How the Compliance Score is Calculated
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          The score is fully deterministic — identical drift always yields the same number. No
          machine learning or LLM influences it.
        </p>
      </div>

      <div className="space-y-6">
        {/* Formula */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            The Formula
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            Every environment starts at a perfect baseline of{' '}
            <span className="font-semibold text-slate-100">{SCORE_BASELINE}</span>. Each open drift
            finding subtracts a fixed penalty determined by its severity. The result is clamped to
            the range 0–100.
          </p>
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100">
            score = max(0, {SCORE_BASELINE} − Σ ( weight<sub>severity</sub> × count
            <sub>severity</sub> ))
          </div>
        </div>

        {/* Weights */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Severity Weights
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            Weights are deliberately steep for high-severity drift so a single critical security
            regression dominates many cosmetic differences.
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Severity</th>
                  <th className="px-4 py-2.5 font-medium">Penalty / finding</th>
                  <th className="px-4 py-2.5 font-medium">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {SEVERITY_ORDER.map((s) => (
                  <tr key={s}>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_META[s].bg} ${SEVERITY_META[s].text}`}
                      >
                        {SEVERITY_META[s].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-200">−{SEVERITY_WEIGHTS[s]}</td>
                    <td className="px-4 py-3 text-slate-400">{RATIONALE[s]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bands */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Score Bands
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {SCORE_BANDS.map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: b.color }} />
                <span className="text-sm font-medium text-slate-100">{b.label}</span>
                <span className="text-xs text-slate-500">
                  {b.min === 0 ? '0–64' : b.label === 'Healthy' ? '85–100' : '65–84'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Worked example */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Worked Example — Latest Run
          </h2>
          {isLoading && (
            <div className="mt-4">
              <LoadingState message="Loading run..." />
            </div>
          )}
          {latestRun && <WorkedExample run={latestRun} />}
          {!isLoading && !latestRun && (
            <p className="mt-3 text-sm text-slate-400">No drift runs available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkedExample({ run }: { run: DriftRun }) {
  const rows = scoreBreakdown(run.summary);
  const totalPenalty = rows.reduce((sum, r) => sum + r.penalty, 0);
  const score = computeComplianceScore(run.summary);
  const band = scoreBand(score);

  return (
    <>
      <p className="mt-3 text-sm text-slate-300">
        {run.baseLabel} → {run.targetLabel}
      </p>
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Severity</th>
              <th className="px-4 py-2.5 font-medium">Count</th>
              <th className="px-4 py-2.5 font-medium">Weight</th>
              <th className="px-4 py-2.5 font-medium">Penalty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((r) => (
              <tr key={r.severity}>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_META[r.severity].bg} ${SEVERITY_META[r.severity].text}`}
                  >
                    {SEVERITY_META[r.severity].label}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-slate-300">{r.count}</td>
                <td className="px-4 py-2.5 font-mono text-slate-300">{r.weight}</td>
                <td className="px-4 py-2.5 font-mono text-slate-100">−{r.penalty}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-800 bg-slate-900">
              <td className="px-4 py-2.5 font-medium text-slate-100" colSpan={3}>
                Total penalty
              </td>
              <td className="px-4 py-2.5 font-mono font-semibold text-slate-100">−{totalPenalty}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 font-mono text-sm">
        <span className="text-slate-300">
          max(0, {SCORE_BASELINE} − {totalPenalty}) =
        </span>
        <span className="text-lg font-semibold" style={{ color: band.color }}>
          {score}
        </span>
        <span className="text-slate-500">({band.label})</span>
      </div>
    </>
  );
}
