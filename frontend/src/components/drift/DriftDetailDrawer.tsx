import { X, Check, EyeOff, RotateCcw, CircleCheck, type LucideIcon } from 'lucide-react';
import { SeverityBadge, StatusBadge, titleCase } from './badges';
import { formatDate } from '../../lib/utils';
import type { DriftFinding, DriftStatus } from './types';

export function DriftDetailDrawer({
  record,
  onClose,
  onStatusChange,
}: {
  record: DriftFinding;
  onClose: () => void;
  onStatusChange: (id: string, status: DriftStatus) => void;
}) {
  const reasoning = record.reasoning;
  const impact = reasoning?.impact ?? reasoning?.businessImpact;
  const diffs = record.attributeDiffs ?? [];

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />

      <div className="relative flex h-full w-[30rem] flex-col border-l border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={record.severity} />
              <StatusBadge status={record.status} />
              <span className="font-mono text-[11px] text-slate-500">{record.driftId}</span>
            </div>
            <h2 className="mt-2 text-base font-semibold text-slate-100">
              {reasoning?.summary || record.diffSummary}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {record.comparison.baseLabel} → {record.comparison.targetLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close detail panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Meta label="Drift type" value={titleCase(String(record.driftType))} />
            <Meta label="Resource" value={titleCase(record.resourceType)} />
            <Meta label="Logical name" value={record.logicalName} mono />
            <Meta label="Region" value={record.region} mono />
            <Meta label="Scan" value={record.scanId} mono />
            <Meta label="Detected" value={formatDate(record.detectedAt)} />
          </div>

          {reasoning?.summary && (
            <Section title="Analysis" tone="sky">
              {reasoning.summary}
            </Section>
          )}
          {reasoning?.likelyCause && (
            <Section title="Likely Cause" tone="amber">
              {reasoning.likelyCause}
            </Section>
          )}
          {impact && (
            <Section title="Impact" tone="orange">
              {impact}
            </Section>
          )}

          {reasoning?.terraformRemediation && (
            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Terraform Remediation
              </h3>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-[11px] text-slate-200">
                <code>{reasoning.terraformRemediation}</code>
              </pre>
            </section>
          )}

          {diffs.length > 0 && (
            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Base vs Target
              </h3>
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-700">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-left text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Path</th>
                      <th className="px-3 py-2 font-medium">Expected</th>
                      <th className="px-3 py-2 font-medium">Observed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {diffs.map((d, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-slate-400">{d.path}</td>
                        <td className="px-3 py-2 font-mono text-green-300">{fmt(d.expectedValue)}</td>
                        <td className="px-3 py-2 font-mono text-red-300">{fmt(d.observedValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {(record.expected != null || record.observed != null) && (
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {record.expected != null && (
                <RawValue label="Expected" value={record.expected} tone="green" />
              )}
              {record.observed != null && (
                <RawValue label="Observed" value={record.observed} tone="red" />
              )}
            </section>
          )}
        </div>

        <div className="border-t border-slate-700 px-5 py-3">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Actions</div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={Check}
              label="Acknowledge"
              onClick={() => onStatusChange(record.driftId, 'acknowledged')}
              disabled={record.status === 'acknowledged'}
            />
            <ActionButton
              icon={CircleCheck}
              label="Resolve"
              onClick={() => onStatusChange(record.driftId, 'resolved')}
              disabled={record.status === 'resolved'}
            />
            <ActionButton
              icon={EyeOff}
              label="Suppress"
              onClick={() => onStatusChange(record.driftId, 'suppressed')}
              disabled={record.status === 'suppressed'}
            />
            <ActionButton
              icon={RotateCcw}
              label="Reopen"
              onClick={() => onStatusChange(record.driftId, 'open')}
              disabled={record.status === 'open'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const TONE_CLS: Record<string, string> = {
  sky: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  orange: 'border-orange-500/30 bg-orange-500/10 text-orange-100',
};

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: keyof typeof TONE_CLS;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-lg border p-3 ${TONE_CLS[tone]}`}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed">{children}</p>
    </section>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className={'mt-0.5 text-slate-200 ' + (mono ? 'font-mono text-[11px]' : '')}>{value}</div>
    </div>
  );
}

function RawValue({ label, value, tone }: { label: string; value: unknown; tone: 'green' | 'red' }) {
  const text = tone === 'green' ? 'text-green-300' : 'text-red-300';
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <pre className={`mt-1 overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-[11px] ${text}`}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function fmt(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
