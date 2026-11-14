import { useState } from "react";
import { Modal, Text, TextInput, View } from "react-native";
import type { LibraryEntry } from "../storage/readerStore";
import { Button, Sheet, ui, type Palette } from "./Design";

export function DocumentOptions({ item, p, close, rename, remove, exportFile }: {
  item: LibraryEntry; p: Palette; close(): void;
  rename(id: string, name: string): boolean; remove(id: string, title: string): void;
  exportFile(id: string, kind: "document" | "audio"): void;
}) {
  const [mode, setMode] = useState<"menu" | "rename" | "delete">("menu");
  const [title, setTitle] = useState(item.title);
  if (mode === "menu") return <Sheet title={item.title} close={close} p={p}>
    <Button p={p} label="Rename" action={() => setMode("rename")} />
    <Button p={p} label="Export document" action={() => { close(); exportFile(item.id, "document"); }} />
    <Button p={p} label="Export audio" action={() => { close(); exportFile(item.id, "audio"); }} />
    <Button p={p} label="Delete" action={() => setMode("delete")} />
  </Sheet>;
  return <Modal transparent onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0007" }}>
      <View accessibilityViewIsModal style={{ gap: 12, padding: 18, borderRadius: 16, backgroundColor: p.bg }}>
        <Text accessibilityRole="header" style={[ui.title, { color: p.ink }]}>{mode === "rename" ? "Rename document" : `Delete “${item.title}”?`}</Text>
        {mode === "rename" ? <>
          <Text style={{ color: p.muted }}>Original filename</Text>
          <Text selectable style={{ color: p.ink }}>{item.sourceName ?? item.title}</Text>
          <TextInput accessibilityLabel="Display title" autoFocus value={title} onChangeText={setTitle} maxLength={200}
            style={{ minHeight: 48, padding: 10, borderColor: p.line, borderWidth: 1, color: p.ink }} />
        </> : <Text style={{ color: p.ink }}>This removes the document and its generated audio and reading position. Export anything you want to keep first.</Text>}
        <View style={[ui.row, { flexWrap: "wrap" }]}>
          <Button p={p} label="Cancel" action={close} />
          <Button p={p} primary label={mode === "rename" ? "Save title" : "Delete"}
            disabled={mode === "rename" && !title.trim()}
            action={() => {
              if (mode === "delete") { close(); remove(item.id, item.title); }
              else if (rename(item.id, title)) close();
            }} />
        </View>
      </View>
    </View>
  </Modal>;
}
