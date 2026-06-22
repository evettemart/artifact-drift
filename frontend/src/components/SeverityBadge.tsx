import { SEVERITY_META } from "@/lib/severity";
import type { Severity } from "@/api/types";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.text} border ${meta.border}`}
    >
      {meta.label}
    </span>
  );
}
