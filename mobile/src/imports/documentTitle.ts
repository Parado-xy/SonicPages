export function displayTitle(filename: string, metadata?: string | null): string {
  const clean = (value: string) => value.replace(/\.(pdf|epub|txt)$/i, "")
    .replace(/[_\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  const fallback = clean(filename.split(/\s+--\s+/)[0]);
  const candidate = metadata ? clean(metadata) : "";
  const usable = candidate && candidate.length <= 120 &&
    !/^(untitled|unknown|document|microsoft word|adobe acrobat)(\b|$)/i.test(candidate) &&
    !/^(?:[\da-f]{16,}|\d+)$/i.test(candidate) && !candidate.includes(" -- ");
  const title = (usable ? candidate : fallback) || "Untitled document";
  return title.length > 100 ? title.slice(0, 97).replace(/\s+\S*$/, "") + "…" : title;
}
