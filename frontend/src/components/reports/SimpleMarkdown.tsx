import { Fragment } from 'react';

/** Render limited inline markdown: **bold** and `code`. */
function renderInline(text: string, keyBase: string) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={`${keyBase}-t${i}`}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    if (match[2] !== undefined) {
      parts.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-slate-100">
          {match[2]}
        </strong>,
      );
    } else if (match[3] !== undefined) {
      parts.push(
        <code
          key={`${keyBase}-c${i}`}
          className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[12px] text-sky-300"
        >
          {match[3]}
        </code>,
      );
    }
    lastIndex = regex.lastIndex;
    i += 1;
  }
  if (lastIndex < text.length) {
    parts.push(<Fragment key={`${keyBase}-tend`}>{text.slice(lastIndex)}</Fragment>);
  }
  return parts;
}

/** Render a limited markdown subset: **bold**, `code`, and "- " bullet lists. */
export function SimpleMarkdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let bullets: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length) {
      const items = [...bullets];
      blocks.push(
        <ul key={`ul-${key++}`} className="my-1 list-disc space-y-0.5 pl-5 text-slate-300">
          {items.map((b, idx) => (
            <li key={idx}>{renderInline(b, `ul${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
    } else {
      flushBullets();
      if (trimmed) {
        blocks.push(
          <p key={`p-${key++}`} className="my-1 text-slate-300">
            {renderInline(trimmed, `p${key}`)}
          </p>,
        );
      }
    }
  }
  flushBullets();

  return <div className="text-sm leading-relaxed">{blocks}</div>;
}
