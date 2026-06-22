import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardTitle } from "@/components/Card";
import { SEVERITY_META } from "@/lib/severity";
import { titleCase } from "@/lib/format";
import type { DriftRecord } from "@/api/types";
import { ChartTooltip } from "@/features/dashboard/ChartTooltip";

/** Aggregates drift records by resource kind, coloured by the worst severity present. */
export function DriftByKindChart({ records }: { records: DriftRecord[] }) {
  const byKind = new Map<string, { count: number; worstRank: number; hex: string }>();

  for (const r of records) {
    const meta = SEVERITY_META[r.severity];
    const existing = byKind.get(r.resourceKind);
    if (!existing) {
      byKind.set(r.resourceKind, { count: 1, worstRank: meta.rank, hex: meta.hex });
    } else {
      existing.count += 1;
      if (meta.rank < existing.worstRank) {
        existing.worstRank = meta.rank;
        existing.hex = meta.hex;
      }
    }
  }

  const data = [...byKind.entries()]
    .map(([kind, v]) => ({
      kind: titleCase(kind.replace(/^aws_/, "")),
      count: v.count,
      fill: v.hex,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card>
      <CardTitle>Drift by Resource Kind</CardTitle>
      <div className="mt-4 h-56">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-fg-subtle">
            No drift records in this run.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
            >
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: "#9aa6b6", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="kind"
                width={120}
                tick={{ fill: "#9aa6b6", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip cursor={{ fill: "#ffffff08" }} content={<ChartTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {data.map((d) => (
                  <Cell key={d.kind} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
