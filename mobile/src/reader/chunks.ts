import type { SpeechChunk } from "../speech/types";

/** Bound each inference request and preserve offsets into the exact imported text. */
export function splitIntoChunks(documentId: string, text: string, maxLength = 96): SpeechChunk[] {
  if (!Number.isInteger(maxLength) || maxLength < 32) throw new Error("maxLength must be an integer >= 32");
  const chunks: SpeechChunk[] = [];
  const sentences = text.matchAll(/[^.!?\n]+[.!?]*|[.!?]+|\n+/g);
  for (const sentence of sentences) {
    let start = sentence.index;
    const end = start + sentence[0].length;
    while (start < end) {
      let cut = Math.min(end, start + maxLength);
      if (cut < end) {
        const window = text.slice(start, cut);
        const boundary = window.search(/\s+\S*$/);
        if (boundary >= maxLength / 2) cut = start + boundary + 1;
        else if (/[\uDC00-\uDFFF]/.test(text[cut])) cut--;
      }
      const content = text.slice(start, cut);
      if (/[\p{L}\p{N}]/u.test(content)) chunks.push({
        id: documentId + ":" + start + "-" + cut,
        documentId, text: content, startChar: start, endChar: cut,
      });
      start = cut;
    }
  }
  return chunks;
}
