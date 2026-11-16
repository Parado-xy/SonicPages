import type { SpeechChunk } from "./types";

export function trimContinuationSilence(waveform: Float32Array, rate: number,
  { continuesSentence, sentenceContinues }: Pick<SpeechChunk, "continuesSentence" | "sentenceContinues">) {
  if (!continuesSentence && !sentenceContinues) return waveform;

  // Remove digital silence only, with a small margin for quiet consonants.
  // Bound the search so an unexpectedly quiet clip stays intact.
  const limit = Math.min(Math.floor(rate / 2), Math.floor(waveform.length / 3));
  const margin = Math.ceil(rate * 0.012);
  const silence = 2 / 32768;
  let start = 0;
  let end = waveform.length;
  if (continuesSentence) {
    while (start < limit && Math.abs(waveform[start]) <= silence) start++;
    start = start === limit ? 0 : Math.max(0, start - margin);
  }
  if (sentenceContinues) {
    while (end > waveform.length - limit && Math.abs(waveform[end - 1]) <= silence) end--;
    end = end === waveform.length - limit ? waveform.length : Math.min(waveform.length, end + margin);
  }
  return waveform.subarray(start, end);
}
