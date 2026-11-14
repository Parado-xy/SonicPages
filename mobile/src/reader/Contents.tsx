import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { extractEpubContents } from "../imports/epub";
import { originalFile } from "../storage/originalFiles";
import { readerMedia } from "../storage/thumbnails";
import { IconButton } from "./Controls";
import { Button, ui, type Palette } from "./Design";

export type ContentsEntry = { title: string; depth: number; page?: number; offset?: number };

export function Contents({ id, format, current, total, read, play, p }: {
  id: string; format: string; current: number; total: number;
  read(entry: ContentsEntry): void; play(entry: ContentsEntry): void; p: Palette;
}) {
  const [entries, setEntries] = useState<ContentsEntry[]>();
  const [target, setTarget] = useState("");
  useEffect(() => {
    let live = true;
    const file = originalFile(id);
    const work = file.exists && format === "EPUB" ? file.bytes().then(extractEpubContents)
      : file.exists && format === "PDF" ? readerMedia?.pdfContents(file.uri) : undefined;
    void (work ?? Promise.resolve([])).then(result => { if (live) setEntries(result); })
      .catch(() => { if (live) setEntries([]); });
    return () => { live = false; };
  }, [id, format]);
  const index = Number(target) - 1;
  const valid = Number.isInteger(index) && index >= 0 && index < total;
  const active = entries?.reduce<ContentsEntry | undefined>((match, entry) => {
    const position = entry.page ?? entry.offset ?? Infinity;
    return position <= current && position >= (match?.page ?? match?.offset ?? -1) ? entry : match;
  }, undefined);
  if (!entries) return <Text style={{ color: p.muted }}>Reading contents…</Text>;
  if (!entries.length) return <>
    <Text style={{ color: p.ink }}>No contents in this file</Text>
    <View style={ui.row}>
      <TextInput accessibilityLabel={format === "PDF" ? "Page number" : "Passage number"}
        placeholder={format === "PDF" ? "Page number" : "Passage number"} placeholderTextColor={p.muted}
        keyboardType="number-pad" value={target} onChangeText={setTarget}
        style={{ flex: 1, minHeight: 48, padding: 8, color: p.ink, backgroundColor: p.card, borderColor: p.line, borderWidth: 1 }} />
      <Button p={p} label="Go" disabled={!valid} action={() => read({ title: "", depth: 0, page: index })} />
    </View>
  </>;
  return <ScrollView>
    {entries.map((entry, i) => <View key={i} style={[ui.row, { marginLeft: Math.min(3, entry.depth) * 12, marginBottom: 4 }]}>
      <View style={{ flex: 1, alignItems: "stretch" }}>
        <Button p={p} label={entry.title} selected={active === entry} action={() => read(entry)} />
      </View>
      <IconButton p={p} icon="play" label={`Narrate from ${entry.title}`} action={() => play(entry)} />
    </View>)}
  </ScrollView>;
}
