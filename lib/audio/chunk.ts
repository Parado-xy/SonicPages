import { createHash } from "node:crypto";

export type SpeechChunk = { text: string; startOffset: number; endOffset: number; textHash: string };

export function splitForSpeech(text: string, maximumCharacters = 3_500): SpeechChunk[] {
  if (maximumCharacters < 200) throw new Error("Speech chunks must allow at least 200 characters.");
  const chunks: SpeechChunk[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    while (/\s/.test(text[cursor] ?? "")) cursor += 1;
    if (cursor >= text.length) break;
    const hardEnd = Math.min(text.length, cursor + maximumCharacters);
    let end = hardEnd;
    if (hardEnd < text.length) {
      const window = text.slice(cursor, hardEnd);
      const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "), window.lastIndexOf("\n"));
      const wordEnd = window.lastIndexOf(" ");
      end = cursor + (sentenceEnd > maximumCharacters * 0.55 ? sentenceEnd + 1 : wordEnd > 0 ? wordEnd : maximumCharacters);
    }
    const value = text.slice(cursor, end).trim();
    if (value) chunks.push({ text: value, startOffset: cursor, endOffset: end, textHash: hashText(value) });
    cursor = Math.max(end, cursor + 1);
  }
  return chunks;
}

export function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

