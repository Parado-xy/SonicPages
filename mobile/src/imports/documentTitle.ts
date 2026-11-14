export function displayTitle(filename: string, metadata?: string | null): string {
  const clean = (value: string) => value.replace(/\.(pdf|epub|txt)$/i, "")
    .replace(/[_\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  const fallback = clean(filename.split(/\s+--\s+/)[0])
    .replace(/\[(?:[^\]]*)\]|\((?:copy|final|v\d+|\d+|[^)]*archive[^)]*)\)/gi, " ")
    .replace(/\b(?:scan[- ]*)?20\d{2}[-.]\d{2}[-.]\d{2}\b/gi, " ")
    .replace(/(?:\s+|^)(?:v\d+|final|copy)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ").trim();
  const candidate = metadata ? clean(metadata) : "";
  const usable = candidate && candidate.length <= 120 &&
    !/^(untitled|unknown|document|microsoft word|adobe acrobat)(\b|$)/i.test(candidate) &&
    !/^(?:[\da-f]{16,}|\d+)$/i.test(candidate) && !candidate.includes(" -- ");
  const title = (usable ? candidate : fallback) || "Untitled document";
  return title.length > 100 ? title.slice(0, 97).replace(/\s+\S*$/, "") + "…" : title;
}
