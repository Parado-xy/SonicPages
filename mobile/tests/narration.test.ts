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
