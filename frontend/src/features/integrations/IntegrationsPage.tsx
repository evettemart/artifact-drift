import { useState } from "react";
import { Plus, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/Spinner";
import { useIntegrations } from "@/hooks/useIntegrations";
import { IntegrationCard } from "@/features/integrations/IntegrationCard";
import { AddIntegrationDialog } from "@/features/integrations/AddIntegrationDialog";

export function IntegrationsPage() {
  const { data, isLoading, error } = useIntegrations();
  const [adding, setAdding] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title="Integrations"
        description="Connect architecture intent, Terraform state, and AWS runtime sources."
        actions={
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" />
            Add integration
          </button>
        }
      />

      <div className="mt-6">
        {isLoading && <Spinner label="Loading integrations…" />}
        {error && (
          <div className="flex items-center gap-2 text-sm text-severity-critical">
            <AlertCircle className="h-4 w-4" /> Failed to load integrations.
          </div>
        )}
        {data && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        )}
      </div>

      {adding && <AddIntegrationDialog onClose={() => setAdding(false)} />}
    </div>
  );
}
