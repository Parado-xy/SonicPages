import { equal } from "node:assert/strict";
import { test } from "node:test";
import { trimContinuationSilence } from "../src/speech/continuationAudio";

test("leaves sentence edges and quiet speech intact while trimming internal padding", () => {
  const audio = new Float32Array(1000);
  audio.fill(0.01, 100, 840);
  equal(trimContinuationSilence(audio, 1000, {}).length, 1000);
  const outgoing = trimContinuationSilence(audio, 1000, { sentenceContinues: true });
  equal(outgoing.length, 852);
  const incoming = trimContinuationSilence(audio, 1000, { continuesSentence: true });
  equal(incoming.length, 912);
  const middle = trimContinuationSilence(audio, 1000, { continuesSentence: true, sentenceContinues: true });
  equal(middle.length, 764);
  equal(middle[12], audio[100]);
});
