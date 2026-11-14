import type { SpeechChunk } from "../speech/types";

export function sentenceAt(content: string, chunk: SpeechChunk) {
  let start = chunk.startChar;
  let end = chunk.endChar;
  while (start > 0 && !/[.!?\n]/.test(content[start - 1])) start--;
  if (!/[.!?\n]/.test(content[end - 1] ?? "")) {
    while (end < content.length && !/[.!?\n]/.test(content[end])) end++;
    while (end < content.length && /[.!?]/.test(content[end])) end++;
  }
  return { start, end };
}
