import { http, HttpResponse } from "msw";
import type {
  CopilotMessage,
  DriftRecord,
  DriftRun,
  Integration,
  Layer,
  RecordStatus,
  Report,
  ReportFormat,
} from "@/api/types";
import { mockStore } from "@/mocks/store";
import { latency } from "@/mocks/latency";

const BASE = "/api/v1";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const handlers = [
  // --- Graphs ---
  http.get(`${BASE}/graphs/:layer/latest`, async ({ params }) => {
    await latency();
    const layer = params.layer as Layer;
    const snapshot = mockStore.get().graphs[layer];
    if (!snapshot) return HttpResponse.json({ error: "unknown layer" }, { status: 404 });
    return HttpResponse.json(snapshot);
  }),

  // --- Drift runs ---
  http.get(`${BASE}/drift/runs`, async () => {
    await latency();
    return HttpResponse.json({
      items: mockStore.get().runs,
      total: mockStore.get().runs.length,
    });
  }),

  http.get(`${BASE}/drift/runs/:id`, async ({ params }) => {
    await latency();
    const run = mockStore.get().runs.find((r) => r.id === params.id);
    if (!run) return HttpResponse.json({ error: "not found" }, { status: 404 });
    return HttpResponse.json(run);
  }),

  http.get(`${BASE}/drift/runs/:id/records`, async ({ params, request }) => {
    await latency();
    const url = new URL(request.url);
    const severity = url.searchParams.getAll("severity");
    const status = url.searchParams.getAll("status");
    const driftType = url.searchParams.getAll("driftType");
    const search = url.searchParams.get("search")?.toLowerCase();

    let items = mockStore.get().records.filter((r) => r.runId === params.id);
    if (severity.length) items = items.filter((r) => severity.includes(r.severity));
    if (status.length) items = items.filter((r) => status.includes(r.status));
    if (driftType.length) items = items.filter((r) => driftType.includes(r.driftType));
    if (search) items = items.filter((r) => r.title.toLowerCase().includes(search));

    return HttpResponse.json({ items, total: items.length });
  }),

  http.get(`${BASE}/drift/records/:id`, async ({ params }) => {
    await latency();
    const rec = mockStore.get().records.find((r) => r.id === params.id);
    if (!rec) return HttpResponse.json({ error: "not found" }, { status: 404 });
    return HttpResponse.json(rec);
  }),

  http.patch(`${BASE}/drift/records/:id`, async ({ params, request }) => {
    await latency();
    const body = (await request.json()) as { status: RecordStatus };
    let updated: DriftRecord | undefined;
    mockStore.update((state) => {
      const rec = state.records.find((r) => r.id === params.id);
      if (rec) {
        rec.status = body.status;
        updated = rec;
      }
    });
    if (!updated) return HttpResponse.json({ error: "not found" }, { status: 404 });
    return HttpResponse.json(updated);
  }),

  // --- Scans (trigger a new drift run on demand) ---
  http.post(`${BASE}/scans`, async ({ request }) => {
    await latency(700, 1400);
    const body = (await request.json().catch(() => ({}))) as {
      baseLayer?: Layer;
      targetLayer?: Layer;
    };
    const baseLayer = body.baseLayer ?? "intent";
    const targetLayer = body.targetLayer ?? "runtime";

    // Use an existing run for the same layer pair as the template so a fresh
    // scan deterministically re-discovers the same drift.
    const runs = mockStore.get().runs;
    const template =
      runs.find(
        (r) => r.baseLayer === baseLayer && r.targetLayer === targetLayer,
      ) ?? runs[0];

    const now = new Date().toISOString();
    const newRunId = uid("scan");
    const newRun: DriftRun = {
      ...template,
      id: newRunId,
      baseLayer,
      targetLayer,
      status: "complete",
      createdAt: now,
    };

    const clonedRecords: DriftRecord[] = mockStore
      .get()
      .records.filter((r) => r.runId === template.id)
      .map((r) => ({ ...r, id: uid("dr"), runId: newRunId, status: "open", createdAt: now }));

    mockStore.update((state) => {
      state.runs.unshift(newRun);
      state.records.push(...clonedRecords);
    });
    return HttpResponse.json(newRun, { status: 201 });
  }),

  http.get(`${BASE}/scans/schedule`, async () => {
    await latency();
    return HttpResponse.json({ schedule: mockStore.get().scanSchedule });
  }),

  http.put(`${BASE}/scans/schedule`, async ({ request }) => {
    await latency();
    const body = (await request.json()) as { schedule: string };
    mockStore.update((state) => {
      state.scanSchedule = body.schedule;
    });
    return HttpResponse.json({ schedule: body.schedule });
  }),

  // --- Integrations ---
  http.get(`${BASE}/integrations`, async () => {
    await latency();
    return HttpResponse.json({
      items: mockStore.get().integrations,
      total: mockStore.get().integrations.length,
    });
  }),

  http.post(`${BASE}/integrations`, async ({ request }) => {
    await latency();
    const body = (await request.json()) as Partial<Integration>;
    const created: Integration = {
      id: uid("int"),
      kind: body.kind ?? "aws",
      name: body.name ?? "New integration",
      layer: body.layer ?? "runtime",
      status: "unconfigured",
      config: body.config ?? {},
    };
    mockStore.update((state) => state.integrations.push(created));
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post(`${BASE}/integrations/:id/test`, async ({ params }) => {
    await latency(300, 700);
    const integration = mockStore.get().integrations.find((i) => i.id === params.id);
    // Deterministic mock: confluence fails, everything else succeeds.
    const ok = integration ? integration.kind !== "confluence" : false;
    return HttpResponse.json({ ok, message: ok ? "Connection successful" : "Auth failed" });
  }),

  // --- Reports ---
  http.get(`${BASE}/reports`, async () => {
    await latency();
    return HttpResponse.json({
      items: mockStore.get().reports,
      total: mockStore.get().reports.length,
    });
  }),

  http.get(`${BASE}/reports/:id`, async ({ params }) => {
    await latency();
    const report = mockStore.get().reports.find((r) => r.id === params.id);
    if (!report) return HttpResponse.json({ error: "not found" }, { status: 404 });
    return HttpResponse.json(report);
  }),

  http.post(`${BASE}/reports`, async ({ request }) => {
    await latency(400, 900);
    const body = (await request.json()) as { runId: string; format: ReportFormat };
    const base = mockStore.get().reports[0];
    const run = mockStore.get().runs.find((r) => r.id === body.runId);
    const layerNames: Record<string, string> = {
      intent: "Planned Architecture",
      terraform: "Terraform State",
      runtime: "Deployed Infrastructure",
    };
    const title = run
      ? `Architecture Drift — ${layerNames[run.baseLayer]} vs ${layerNames[run.targetLayer]}`
      : `Architecture Drift — ${body.runId}`;
    const created: Report = {
      ...base,
      id: uid("rep"),
      runId: body.runId,
      format: body.format,
      status: "ready",
      title,
      createdAt: new Date().toISOString(),
    };
    mockStore.update((state) => state.reports.unshift(created));
    return HttpResponse.json(created, { status: 201 });
  }),

  // --- Copilot (grounded mock answer; streaming added in Phase 8) ---
  http.post(`${BASE}/copilot/threads/:id/messages`, async ({ request }) => {
    await latency(300, 600);
    const body = (await request.json()) as { content: string };
    const critical = mockStore
      .get()
      .records.filter((r) => r.severity === "critical");
    const citations = critical.map((r) => r.id);
    const message: CopilotMessage = {
      id: uid("msg"),
      role: "assistant",
      content:
        `Based on the latest drift run, there are ${critical.length} critical findings. ` +
        critical.map((r) => `• ${r.title} [${r.id}]`).join("  ") +
        ` These are grounded in the deterministic diff — see the cited records for base-vs-target detail. ` +
        `(You asked: "${body.content}")`,
      citations,
    };
    return HttpResponse.json(message);
  }),
];
