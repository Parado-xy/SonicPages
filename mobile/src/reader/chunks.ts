import type { SpeechChunk } from "../speech/types";

/** Stable character offsets allow highlight mapping back into the source text. */
export function splitIntoChunks(documentId: string, text: string, maxLength = 320): SpeechChunk[] {
  if (maxLength < 32) throw new Error("maxLength must be >= 32");
  const chunks: SpeechChunk[] = [];
  const re = /[^.!?\n]+(?:[.!?]+|\n|$)/g;
  let match: RegExpExecArray | null;
  let start = -1;
  let end = -1;
  const emit = () => {
    if (start < 0 || end <= start) return;
    const content = text.slice(start, end);
    if (content.trim()) chunks.push({ id: documentId + ":" + start + "-" + end, documentId, text: content, startChar: start, endChar: end });
    start = -1;
    end = -1;
  };
  while ((match = re.exec(text))) {
    const sentenceStart = match.index;
    const sentenceEnd = sentenceStart + match[0].length;
    if (start < 0) start = sentenceStart;
    if (sentenceEnd - start > maxLength && end > start) { emit(); start = sentenceStart; }
    if (sentenceEnd - start > maxLength) {
      let cursor = sentenceStart;
      while (sentenceEnd - cursor > maxLength) {
        const proposed = cursor + maxLength;
        const boundary = text.lastIndexOf(" ", proposed);
        const cut = boundary > cursor + maxLength / 2 ? boundary + 1 : proposed;
        chunks.push({ id: documentId + ":" + cursor + "-" + cut, documentId, text: text.slice(cursor, cut), startChar: cursor, endChar: cut });
        cursor = cut;
      }
      start = cursor;
    }
    end = sentenceEnd;
  }
  emit();
  return chunks;
}
