import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";
import { encodeWav, wavDurationMs } from "../src/audio/wav";
import { splitIntoChunks } from "../src/reader/chunks";
import { kokoroTokens, phonemize } from "../src/speech/phonemize";
import { assertPlayableWaveform, inspectWaveform } from "../src/speech/waveformDiagnostics";

test("American English uses Kokoro 1.0 token IDs and BOS/EOS", () => {
  equal(phonemize("Hello world."), "həlˈoʊ wˈɜɹld.");
  deepEqual(kokoroTokens("Hello world."), [0, 50, 83, 54, 156, 57, 135, 16, 65, 156, 87, 123, 54, 46, 4, 0]);
  ok(kokoroTokens("123").length > 3);
  throws(() => kokoroTokens("こんにちは"), /supported English/);
  throws(() => kokoroTokens("hello ".repeat(100)), /510-token/);
});

test("bounded chunks cover the entire sentence with stable source offsets", () => {
  const text = "Hello world! " + "one two three ".repeat(30) + "end.\nNext sentence.";
  const chunks = splitIntoChunks("doc", text, 32);
  ok(chunks.every(chunk => chunk.text.length <= 32));
  for (const chunk of chunks) equal(chunk.text, text.slice(chunk.startChar, chunk.endChar));
  equal(chunks.map(chunk => chunk.text).join(""), text.replace("\n", ""));
  equal(splitIntoChunks("doc", " \n !?.").length, 0);
});

test("24 kHz PCM WAV has correct sample data and cache length validation", () => {
  const samples = new Float32Array(24_000);
  samples.set([-1, 0.5, 1]);
  const bytes = encodeWav(samples, 24_000);
  equal(wavDurationMs(bytes.slice(0, 44), bytes.length, 24_000), 1000);
  equal(wavDurationMs(bytes.slice(0, 44), bytes.length - 1, 24_000), null);
  equal(wavDurationMs(bytes.slice(0, 44), bytes.length, 48_000), null);
  const view = new DataView(bytes.buffer);
  equal(view.getInt16(44, true), -32768);
  equal(view.getInt16(46, true), 16384);
  equal(view.getInt16(48, true), 32767);
});

test("silent, non-finite and anomalously long audio cannot enter the playback queue", () => {
  throws(() => assertPlayableWaveform(inspectWaveform(new Float32Array(24_000))), /silent/);
  throws(() => assertPlayableWaveform(inspectWaveform([NaN])), /Invalid/);
  throws(() => assertPlayableWaveform(inspectWaveform(new Float32Array(24_000 * 31).fill(0.1))), /long/);
  assertPlayableWaveform(inspectWaveform([0, 0.25, -0.25]));
});
