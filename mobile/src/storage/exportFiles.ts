import { File, Paths } from "expo-file-system";
import { Alert, NativeModules } from "react-native";
import { wavHeader } from "../audio/wav";
import { splitIntoChunks } from "../reader/chunks";
import { cachedPassageAudio } from "../speech/kokoroEngine";
import { SAMPLE_RATE } from "../vendor/kokoro/kokoroOnnx";
import { originalFile } from "./originalFiles";
import { getExportDocument } from "./readerStore";

async function saveFile(file: File, name: string, mime: string) {
  const module = NativeModules.SonicPagesFileExport as { save(uri: string, name: string, mime: string): Promise<boolean> } | undefined;
  if (!module) throw new Error("File export requires the updated Android app.");
  return module.save(file.uri, name.replace(/[\\/]/g, "_"), mime);
}

async function temporaryExport(action: (file: File) => Promise<boolean>) {
  const file = new File(Paths.cache, "sonicpages-export");
  file.create({ overwrite: true });
  try { return await action(file); }
  finally { if (file.exists) file.delete(); }
}

export async function exportDocument(id: string) {
  const { title, content } = getExportDocument(id);
  const original = originalFile(id);
  if (original.exists) {
    const extension = title.split(".").at(-1)?.toLowerCase();
    const mime = extension === "epub" ? "application/epub+zip" : extension === "pdf" ? "application/pdf" : "text/plain";
    return saveFile(original, title, mime);
  }
  return temporaryExport(file => {
    file.write(content);
    return saveFile(file, title.replace(/\.[^.]+$/, "") + ".txt", "text/plain");
  });
}

export async function exportNarration(id: string) {
  const { title, content } = getExportDocument(id);
  const passages = splitIntoChunks(id, content);
  const clips = passages.flatMap(chunk => {
    const clip = cachedPassageAudio(chunk);
    return clip ? [new File(clip.localAudioUri)] : [];
  });
  if (!clips.length) throw new Error("Play this document to generate narration before exporting.");
  if (clips.length !== passages.length) {
    const proceed = await new Promise<boolean>(resolve => {
      Alert.alert("Export generated passages?", `${clips.length} of ${passages.length} passages have audio. The WAV will contain those passages in document order.`, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Export", onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });
    if (!proceed) return false;
  }
  const dataLength = clips.reduce((total, clip) => total + clip.size - 44, 0);
  return temporaryExport(async file => {
    const output = file.open();
    try {
      output.writeBytes(wavHeader(dataLength, SAMPLE_RATE));
      for (const clip of clips) {
        const input = clip.open();
        try {
          input.offset = 44;
          let remaining = clip.size - 44;
          while (remaining > 0) {
            const bytes = input.readBytes(Math.min(remaining, 64 * 1024));
            if (!bytes.length) throw new Error("Generated audio changed during export.");
            output.writeBytes(bytes);
            remaining -= bytes.length;
          }
        } finally { input.close(); }
      }
    } finally { output.close(); }
    const suffix = clips.length === passages.length ? ".wav" : "-generated-passages.wav";
    return saveFile(file, title.replace(/\.[^.]+$/, "") + suffix, "audio/wav");
  });
}
