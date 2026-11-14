import { splitIntoChunks } from "./chunks";

export function documentChunks(id: string, content: string, pages?: number[]) {
  if (!pages?.length) return splitIntoChunks(id, content);
  return pages.flatMap((start, pageIndex) =>
    splitIntoChunks(id, content.slice(start, pages[pageIndex + 1])).map(chunk => {
      const startChar = chunk.startChar + start;
      const endChar = chunk.endChar + start;
      return { ...chunk, startChar, endChar, pageIndex, id: id + ":" + startChar + "-" + endChar };
    }),
  );
}
