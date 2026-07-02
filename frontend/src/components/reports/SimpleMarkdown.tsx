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
  let tableLines: string[] = [];
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

  const flushTable = () => {
    if (!tableLines.length) return;
    const rows = [...tableLines];
    tableLines = [];

    if (rows.length < 2) {
      return;
    }

    const parseCells = (row: string) =>
      row
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim().replace(/\\\|/g, '|'));

    const header = parseCells(rows[0]);
    const bodyRows = rows
      .slice(2)
      .map(parseCells)
      .filter((r) => r.length > 0);

    blocks.push(
      <div key={`tbl-${key++}`} className="my-2 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              {header.map((cell, idx) => (
                <th key={idx} className="px-2.5 py-2 font-medium uppercase tracking-wide">
                  {renderInline(cell, `th-${key}-${idx}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40 text-slate-300">
            {bodyRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {header.map((_, colIdx) => (
                  <td key={colIdx} className="align-top px-2.5 py-2">
                    {renderInline(row[colIdx] ?? '', `td-${key}-${rowIdx}-${colIdx}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    const tableLike = /^\|.*\|$/.test(trimmed);
    if (tableLike) {
      flushBullets();
      tableLines.push(trimmed);
    } else if (bullet) {
      flushTable();
      bullets.push(bullet[1]);
    } else {
      flushTable();
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
  flushTable();
  flushBullets();

  return <div className="text-sm leading-relaxed">{blocks}</div>;
}
