import { Directory, File, Paths } from "expo-file-system";

const originals = new Directory(Paths.document, "sonicpages-v1", "originals");

export function originalFile(id: string) {
  return new File(originals, id);
}

export function keepOriginal(id: string, source: File) {
  originals.create({ idempotent: true, intermediates: true });
  const destination = originalFile(id);
  if (destination.exists) return;
  const temporary = new File(originals, id + ".part");
  if (temporary.exists) temporary.delete();
  try {
    source.copy(temporary);
    if (temporary.size !== source.size) throw new Error("Could not keep a complete copy of the original.");
    temporary.move(destination);
  } finally {
    const leftover = new File(originals, id + ".part");
    if (leftover.exists) leftover.delete();
  }
}
