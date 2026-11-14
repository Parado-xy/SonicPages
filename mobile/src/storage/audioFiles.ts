import { Directory, File, Paths } from "expo-file-system";
import * as legacy from "expo-file-system/legacy";
import { encodeWav, wavDurationMs } from "../audio/wav";

const root = new Directory(Paths.document, "sonicpages-v1");

function directory(name: string): Directory {
  const dir = new Directory(root, name);
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

export function installedAsset(filename: string, bytes: number): File | undefined {
  const file = new File(root, "speech-assets", filename);
  return file.size === bytes ? file : undefined;
}

export async function installAsset(
  filename: string,
  url: string,
  bytes: number,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<File> {
  const installed = installedAsset(filename, bytes);
  if (installed) return installed;
  const assets = directory("speech-assets");
  const file = new File(assets, filename);
  const temporary = new File(assets, filename + ".download");
  if (temporary.exists) temporary.delete();
  if (signal?.aborted) throw new Error("Voice download canceled.");
  const download = legacy.createDownloadResumable(url, temporary.uri, {}, progress => {
      onProgress?.(Math.min(1, progress.totalBytesWritten / bytes));
    });
  const cancel = () => { void download.cancelAsync().catch(console.warn); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const result = await download.downloadAsync();
    if (signal?.aborted) throw new Error("Voice download canceled.");
    if (result?.status !== 200 || temporary.size !== bytes) throw new Error("Incomplete download for " + filename);
    if (file.exists) file.delete();
    temporary.move(file);
    return file;
  } finally {
    signal?.removeEventListener("abort", cancel);
    const unfinished = new File(assets, filename + ".download");
    if (unfinished.exists) unfinished.delete();
  }
}

export function cachedAudio(key: string, sampleRate: number) {
  const file = new File(directory("audio"), key + ".wav");
  if (!file.exists || file.size < 46) return null;
  const handle = file.open();
  try {
    const durationMs = wavDurationMs(handle.readBytes(44), file.size, sampleRate);
    return durationMs === null ? null : { localAudioUri: file.uri, durationMs };
  } finally {
    handle.close();
  }
}

export function saveAudio(key: string, waveform: Float32Array, sampleRate: number) {
  const audio = directory("audio");
  const file = new File(audio, key + ".wav");
  const temporary = new File(audio, key + ".part");
  temporary.create({ overwrite: true });
  try {
    temporary.write(encodeWav(waveform, sampleRate));
    if (file.exists) file.delete();
    temporary.move(file);
  } finally {
    const unfinished = new File(audio, key + ".part");
    if (unfinished.exists) unfinished.delete();
  }
  return { localAudioUri: file.uri, durationMs: waveform.length * 1000 / sampleRate };
}

export function speechStorageUsage() {
  const size = (name: string) => {
    const dir = new Directory(root, name);
    return dir.exists ? dir.list().reduce((total, entry) => total + (entry instanceof File ? entry.size : 0), 0) : 0;
  };
  return { voiceBytes: size("speech-assets"), audioBytes: size("audio") };
}

export function deleteGeneratedAudio() {
  const audio = new Directory(root, "audio");
  if (audio.exists) audio.delete();
}

export function deleteDocumentAudio(id: string) {
  const folder = new Directory(root, "audio");
  if (!folder.exists) return;
  const suffix = "_" + id + "_";
  for (const entry of folder.list()) {
    if (entry instanceof File && entry.name.includes(suffix)) entry.delete();
  }
}
