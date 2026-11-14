import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import type { AudioPlayer } from "../src/audio/player";
import { NarrationController, type NarrationState, type ReadingPosition } from "../src/narration/controller";
import { splitIntoChunks } from "../src/reader/chunks";
import type { LocalSpeechEngine } from "../src/speech/types";

const chunks = splitIntoChunks("doc", "Hello world. This is a test.");
const clip = (id: string) => ({ chunkId: id, localAudioUri: id, durationMs: 1600, modelId: "test", words: [] });

function fixture(engine: Pick<LocalSpeechEngine, "synthesize">, audio: AudioPlayer) {
  const states: NarrationState[] = [];
  const positions: ReadingPosition[] = [];
  const controller = new NarrationController(engine, audio, chunks, "Doc", { index: 0, positionMs: 0 },
    state => states.push(state), position => positions.push(position));
  return { controller, states, positions };
}

test("prefetches one passage, highlights from player events, resumes and advances in order", async () => {
  const requests: string[] = [];
  const played: [string, number][] = [];
  const { controller, states, positions } = fixture({
    async synthesize(chunk) {
      requests.push(chunk.id);
      return clip(chunk.id);
    },
  }, {
    async play(uri, _title, position, _signal, status) {
      equal(requests.length, 2);
      played.push([uri, position]);
      status({ playing: true, positionMs: position });
      status({ playing: false, positionMs: position + 200 });
    },
    pause() {},
    resume() {},
  });
  await controller.listen(0, 350);
  deepEqual(played, [[chunks[0].id, 350], [chunks[1].id, 0]]);
  deepEqual(states.filter(state => state.phase === "playing").map(state => state.highlightedIndex), [0, 1]);
  deepEqual(positions[0], { index: 0, positionMs: 350 });
  deepEqual(positions.at(-1), { index: 0, positionMs: 0 });
  equal(states.at(-1)?.phase, "finished");
});

test("a stopped synthesis can complete without starting stale playback", async () => {
  let finish!: () => void;
  let playCount = 0;
  const { controller, states } = fixture({
    async synthesize(chunk) {
      await new Promise<void>(resolve => { finish = resolve; });
      return clip(chunk.id);
    },
  }, {
    async play() { playCount++; },
    pause() {},
    resume() {},
  });
  const pending = controller.listen(0);
  controller.stop();
  finish();
  await pending;
  equal(playCount, 0);
  equal(states.at(-1)?.phase, "idle");
});

test("a look-ahead failure is surfaced only after the current passage finishes", async () => {
  const { controller, states } = fixture({
    async synthesize(chunk) {
      if (chunk === chunks[1]) throw new Error("Voice unavailable");
      return clip(chunk.id);
    },
  }, {
    async play(_uri, _title, _position, _signal, status) {
      status({ playing: true, positionMs: 100 });
    },
    pause() {},
    resume() {},
  });
  await controller.listen(0);
  equal(states.find(state => state.phase === "playing")?.highlightedIndex, 0);
  equal(states.at(-1)?.error, "Voice unavailable");
});

test("backgrounding and stopping save the native position for offline restart", async () => {
  let nativePosition = 720;
  const { controller, states, positions } = fixture({
    async synthesize(chunk) { return clip(chunk.id); },
  }, {
    async play(_uri, _title, _offset, signal, status) {
      status({ playing: false, positionMs: 350 });
      equal(states.at(-1)?.highlightedIndex, null);
      status({ playing: true, positionMs: 350 });
      status({ playing: false, buffering: true, positionMs: 420 });
      equal(states.at(-1)?.phase, "buffering");
      equal(states.at(-1)?.highlightedIndex, 0);
      status({ playing: false, positionMs: 480 });
      equal(states.at(-1)?.phase, "paused");
      controller.checkpoint();
      deepEqual(positions.at(-1), { index: 0, positionMs: 720 });
      nativePosition = 810;
      controller.stop();
      equal(signal.aborted, true);
      status({ playing: true, positionMs: 1200 });
    },
    positionMs: () => nativePosition,
    pause() {},
    resume() {},
  });
  await controller.listen(0, 350);
  deepEqual(positions.at(-1), { index: 0, positionMs: 810 });
  equal(states.at(-1)?.phase, "idle");
});

test("a long session keeps three passages ahead and plays every clip in order", async () => {
  const passages = splitIntoChunks("long", "The light stayed on. ".repeat(450));
  const requested: string[] = [];
  const played: string[] = [];
  const controller = new NarrationController({
    async synthesize(chunk) {
      requested.push(chunk.id);
      return { ...clip(chunk.id), durationMs: 4000 };
    },
  }, {
    async play(uri, _title, _position, _signal, status) {
      equal(requested.length, Math.min(passages.length, played.length + 4));
      played.push(uri);
      status({ playing: true, positionMs: 0 });
    },
    pause() {},
    resume() {},
  }, passages, "Long document", { index: 0, positionMs: 0 }, () => {}, () => {});
  await controller.listen(0);
  deepEqual(played, passages.map(passage => passage.id));
});
