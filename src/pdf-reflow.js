/**
 * PDF text reflow prototype (single-column text PDFs).
 * This module is intentionally independent of Obsidian and the existing PDF
 * reader. Do not enable it until source-anchor and mobile tests are in place.
 *
 * PDF.js TextContent.items contain x/y coordinates in item.transform[4/5].
 * The output retains the source PDF page and original text-item indices.
 */

/** @typedef {{ text:string, page:number, itemIndices:number[], y:number }} ReflowLine */

export function extractReflowLines(textItems, pageNumber, options = {}) {
  const tolerance = options.lineTolerance ?? 3;
  const items = textItems.map((item, index) => ({
    text: String(item.str ?? ""),
    index,
    x: Number(item.transform?.[4] ?? 0),
    y: Number(item.transform?.[5] ?? 0),
    width: Number(item.width ?? 0),
    height: Number(item.height ?? 0),
    hasEOL: Boolean(item.hasEOL),
  })).filter(item => item.text.trim() || item.hasEOL);

  // Do not reorder interleaved columns silently: callers must validate layout.
  const grouped = [];
  for (const item of items) {
    const last = grouped[grouped.length - 1];
    if (last && !last.closed && Math.abs(last.y - item.y) <= tolerance) {
      const previous = last.items[last.items.length - 1];
      const gap = item.x - (previous.x + previous.width);
      const addSpace = gap > Math.max(1, item.height * 0.18);
      last.items.push(item);
      if (addSpace && !last.text.endsWith(" ")) last.text += " ";
      last.text += item.text;
    } else {
      grouped.push({ y: item.y, items: [item], text: item.text, closed: false });
    }
    if (item.hasEOL) grouped[grouped.length - 1].closed = true;
  }

  return grouped.filter(line => line.text.trim()).map(line => ({
    text: line.text.trim(),
    page: pageNumber,
    itemIndices: line.items.map(item => item.index),
    y: line.y,
  }));
}

/**
 * Conservative paragraph inference. Retains source line objects to support
 * future mapping of selections back to PDF coordinates.
 */
export function groupReflowParagraphs(lines, options = {}) {
  const paragraphGap = options.paragraphGap ?? 12;
  const paragraphs = [];
  for (const line of lines) {
    const previous = paragraphs[paragraphs.length - 1];
    const last = previous?.lines[previous.lines.length - 1];
    const samePage = last?.page === line.page;
    const gap = samePage ? Math.abs(last.y - line.y) : Infinity;
    if (!previous || !samePage || gap > paragraphGap) {
      paragraphs.push({ text: line.text, lines: [line] });
    } else {
      const joinWithoutSpace = /[-\u00ad]$/.test(previous.text);
      previous.text = joinWithoutSpace
        ? previous.text.replace(/[-\u00ad]$/, "") + line.text
        : previous.text + " " + line.text;
      previous.lines.push(line);
    }
  }
  return paragraphs;
}

/**
 * Use only as an initial heuristic; a production implementation must verify
 * reading order, columns, tables and text-to-source anchors.
 */
export function isPotentiallyReflowable(textItems) {
  const nonEmpty = textItems.filter(item => String(item.str ?? "").trim());
  if (nonEmpty.length < 5) return false;
  return nonEmpty.every(item =>
    Array.isArray(item.transform) &&
    Number.isFinite(Number(item.transform[4])) &&
    Number.isFinite(Number(item.transform[5]))
  );
}
