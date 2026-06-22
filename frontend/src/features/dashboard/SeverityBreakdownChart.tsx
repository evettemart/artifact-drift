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
import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/severity";
import type { SeverityCounts } from "@/api/types";
import { ChartTooltip } from "@/features/dashboard/ChartTooltip";

export function SeverityBreakdownChart({
  summary,
}: {
  summary: SeverityCounts;
}) {
  const data = SEVERITY_ORDER.map((s) => ({
    severity: SEVERITY_META[s].label,
    count: summary[s],
    fill: SEVERITY_META[s].hex,
  }));

  return (
    <Card>
      <CardTitle>Drift by Severity</CardTitle>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <XAxis
              dataKey="severity"
              tick={{ fill: "#9aa6b6", fontSize: 12 }}
              axisLine={{ stroke: "#1f2733" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#9aa6b6", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#ffffff08" }}
              content={<ChartTooltip />}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {data.map((d) => (
                <Cell key={d.severity} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
