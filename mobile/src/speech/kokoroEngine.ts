import type { InferenceSession } from "onnxruntime-react-native";
import { cachedAudio, deleteGeneratedAudio, installAsset, installedAsset, saveAudio } from "../storage/audioFiles";
import { openKokoro, runKokoro, SAMPLE_RATE } from "../vendor/kokoro/kokoroOnnx";
import { MODEL, VOICE } from "../vendor/kokoro/models";
import { kokoroTokens } from "./phonemize";
import type { LocalSpeechEngine, SpeechChunk } from "./types";

export function cachedPassageAudio(chunk: SpeechChunk) {
  return cachedAudio(audioKey(chunk), SAMPLE_RATE);
}

function audioKey(chunk: SpeechChunk) {
  return [MODEL.id, VOICE.id, "cmu1", chunk.documentId, chunk.startChar, chunk.endChar].join("_");
}

class KokoroEngine implements LocalSpeechEngine {
  private session?: InferenceSession;
  private voice?: Float32Array;
  private setup?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();

  hasOfflineVoice() {
    return !!installedAsset(MODEL.filename, MODEL.bytes) && !!installedAsset(VOICE.filename, VOICE.bytes);
  }

  prepare(onStatus: (message: string) => void, offlineOnly = false) {
    if (this.session) return Promise.resolve();
    return this.setup ??= this.install(onStatus, offlineOnly).finally(() => { this.setup = undefined; });
  }

  private async install(onStatus: (message: string) => void, offlineOnly: boolean) {
    const localModel = installedAsset(MODEL.filename, MODEL.bytes);
    const localVoice = installedAsset(VOICE.filename, VOICE.bytes);
    if (offlineOnly && (!localModel || !localVoice)) throw new Error("Offline voice files are missing");
    const model = localModel ?? await installAsset(MODEL.filename, MODEL.url, MODEL.bytes,
      progress => onStatus("Downloading speech model " + Math.round(progress * 100) + "%"));
    const voice = localVoice ?? await installAsset(VOICE.filename, VOICE.url, VOICE.bytes,
      progress => onStatus("Downloading voice " + Math.round(progress * 100) + "%"));
    this.voice = new Float32Array(await voice.arrayBuffer());
    onStatus("Loading Kokoro…");
    this.session = await openKokoro(model.uri);
  }

  clearGeneratedAudio() {
    const next = this.queue.then(deleteGeneratedAudio);
    this.queue = next.catch(() => undefined);
    return next;
  }

  synthesize(chunk: SpeechChunk, signal: AbortSignal) {
    const next = this.queue.then(async () => {
      if (signal.aborted) throw new Error("Narration stopped");
      const key = audioKey(chunk);
      const cached = cachedAudio(key, SAMPLE_RATE);
      if (cached) return { ...cached, chunkId: chunk.id, modelId: MODEL.id, words: [] };
      if (!this.session || !this.voice) throw new Error("Prepare Kokoro before listening");
      const waveform = await runKokoro(this.session, kokoroTokens(chunk.text), this.voice);
      if (signal.aborted) throw new Error("Narration stopped");
      const saved = saveAudio(key, waveform, SAMPLE_RATE);
      return { ...saved, chunkId: chunk.id, modelId: MODEL.id, words: [] };
    });
    this.queue = next.catch(() => undefined);
    return next;
  }
}

export const kokoroEngine = new KokoroEngine();
