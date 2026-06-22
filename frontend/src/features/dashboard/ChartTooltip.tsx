interface TooltipPayload {
  name?: string;
  value?: number | string;
  payload?: { severity?: string; kind?: string; fill?: string };
}

/** Shared dark tooltip for the dashboard charts. */
export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const labelText =
    label ?? item.payload?.severity ?? item.payload?.kind ?? item.name ?? "";

  return (
    <div className="rounded-md border border-border bg-bg-panel px-3 py-2 text-xs shadow-xl">
      <div className="font-medium text-fg">{labelText}</div>
      <div className="mt-0.5 text-fg-muted">
        {item.value} {Number(item.value) === 1 ? "finding" : "findings"}
      </div>
    </div>
  );
}
