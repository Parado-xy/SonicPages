import { useEffect, useState, type ReactNode } from "react";
import { FlatList, Image, ImageBackground, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { thumbnail } from "../storage/thumbnails";
import type { LibraryEntry } from "../storage/readerStore";

export const light = { bg: "#F7F1E5", card: "#FBF6EB", ink: "#182327", muted: "#545658", line: "#C9C1B5", accent: "#5145CD", fill: "#B9C4FF", highlight: "#E5E1FF" };
export const dark = { bg: "#171B27", card: "#232838", ink: "#F6EFE1", muted: "#BAC0CF", line: "#53596C", accent: "#B9C4FF", fill: "#B9C4FF", highlight: "#353959" };
export type Palette = typeof light;

export const ui = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { fontFamily: "serif", fontSize: 27, flex: 1 },
  title: { fontFamily: "serif", fontSize: 20 },
  section: { fontFamily: "serif", fontSize: 23 },
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, justifyContent: "center", alignItems: "center", borderRadius: 24 },
  gridCard: { flex: 1, minWidth: 0, margin: 6 },
  cover: { width: "100%", aspectRatio: 0.76, borderRadius: 8, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, justifyContent: "center", alignItems: "center", padding: 12 },
  dock: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  tabs: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 3 },
});

export function Paper({ palette, children }: { palette: Palette; children: ReactNode }) {
  return palette === light
    ? <ImageBackground source={require("../../assets/paper.jpg")} resizeMode="repeat" imageStyle={{ opacity: 0.35 }} style={{ flex: 1, backgroundColor: palette.bg }}>{children}</ImageBackground>
    : <View style={{ flex: 1, backgroundColor: palette.bg }}>{children}</View>;
}

export function Button({ p, label, action, selected, primary, disabled, accessibilityLabel }: {
  p: Palette; label: string; action(): void; selected?: boolean; primary?: boolean; disabled?: boolean; accessibilityLabel?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled: !!disabled, ...(selected !== undefined ? { selected } : {}) }} disabled={disabled} onPress={action}
    style={[ui.button, { borderColor: selected ? p.accent : p.line, borderWidth: primary ? 0 : StyleSheet.hairlineWidth,
      backgroundColor: primary ? p.fill : selected ? p.highlight : p.card, opacity: disabled ? 0.48 : 1 }]}>
    <Text style={{ color: primary ? "#182327" : selected ? p.accent : p.ink, fontWeight: "600", textAlign: "center" }}>{label}</Text>
  </Pressable>;
}

export function Cover({ id, format, title, p }: { id: string; format: string; title: string; p: Palette }) {
  const [uri, setUri] = useState<string>();
  useEffect(() => {
    let live = true;
    void thumbnail(id, format).then(result => { if (live) setUri(result); });
    return () => { live = false; };
  }, [id, format]);
  return <View style={[ui.cover, { backgroundColor: p.card, borderColor: p.line }]}>
    {uri ? <Image source={{ uri }} resizeMode="contain" accessibilityLabel={`${title} cover`}
      onError={() => setUri(undefined)} style={StyleSheet.absoluteFill} />
      : <><Text numberOfLines={4} style={[ui.title, { color: p.ink, textAlign: "center" }]}>{title}</Text>
        <Text style={{ color: p.muted, marginTop: 8 }}>{format}</Text></>}
  </View>;
}

export function Sheet({ title, close, p, children }: { title: string; close(): void; p: Palette; children: ReactNode }) {
  return <Modal transparent animationType="slide" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0007" }}>
      <Pressable accessibilityLabel="Close panel" onPress={close} style={{ flex: 1 }} />
      <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, gap: 12 }}>
        <View style={ui.row}><Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>{title}</Text><Button p={p} label="Done" action={close} /></View>
        {children}
      </View>
    </View>
  </Modal>;
}

export function LibraryShelf({ entries, p, active, open, play, playing, controls, disabled }: {
  entries: LibraryEntry[]; p: Palette; active: LibraryEntry; open(id: string): void; play(): void; playing: boolean; controls(): void; disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("All");
  const [search, setSearch] = useState(false);
  const filtered = entries.filter(item => (format === "All" || item.format === format) &&
    item.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <FlatList data={filtered} keyExtractor={item => item.id} numColumns={2} keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ padding: 10, paddingBottom: 18 }}
    ListHeaderComponent={<View style={{ gap: 10, paddingHorizontal: 6, paddingBottom: 10 }}>
      <View style={[ui.row, { flexWrap: "wrap" }]}>
        {["All", "EPUB", "PDF", "TXT"].map(item => <Button key={item} p={p} label={item} selected={format === item} action={() => setFormat(item)} />)}
        <Button p={p} label={search ? "Close search" : "Search"} action={() => { setSearch(!search); setQuery(""); }} />
      </View>
      {search && <TextInput autoFocus accessibilityLabel="Search documents" placeholder="Search documents" placeholderTextColor={p.muted}
        value={query} onChangeText={setQuery} style={{ color: p.ink, backgroundColor: p.card, borderColor: p.line, borderWidth: 1, borderRadius: 8, padding: 12 }} />}
      <Text style={[ui.section, { color: p.ink }]}>Continue listening</Text>
      <View style={[ui.row, { padding: 10, backgroundColor: p.card, borderRadius: 10, borderColor: p.line, borderWidth: StyleSheet.hairlineWidth }]}>
        <Pressable accessibilityRole="button" onPress={() => open(active.id)} style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[ui.title, { color: p.ink }]}>{active.title}</Text>
          <Text style={{ color: p.muted }}>Passage {active.index + 1}</Text>
        </Pressable>
        <Button p={p} primary label={playing ? "Ⅱ" : "▶"} accessibilityLabel={playing ? "Pause narration" : "Continue listening"} disabled={disabled} action={play} />
      </View>
      <View style={ui.row}><Text style={[ui.section, { color: p.ink, flex: 1 }]}>Documents</Text><Button p={p} label="Manage" action={controls} /></View>
    </View>}
    ListEmptyComponent={<Text style={{ color: p.muted, padding: 16 }}>No matching documents.</Text>}
    renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => open(item.id)} style={ui.gridCard}>
      <Cover key={item.id} id={item.id} format={item.format} title={item.title} p={p} />
      <Text numberOfLines={2} style={{ color: p.ink, marginTop: 5, fontWeight: "600" }}>{item.title}</Text>
      <Text style={{ color: p.muted, marginTop: 2 }}>{item.format}</Text>
    </Pressable>} />;
}
