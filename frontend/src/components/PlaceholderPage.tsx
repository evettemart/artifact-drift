import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-xl font-semibold text-fg">{title}</h1>
      <p className="mt-1 text-sm text-fg-muted">{description}</p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg-subtle/50 px-6 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-panel text-fg-subtle">
          <Construction className="h-6 w-6" />
        </div>
        <div className="text-sm font-medium text-fg">Coming in a later phase</div>
        <div className="max-w-md text-xs text-fg-subtle">
          The shell, navigation, and layout are live. This view is wired into the
          router and ready to receive its feature implementation.
        </div>
      </div>
    </div>
  );
}
