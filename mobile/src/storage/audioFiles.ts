import { Directory, File, Paths } from "expo-file-system";
import * as legacy from "expo-file-system/legacy";
import { encodeWav, wavDurationMs } from "../audio/wav";

const root = new Directory(Paths.document, "sonicpages-v1");

function directory(name: string): Directory {
  const dir = new Directory(root, name);
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

export async function installAsset(
  filename: string,
  url: string,
  bytes: number,
  onProgress?: (progress: number) => void,
): Promise<File> {
  const assets = directory("speech-assets");
  const file = new File(assets, filename);
  if (file.size === bytes) return file;
  const temporary = new File(assets, filename + ".download");
  if (temporary.exists) temporary.delete();
  try {
    const download = legacy.createDownloadResumable(url, temporary.uri, {}, progress => {
      onProgress?.(Math.min(1, progress.totalBytesWritten / bytes));
    });
    const result = await download.downloadAsync();
    if (result?.status !== 200 || temporary.size !== bytes) throw new Error("Incomplete download for " + filename);
    if (file.exists) file.delete();
    temporary.move(file);
    return file;
  } finally {
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
