import type { InferenceSession } from "onnxruntime-react-native";
import { cachedAudio, installAsset, saveAudio } from "../storage/audioFiles";
import { openKokoro, runKokoro, SAMPLE_RATE } from "../vendor/kokoro/kokoroOnnx";
import { MODEL, VOICE } from "../vendor/kokoro/models";
import { kokoroTokens } from "./phonemize";
import type { LocalSpeechEngine, SpeechChunk } from "./types";

class KokoroEngine implements LocalSpeechEngine {
  private session?: InferenceSession;
  private voice?: Float32Array;
  private setup?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();

  prepare(onStatus: (message: string) => void) {
    if (this.session) return Promise.resolve();
    return this.setup ??= this.install(onStatus).finally(() => { this.setup = undefined; });
  }

  private async install(onStatus: (message: string) => void) {
    const model = await installAsset(MODEL.filename, MODEL.url, MODEL.bytes,
      progress => onStatus("Downloading Kokoro " + Math.round(progress * 100) + "%"));
    onStatus("Preparing Kokoro voice…");
    const voice = await installAsset(VOICE.filename, VOICE.url, VOICE.bytes);
    this.voice = new Float32Array(await voice.arrayBuffer());
    onStatus("Loading Kokoro…");
    this.session = await openKokoro(model.uri);
  }

  synthesize(chunk: SpeechChunk, signal: AbortSignal) {
    const next = this.queue.then(async () => {
      if (signal.aborted) throw new Error("Narration stopped");
      const key = [MODEL.id, VOICE.id, "cmu1", chunk.documentId, chunk.startChar, chunk.endChar].join("_");
      const cached = cachedAudio(key, SAMPLE_RATE);
      if (cached) return { ...cached, chunkId: chunk.id, modelId: MODEL.id, words: [] };
      if (!this.session || !this.voice) throw new Error("Prepare Kokoro before listening");
      const waveform = await runKokoro(this.session, kokoroTokens(chunk.text), this.voice);
      const saved = saveAudio(key, waveform, SAMPLE_RATE);
      return { ...saved, chunkId: chunk.id, modelId: MODEL.id, words: [] };
    });
    this.queue = next.catch(() => undefined);
    return next;
  }
}

export const kokoroEngine = new KokoroEngine();
