/**
 * Minimal markdown renderer for report section bodies. Supports bold (**),
 * inline code (`), bullet lists (- / 1.) and paragraphs. Kept dependency-free.
 */
export function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: number) => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${key}`} className="ml-4 list-disc space-y-1">
          {list.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
    } else {
      flushList(i);
      if (trimmed) {
        blocks.push(
          <p key={`p-${i}`} className="leading-relaxed">
            {renderInline(trimmed)}
          </p>,
        );
      }
    }
  });
  flushList(lines.length);

  return <div className="space-y-2 text-sm text-fg-muted">{blocks}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold** and `code`, preserving the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-bg-panel px-1 py-0.5 font-mono text-xs text-fg"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
