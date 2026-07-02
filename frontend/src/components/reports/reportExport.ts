import type { jsPDF } from 'jspdf';
import type { GraphImage, Report } from './types';
import { logoSvgMarkup } from '../../lib/logo';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Convert a limited markdown subset (bold, inline code, bullet lists) to HTML. */
function mdToHtml(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inList = false;
  let inTable = false;
  let tableRowIndex = 0;

  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (const line of lines) {
    const trimmed = line.trim();
    const tableLike = /^\|.*\|$/.test(trimmed);

    if (tableLike) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      if (!inTable) {
        out.push('<div class="table-wrap"><table><thead>');
        inTable = true;
        tableRowIndex = 0;
      }

      const cells = trimmed
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => inline(cell.trim().replace(/\\\|/g, '|')));

      const isSeparator = cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/<[^>]+>/g, '')));
      if (isSeparator) {
        out.push('</thead><tbody>');
        continue;
      }

      if (tableRowIndex === 0) {
        out.push(`<tr>${cells.map((cell) => `<th>${cell}</th>`).join('')}</tr>`);
      } else {
        out.push(`<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`);
      }
      tableRowIndex += 1;
      continue;
    }

    if (inTable) {
      out.push('</tbody></table></div>');
      inTable = false;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      if (trimmed) out.push(`<p>${inline(trimmed)}</p>`);
    }
  }
  if (inTable) out.push('</tbody></table></div>');
  if (inList) out.push('</ul>');
  return out.join('\n');
}

