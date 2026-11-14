import { File } from "expo-file-system";
import { decodeDeviceWav } from "../audio/wav";
import { readerMedia } from "../storage/thumbnails";
import type { InferenceSession } from "onnxruntime-react-native";
import { cachedAudio, deleteGeneratedAudio, installAsset, installedAsset, saveAudio } from "../storage/audioFiles";
import { openKokoro, runKokoro, SAMPLE_RATE } from "../vendor/kokoro/kokoroOnnx";
import { MODEL, NARRATORS, VOICE } from "../vendor/kokoro/models";
import { kokoroTokens } from "./phonemize";
import type { LocalSpeechEngine, SpeechChunk } from "./types";

export function cachedPassageAudio(chunk: SpeechChunk, narrator: string = VOICE.id) {
  return cachedAudio(audioKey(chunk, narrator), SAMPLE_RATE);
}

function audioKey(chunk: SpeechChunk, narrator: string) {
  return [MODEL.id, encodeURIComponent(narrator), "cmu1", chunk.documentId, chunk.startChar, chunk.endChar].join("_");
}

class KokoroEngine implements LocalSpeechEngine {
  private session?: InferenceSession;
  private voices = new Map<string, Float32Array>();
  narrator: string = VOICE.id;
  private setup?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();

  hasOfflineVoice(id = this.narrator) {
    const voice = NARRATORS.find(item => item.id === id);
    return !!voice && !!installedAsset(MODEL.filename, MODEL.bytes) && !!installedAsset(voice.filename, voice.bytes);
  }

  async prepare(onStatus: (message: string) => void, offlineOnly = false, id = this.narrator) {
    if (id.startsWith("device:")) return;
    if (this.setup) await this.setup;
    if (this.session && this.voices.has(id)) return;
    this.setup = this.install(onStatus, offlineOnly, id);
    try { await this.setup; } finally { this.setup = undefined; }
  }

  private async install(onStatus: (message: string) => void, offlineOnly: boolean, id: string) {
    const asset = NARRATORS.find(item => item.id === id);
    if (!asset) throw new Error("Unknown narration voice.");
    const localModel = installedAsset(MODEL.filename, MODEL.bytes);
    const localVoice = installedAsset(asset.filename, asset.bytes);
    if (offlineOnly && (!localModel || !localVoice)) throw new Error("Offline voice files are missing");
    const model = localModel ?? await installAsset(MODEL.filename, MODEL.url, MODEL.bytes,
      progress => onStatus("Downloading speech model " + Math.round(progress * 100) + "%"));
    const voice = localVoice ?? await installAsset(asset.filename, asset.url, asset.bytes,
      progress => onStatus("Downloading voice " + Math.round(progress * 100) + "%"));
    this.voices.set(id, new Float32Array(await voice.arrayBuffer()));
    onStatus("Loading Kokoro…");
    this.session ??= await openKokoro(model.uri);
  }

  clearGeneratedAudio() {
    const next = this.queue.then(deleteGeneratedAudio);
    this.queue = next.catch(() => undefined);
    return next;
  }

  synthesize(chunk: SpeechChunk, signal: AbortSignal, narrator = this.narrator) {
    const next = this.queue.then(async () => {
      if (signal.aborted) throw new Error("Narration stopped");
      const key = audioKey(chunk, narrator);
      const cached = cachedAudio(key, SAMPLE_RATE);
      if (cached) return { ...cached, chunkId: chunk.id, modelId: MODEL.id, words: [] };
      const waveform = await this.generate(chunk.text, narrator);
      if (signal.aborted) throw new Error("Narration stopped");
      const saved = saveAudio(key, waveform, SAMPLE_RATE);
      return { ...saved, chunkId: chunk.id, modelId: MODEL.id, words: [] };
    });
    this.queue = next.catch(() => undefined);
    return next;
  }
  private async generate(text: string, narrator: string) {
    if (narrator.startsWith("device:")) {
      if (!readerMedia) throw new Error("Device voice requires the updated Android app.");
      const file = new File(await readerMedia.synthesize(text, narrator.slice(7)));
      try { return decodeDeviceWav(await file.bytes(), SAMPLE_RATE); }
      finally { if (file.exists) file.delete(); }
    }
    const voice = this.voices.get(narrator);
    if (!this.session || !voice) throw new Error("Prepare this voice before listening.");
    return runKokoro(this.session, kokoroTokens(text), voice);
  }

}

export const kokoroEngine = new KokoroEngine();
