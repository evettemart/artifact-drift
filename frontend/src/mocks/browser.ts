import { setupWorker } from "msw/browser";
import { handlers } from "@/mocks/handlers";

export const worker = setupWorker(...handlers);

/** Starts MSW in the browser. No-op-safe to call once at boot. */
export async function startMockWorker() {
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: false,
  });
}
