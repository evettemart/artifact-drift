import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/layout/AppShell";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { MethodologyPage } from "@/features/methodology/MethodologyPage";
import { GraphPage } from "@/features/graph/GraphPage";
import { DriftPage } from "@/features/drift/DriftPage";
import { IntegrationsPage } from "@/features/integrations/IntegrationsPage";
import { ReportsPage } from "@/features/reports/ReportsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "methodology",
        element: <MethodologyPage />,
      },
      {
        path: "graph",
        element: <GraphPage />,
      },
      {
        path: "drift",
        element: <DriftPage />,
      },
      {
        path: "integrations",
        element: <IntegrationsPage />,
      },
      {
        path: "reports",
        element: <ReportsPage />,
      },
      {
        path: "copilot",
        element: (
          <PlaceholderPage
            title="AI Copilot"
            description="Grounded explanations and remediation proposals over detected drift. Built in Phase 8."
          />
        ),
      },
      {
        path: "*",
        element: (
          <PlaceholderPage
            title="Not Found"
            description="This route does not exist yet."
          />
        ),
      },
    ],
  },
]);
