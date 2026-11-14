import { Directory, File, Paths } from "expo-file-system";
import { NativeModules } from "react-native";
import { extractEpubCover } from "../imports/epub";
import { originalFile } from "./originalFiles";

export const readerMedia = NativeModules.SonicPagesReaderMedia as {
  thumbnail(uri: string): Promise<string>;
  deviceVoice(): Promise<string | null>;
  synthesize(text: string, voiceId: string): Promise<string>;
} | undefined;

const folder = new Directory(Paths.cache, "sonicpages-covers");
const pending = new Map<string, Promise<string | undefined>>();

export function thumbnail(id: string, format: string) {
  const existing = pending.get(id);
  if (existing) return existing;
  const work = createThumbnail(id, format).catch(() => undefined).finally(() => pending.delete(id));
  pending.set(id, work);
  return work;
}

async function createThumbnail(id: string, format: string) {
  if (format !== "PDF" && format !== "EPUB") return undefined;
  const source = originalFile(id);
  if (!source.exists) return undefined;
  folder.create({ idempotent: true, intermediates: true });
  for (const extension of ["jpg", "png", "webp"]) {
    const cached = new File(folder, id + "." + extension);
    if (cached.size > 0) return cached.uri;
  }
  if (format === "PDF") {
    if (!readerMedia) return undefined;
    const temporary = new File(await readerMedia.thumbnail(source.uri));
    const cover = new File(folder, id + ".jpg");
    try { temporary.move(cover); }
    finally { if (temporary.uri !== cover.uri && temporary.exists) temporary.delete(); }
    return cover.uri;
  }
  const image = extractEpubCover(await source.bytes());
  if (!image) return undefined;
  const cover = new File(folder, id + "." + image.extension);
  cover.create({ overwrite: true });
  cover.write(image.data);
  return cover.uri;
}
