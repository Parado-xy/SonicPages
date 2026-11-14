export type PdfRect = { x: number; y: number; width: number; height: number };
export type TextRange = { start: number; end: number };
export type PdfTextGeometry = { text: string; spans: (PdfRect & TextRange)[] };

export function normalizePdfPage(text: string, retainOffsets = true) {
  // Retain raw UTF-16 offsets through the same whitespace cleanup used on import.
  const offsets: number[] = [];
  const paragraphs: string[] = [];
  let start = 0;
  for (const delimiter of [...text.matchAll(/(?:\r\n|\r(?!\n)|(?<!\r)\n)\s*(?:\r\n|\r(?!\n)|(?<!\r)\n)/g), { index: text.length, 0: "" }]) {
    const end = delimiter.index;
    const tokens = [...text.slice(start, end).matchAll(/\S+/g)];
    if (tokens.length) {
      if (retainOffsets && paragraphs.length) offsets.push(start, start);
      const words: string[] = [];
      for (const token of tokens) {
        const offset = start + token.index;
        if (retainOffsets && words.length) offsets.push(offset - 1);
        words.push(token[0]);
        if (retainOffsets) for (let i = 0; i < token[0].length; i++) offsets.push(offset + i);
      }
      paragraphs.push(words.join(" "));
    }
    start = end + delimiter[0].length;
  }
  return { text: paragraphs.join("\n\n"), offsets };
}

export function locatePdfRange(spans: PdfTextGeometry["spans"], normalized: ReturnType<typeof normalizePdfPage>, expectedPage: string, range: TextRange): PdfRect[] {
  if (normalized.text !== expectedPage || range.end <= range.start) return [];
  const start = normalized.offsets[range.start];
  const end = normalized.offsets[range.end - 1];
  if (start === undefined || end === undefined) return [];
  const lines: PdfRect[] = [];
  for (const span of spans) {
    if (span.end <= start || span.start > end) continue;
    const previous = lines.at(-1);
    const gap = previous && span.x - previous.x - previous.width;
    if (previous && gap !== undefined && gap >= -0.01 && gap < 0.025
      && Math.abs(previous.y - span.y) < Math.min(previous.height, span.height) / 2) {
      const right = Math.max(previous.x + previous.width, span.x + span.width);
      const bottom = Math.max(previous.y + previous.height, span.y + span.height);
      previous.y = Math.min(previous.y, span.y);
      previous.width = right - previous.x;
      previous.height = bottom - previous.y;
    } else {
      lines.push({ x: span.x, y: span.y, width: span.width, height: span.height });
    }
  }
  return lines;
}
