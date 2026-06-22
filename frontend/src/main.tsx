import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import "@/index.css";

async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMockWorker } = await import("@/mocks/browser");
    await startMockWorker();
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