/** Build a standalone, self-styled HTML document for a report. */
export function reportToHtml(report: Report): string {
  const sections = report.sections
    .map((s) => {
      const evidence = s.citations.length
        ? `<p class="evidence">Evidence: ${s.citations
            .map((c) => `<code>${escapeHtml(c)}</code>`)
            .join(' ')}</p>`
        : '';
      const image = s.image
        ? `<div class="graph">${s.image.svg}</div>\n`
        : '';
      return `<section>\n<h2>${escapeHtml(s.title)}</h2>\n${image}${mdToHtml(s.body)}\n${evidence}\n</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(report.title)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    max-width: 820px; margin: 40px auto; padding: 0 24px; color: #1a2330; line-height: 1.55; }
  header { border: 1px solid #dbeafe; background: linear-gradient(140deg, #eff6ff 0%, #f8fafc 58%, #eef2ff 100%);
    border-radius: 12px; padding: 16px 18px; margin-bottom: 24px; }
  .brand { display: flex; align-items: center; gap: 9px; }
  .brand svg { display: block; }
  .brand-name { font-size: 13px; font-weight: 700; color: #1d4ed8; letter-spacing: .03em; text-transform: uppercase; }
  h1 { font-size: 24px; margin: 10px 0 4px; color: #0f172a; }
  .subtitle { color: #475569; font-size: 13px; margin: 0 0 10px; }
  .meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .meta-chip { background: rgba(255,255,255,0.7); border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; }
  .meta-label { display: block; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  .meta-value { display: block; color: #0f172a; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .04em; color: #334155; margin-top: 28px; }
  code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
  .evidence { font-size: 12px; color: #64748b; margin-top: 8px; }
  ul { padding-left: 20px; }
  .table-wrap { margin: 10px 0 14px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; text-align: left; }
  th { background: #f8fafc; color: #334155; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
  .graph { margin: 12px 0 18px; }
  .graph svg { display: block; width: 100%; max-width: 100%; max-height: 380px; height: auto;
    border: 1px solid #e2e8f0; border-radius: 8px; }
  footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
<header>
  <div class="brand">${logoSvgMarkup(28)}<span class="brand-name">Drifters</span></div>
  <h1>${escapeHtml(report.title)}</h1>
  <p class="subtitle">Architecture drift assessment summary and evidence.</p>
  <div class="meta-grid">
    <div class="meta-chip"><span class="meta-label">Report ID</span><span class="meta-value">${escapeHtml(report.id)}</span></div>
    <div class="meta-chip"><span class="meta-label">Format</span><span class="meta-value">${escapeHtml(report.format.toUpperCase())}</span></div>
    <div class="meta-chip"><span class="meta-label">Project</span><span class="meta-value">${escapeHtml(report.projectName)}</span></div>
    <div class="meta-chip"><span class="meta-label">Scan</span><span class="meta-value">${escapeHtml(report.scanId)}</span></div>
    <div class="meta-chip"><span class="meta-label">Run Timestamp</span><span class="meta-value">${new Date(report.scanRunAt).toLocaleString()}</span></div>
    <div class="meta-chip"><span class="meta-label">Generated</span><span class="meta-value">${new Date(report.createdAt).toLocaleString()}</span></div>
  </div>
</header>
${sections}
<footer>Generated by Drifters · ${new Date(report.createdAt).toLocaleString()}</footer>
</body>
</html>`;
}

interface MarkdownTableBlock {
  header: string[];
  rows: string[][];
}

type MarkdownBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; text: string }
  | { type: 'table'; table: MarkdownTableBlock };

function parseMarkdownTable(lines: string[]): MarkdownTableBlock | null {
  if (lines.length < 2) return null;

  const parseCells = (row: string) =>
    row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) =>
        cell
          .trim()
          .replace(/\\\|/g, '|')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/`([^`]+)`/g, '$1'),
      );

  const header = parseCells(lines[0]);
  const separator = parseCells(lines[1]);
  const hasSeparator = separator.every((cell) => /^:?-{3,}:?$/.test(cell));
  const dataStart = hasSeparator ? 2 : 1;
  const rows = lines.slice(dataStart).map(parseCells).filter((row) => row.length > 0);

  if (header.length === 0) return null;
  return { header, rows };
}

function mdToBlocks(text: string): MarkdownBlock[] {
  const lines = text.split('\n');
  const blocks: MarkdownBlock[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    if (/^\|.*\|$/.test(trimmed)) {
      const tableLines: string[] = [trimmed];
      let j = i + 1;
      while (j < lines.length && /^\|.*\|$/.test(lines[j].trim())) {
        tableLines.push(lines[j].trim());
        j += 1;
      }

      const table = parseMarkdownTable(tableLines);
      if (table) blocks.push({ type: 'table', table });
      i = j - 1;
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      blocks.push({
        type: 'list',
        text: bullet[1].replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1'),
      });
      continue;
    }

    blocks.push({
      type: 'paragraph',
      text: trimmed.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1'),
    });
  }

  return blocks;
}

function preferredColumnWidths(count: number, totalWidth: number): number[] {
  if (count === 3) {
    return [0.36, 0.2, 0.44].map((ratio) => ratio * totalWidth);
  }
  if (count === 7) {
    return [0.12, 0.1, 0.15, 0.22, 0.16, 0.12, 0.13].map((ratio) => ratio * totalWidth);
  }
  return Array.from({ length: count }, () => totalWidth / count);
}

/** Build a real PDF document for a report using jsPDF. */
export function reportToPdf(
  doc: jsPDF,
  report: Report,
  images?: Map<string, RasterImage>,
): jsPDF {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawTable = (table: MarkdownTableBlock) => {
    const colCount = Math.max(
      table.header.length,
      ...table.rows.map((row) => row.length),
      1,
    );
    const normalizeRow = (row: string[]) =>
      Array.from({ length: colCount }, (_, idx) => row[idx] ?? '');
    const header = normalizeRow(table.header);
    const rows = table.rows.map(normalizeRow);
    const colWidths = preferredColumnWidths(colCount, maxW);
    const lineHeight = 9;
    const padX = 4;

    const drawRow = (row: string[], isHeader: boolean) => {
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(isHeader ? 8.5 : 8);

      const cellLines = row.map((cell, idx) =>
        doc.splitTextToSize(cell, Math.max(20, colWidths[idx] - padX * 2)),
      );
      const rowHeight = Math.max(...cellLines.map((lines) => lines.length), 1) * lineHeight + 8;

      if (!isHeader && y + rowHeight > pageH - margin) {
        doc.addPage();
        y = margin;
        drawRow(header, true);
      }
      ensureSpace(rowHeight);

      doc.setDrawColor(203, 213, 225);
      if (isHeader) {
        doc.setFillColor(241, 245, 249);
      }

      let x = margin;
      row.forEach((_, idx) => {
        doc.rect(x, y, colWidths[idx], rowHeight, isHeader ? 'FD' : 'S');
        x += colWidths[idx];
      });

      x = margin;
      cellLines.forEach((lines: string[], idx: number) => {
        doc.setTextColor(30, 41, 59);
        lines.forEach((line: string, lineIdx: number) => {
          doc.text(String(line), x + padX, y + 11 + lineIdx * lineHeight);
        });
        x += colWidths[idx];
      });

      y += rowHeight;
    };

    drawRow(header, true);
    for (const row of rows) {
      drawRow(row, false);
    }
    y += 10;
  };

  const titleLines = doc.splitTextToSize(report.title, maxW);

  // Brand/header block with dynamic height so metadata chips never overlap it.
  const badge = 15;
  const headerTop = margin - 18;
  const headerInnerTop = margin;
  const headerBottomPad = 16;
  const titleStartY = headerInnerTop + 30;
  const titleEndY = titleStartY + Math.max(1, titleLines.length) * 20;
  const headerH = titleEndY - headerTop + headerBottomPad;

  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(margin - 10, headerTop, maxW + 20, headerH, 10, 10, 'FD');

  const badgeY = headerInnerTop - 11;
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(margin, badgeY, badge, badge, 3, 3, 'F');
  doc.setFillColor(147, 197, 253);
  doc.roundedRect(margin + 3, badgeY + 3.5, 6.5, 6.5, 1.5, 1.5, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + 5.5, badgeY + 6, 6.5, 6.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(37, 99, 235);
  doc.text('Drifters', margin + badge + 7, headerInnerTop);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Architecture Drift Assessment', margin + badge + 7, headerInnerTop + 11);

  // Title.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(26, 35, 48);
  y = titleStartY;
  for (const line of titleLines) {
    ensureSpace(24);
    doc.text(line, margin, y);
    y += 20;
  }

  // Start metadata chips below the header block to avoid overlap.
  y = headerTop + headerH + 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  const metaPairs = [
    ['Report ID', report.id],
    ['Format', report.format.toUpperCase()],
    ['Project', report.projectName],
    ['Scan', report.scanId],
    ['Run Time', new Date(report.scanRunAt).toLocaleString()],
    ['Generated', new Date(report.createdAt).toLocaleString()],
  ] as const;

  const chipCols = 3;
  const chipGap = 10;
  const chipW = (maxW - chipGap * (chipCols - 1)) / chipCols;
  const chipH = 30;
  metaPairs.forEach(([label, value], idx) => {
    const row = Math.floor(idx / chipCols);
    const col = idx % chipCols;
    const chipX = margin + col * (chipW + chipGap);
    const chipY = y + row * (chipH + 7);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(chipX, chipY, chipW, chipH, 5, 5, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), chipX + 6, chipY + 8.5);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const trimmed = doc.splitTextToSize(String(value), chipW - 12)[0] ?? '';
    doc.text(trimmed, chipX + 6, chipY + 21.5);
  });

  y += Math.ceil(metaPairs.length / chipCols) * (chipH + 7) + 3;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 22;

  for (const section of report.sections) {
    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85);
    doc.text(section.title.toUpperCase(), margin, y);
    y += 18;

    const img = images?.get(section.id);
    if (img) {
      // Give each graph a dedicated A4-style page so the diagram is readable
      // when printed.
      doc.addPage();
      y = margin;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(51, 65, 85);
      doc.text(`${section.title.toUpperCase()} — DIAGRAM`, margin, y);
      y += 16;

      const footerReserve = 28;
      const imageAvailH = pageH - margin - y - footerReserve;
      let drawW = maxW;
      let drawH = (img.height / img.width) * drawW;
      if (drawH > imageAvailH) {
        drawH = imageAvailH;
        drawW = (img.width / img.height) * drawH;
      }
      if (drawW > maxW) {
        drawW = maxW;
        drawH = (img.height / img.width) * drawW;
      }
      const drawX = margin + (maxW - drawW) / 2;
      doc.addImage(img.data, 'PNG', drawX, y, drawW, drawH);

      // Continue section details on a fresh page after the full-page diagram.
      doc.addPage();
      y = margin;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(51, 65, 85);
      doc.text(`${section.title.toUpperCase()} — DETAILS`, margin, y);
      y += 18;
    }

    doc.setTextColor(26, 35, 48);
    for (const block of mdToBlocks(section.body)) {
      if (block.type === 'table') {
        drawTable(block.table);
        continue;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      const prefix = block.type === 'list' ? '\u2022 ' : '';
      for (const line of doc.splitTextToSize(`${prefix}${block.text}`, maxW)) {
        ensureSpace(14);
        doc.text(line, margin, y);
        y += 13;
      }
      y += 2;
    }

    if (section.citations.length) {
      ensureSpace(16);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const ev = `Evidence: ${section.citations.join(', ')}`;
      for (const line of doc.splitTextToSize(ev, maxW)) {
        ensureSpace(13);
        doc.text(line, margin, y);
        y += 13;
      }
    }
    y += 14;
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Drifters \u00b7 ${report.scanId} \u00b7 page ${p} of ${pageCount}`,
      margin,
      pageH - 24,
    );
  }

  return doc;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeName(report: Report): string {
  return report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Download a report in its native format. HTML and JSON download as files
 * directly; PDF generates a true PDF via lazily-loaded jsPDF.
 */
export async function downloadReport(report: Report) {
  const name = safeName(report);

  if (report.format === 'json') {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${name}.json`);
    return;
  }

  if (report.format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const images = await rasterizeSectionImages(report);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    reportToPdf(doc, report, images).save(`${name}.pdf`);
    return;
  }

  const html = reportToHtml(report);
  triggerDownload(new Blob([html], { type: 'text/html' }), `${name}.html`);
}

interface RasterImage {
  data: string;
  width: number;
  height: number;
}

/** Rasterize each section's graph SVG to a PNG data URL for PDF embedding. */
async function rasterizeSectionImages(report: Report): Promise<Map<string, RasterImage>> {
  const map = new Map<string, RasterImage>();
  for (const section of report.sections) {
    if (!section.image) continue;
    try {
      map.set(section.id, await svgToPng(section.image));
    } catch {
      // If rasterization fails, the section simply renders without its image.
    }
  }
  return map;
}

/** Convert a self-contained SVG to a PNG data URL via an offscreen canvas. */
function svgToPng(image: GraphImage): Promise<RasterImage> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([image.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = 2; // render at 2x for crisp output
        const sourceW = Math.max(1, img.naturalWidth || image.width || 1);
        const sourceH = Math.max(1, img.naturalHeight || image.height || 1);
        const canvas = document.createElement('canvas');
        canvas.width = sourceW * scale;
        canvas.height = sourceH * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, sourceW, sourceH);
        resolve({ data: canvas.toDataURL('image/png'), width: sourceW, height: sourceH });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to rasterize SVG'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG for rasterization'));
    };
    img.src = url;
  });
}
