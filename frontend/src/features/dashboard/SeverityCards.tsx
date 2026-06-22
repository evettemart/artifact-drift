import { useNavigate } from "react-router-dom";
import { Card } from "@/components/Card";
import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/severity";
import type { SeverityCounts } from "@/api/types";

export function SeverityCards({ summary }: { summary: SeverityCounts }) {
  const navigate = useNavigate();
  const total = SEVERITY_ORDER.reduce((sum, s) => sum + summary[s], 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <button
        type="button"
        onClick={() => navigate("/drift")}
        title="View all drift records"
        className="text-left"
      >
        <Card className="flex h-full flex-col justify-between transition-colors hover:border-brand/50">
          <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            Total
          </span>
          <span className="mt-2 text-2xl font-semibold text-fg">{total}</span>
        </Card>
      </button>
      {SEVERITY_ORDER.map((s) => {
        const meta = SEVERITY_META[s];
        return (
          <button
            key={s}
            type="button"
            onClick={() => navigate(`/drift?severity=${s}`)}
            title={`View ${meta.label.toLowerCase()} drift records`}
            className="text-left"
          >
            <Card className="flex h-full flex-col justify-between transition-colors hover:border-brand/50">
              <span className={`text-xs font-medium uppercase tracking-wide ${meta.text}`}>
                {meta.label}
              </span>
              <span className="mt-2 text-2xl font-semibold text-fg">
                {summary[s]}
              </span>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
