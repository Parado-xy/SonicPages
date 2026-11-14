import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRef } from "react";
import { useEffect, useState, type ReactNode } from "react";
import { FlatList, Image, ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { thumbnail } from "../storage/thumbnails";
import type { LibraryEntry } from "../storage/readerStore";

import { light, serif, type Palette } from "../theme/tokens";
export type { Palette } from "../theme/tokens";

export const ui = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { fontFamily: serif, fontSize: 27, flex: 1 },
  title: { fontFamily: serif, fontSize: 20 },
  section: { fontFamily: serif, fontSize: 23 },
  button: { minHeight: 48, minWidth: 48, paddingHorizontal: 10, justifyContent: "center", alignItems: "center", borderRadius: 24 },
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
      : <><Image source={require("../../assets/sonicpages-icon.png")} accessibilityIgnoresInvertColors style={{ width: 34, height: 34, borderRadius: 6, marginBottom: 8 }} /><Text numberOfLines={4} style={[ui.title, { color: p.ink, textAlign: "center" }]}>{title}</Text>
        <Text style={{ color: p.muted, marginTop: 8 }}>{format}</Text></>}
  </View>;
}

export function Sheet({ title, close, p, children }: { title: string; close(): void; p: Palette; children: ReactNode }) {
  const modal = useRef<BottomSheetModal>(null);
  const { bottom } = useSafeAreaInsets();
  useEffect(() => { modal.current?.present(); }, []);
  return <BottomSheetModal ref={modal} onDismiss={close} enablePanDownToClose
    backgroundStyle={{ backgroundColor: p.bg }} handleIndicatorStyle={{ backgroundColor: p.line }}
    backdropComponent={props => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}>
    <BottomSheetView accessibilityViewIsModal style={{ paddingHorizontal: 20, paddingBottom: bottom + 16, gap: 12 }}>
      <View style={ui.row}><Text accessibilityRole="header" style={[ui.heading, { color: p.ink }]}>{title}</Text><Button p={p} label="Done" action={close} /></View>
      {children}
    </BottomSheetView>
  </BottomSheetModal>;
}

export function LibraryShelf({ entries, p, active, open, play, playing, importFile, options, importing, disabled }: {
  entries: LibraryEntry[]; p: Palette; active: LibraryEntry; open(id: string): void; play(): void; playing: boolean; importFile(): void; options(item: LibraryEntry): void; importing?: { raw: string; title: string }; disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("All");
  const filtered = entries.filter(item => (format === "All" || item.format === format) &&
    item.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <FlatList data={filtered} keyExtractor={item => item.id} numColumns={2} keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ padding: 10, paddingBottom: 18 }}
    ListHeaderComponent={<View style={{ gap: 10, paddingHorizontal: 6, paddingBottom: 10 }}>
      <View style={ui.row}>
        <TextInput accessibilityLabel="Search library" placeholder="Search library" placeholderTextColor={p.muted}
          value={query} onChangeText={setQuery} style={{ flex: 1, minHeight: 48, color: p.ink, backgroundColor: p.card,
            borderColor: p.line, borderWidth: 1, borderRadius: 10, padding: 10 }} />
        <Button p={p} primary label="+ Import" action={importFile} disabled={!!importing} />
      </View>
      <View style={[ui.row, { flexWrap: "wrap" }]}>
        {["All", "EPUB", "PDF", "TXT"].map(item => <Button key={item} p={p} label={item} selected={format === item} action={() => setFormat(item)} />)}
      </View>
      {importing && <View accessibilityLiveRegion="polite" style={{ padding: 12, borderRadius: 10, backgroundColor: p.card }}>
        <Text style={{ color: p.ink }}>Importing…</Text>
        <Text numberOfLines={2} style={{ color: p.muted }}>{importing.raw}</Text>
        <Text style={[ui.title, { color: p.ink }]}>→ {importing.title}</Text>
      </View>}
      {!!entries.length && !query.trim() && !importing && <>
      <Text style={[ui.section, { color: p.ink }]}>Continue listening</Text>
      <View style={[ui.row, { padding: 10, backgroundColor: p.card, borderRadius: 10, borderColor: p.line, borderWidth: StyleSheet.hairlineWidth }]}>
        <Pressable accessibilityRole="button" onPress={() => open(active.id)} style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[ui.title, { color: p.ink }]}>{active.title}</Text>
          <Text style={{ color: p.muted }}>Passage {active.index + 1}</Text>
        </Pressable>
        <Button p={p} primary label={playing ? "Ⅱ" : "▶"} accessibilityLabel={playing ? "Pause narration" : "Continue listening"} disabled={disabled} action={play} />
      </View>
      </>}
    </View>}
    ListEmptyComponent={!entries.length ? <View style={{ alignItems: "center", gap: 10, backgroundColor: p.card, margin: 6, padding: 24, borderRadius: 12 }}>
      <Text style={[ui.section, { color: p.ink }]}>Your library is empty</Text>
      <Text style={{ color: p.muted, textAlign: "center" }}>Import TXT, EPUB or PDF. Your files and generated audio stay on this device.</Text>
      <Button p={p} primary label="Import a book" action={importFile} />
    </View> : <Text style={{ color: p.muted, padding: 16 }}>No matching documents.</Text>}
    renderItem={({ item }) => <View style={ui.gridCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => open(item.id)}>
        <Cover key={item.id} id={item.id} format={item.format} title={item.title} p={p} />
      </Pressable>
      <View style={ui.row}>
        <Text numberOfLines={2} style={[ui.title, { color: p.ink, flex: 1 }]}>{item.title}</Text>
        <Button p={p} label="⋯" accessibilityLabel={`Options for ${item.title}`} action={() => options(item)} />
      </View>
      <Text style={{ color: p.muted }}>{item.format}</Text>
    </View>} />;
}
