import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { preference, savePreference, type LibraryEntry } from "../storage/readerStore";
import { Button, Cover, Sheet, ui, type Palette } from "./Design";
import { IconButton } from "./Controls";

const formats = ["All", "EPUB", "PDF", "TXT"];
const importTile = { id: "import", title: "", index: 0, format: "" };

export function LibraryShelf({ entries, p, active, open, expand, play, playing, importFile, options, importing, disabled, progress, menu }: {
  entries: LibraryEntry[]; p: Palette; active: LibraryEntry; open(id: string): void; expand(): void;
  play(): void; playing: boolean; importFile(): void; options(item: LibraryEntry): void;
  importing?: { raw: string; title: string }; disabled?: boolean; progress(item: LibraryEntry): string; menu(): void;
}) {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState(() => preference("libraryFormat") ?? "All");
  const [list, setList] = useState(() => preference("libraryView") === "list");
  const [columns, setColumns] = useState(() => Number(preference("libraryColumns")) || 3);
  const [viewOptions, setViewOptions] = useState(false);
  const shown = entries.filter(item => (format === "All" || item.format === format) &&
    item.title.toLowerCase().includes(query.trim().toLowerCase()));
  const count = list ? 1 : columns;
  const add = (full = false) => <Pressable accessibilityRole="button" accessibilityLabel="Import a book" onPress={importFile}
    disabled={!!importing} style={[ui.cover, { backgroundColor: p.card }, full && { width: 112, alignSelf: "center" }]}>
    <Feather name="plus" size={27} color={p.accent} />
  </Pressable>;

  return <>
    <View style={[ui.row, { paddingHorizontal: 10, paddingVertical: 5, gap: 1 }]}>
      <View style={[ui.row, { flex: 1, backgroundColor: p.card, borderRadius: 24, paddingLeft: 12, gap: 5 }]}>
        <Feather name="search" size={18} color={p.muted} />
        <TextInput accessibilityLabel="Search books" placeholder="Search books…" placeholderTextColor={p.muted}
          value={query} onChangeText={setQuery} style={{ flex: 1, minHeight: 48, color: p.ink }} />
        <IconButton p={p} icon="plus" label="Import" action={importFile} disabled={!!importing} />
      </View>
      <IconButton p={p} icon="more-horizontal" label="View options" action={() => setViewOptions(true)} />
      <IconButton p={p} icon="menu" label="App menu" action={menu} />
    </View>
    <FlatList key={count} data={entries.length ? [...shown, importTile] : []} keyExtractor={item => item.id}
      numColumns={count} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 10, paddingBottom: 18 }}
      ListHeaderComponent={<View style={{ gap: 10, paddingBottom: 8 }}>
        {importing && <View accessibilityLiveRegion="polite" style={{ padding: 12, backgroundColor: p.card, borderRadius: 12 }}>
          <View style={ui.row}><ActivityIndicator color={p.accent} /><Text style={{ color: p.ink }}>Importing…</Text></View>
          <Text numberOfLines={1} style={{ color: p.muted }}>{importing.raw}</Text>
          <Text style={[ui.title, { color: p.ink }]}>{importing.title}</Text>
        </View>}
        {!!entries.length && !query.trim() && !importing && <View style={[ui.row, { padding: 8, borderRadius: 12, backgroundColor: p.card }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Continue listening to ${active.title}`} onPress={expand}
            style={[ui.row, { flex: 1, minHeight: 48 }]}>
            <View style={{ width: 34 }}><Cover {...active} p={p} compact /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.muted }}>Continue listening</Text>
              <Text numberOfLines={1} style={[ui.title, { color: p.ink }]}>{active.title}</Text>
            </View>
          </Pressable>
          <IconButton p={p} primary icon={playing ? "pause" : "play"} label={playing ? "Pause narration" : "Resume narration"}
            disabled={disabled} action={play} />
        </View>}
        {!!entries.length && !shown.length && <Text style={{ color: p.muted }}>No matching documents.</Text>}
      </View>}
      ListEmptyComponent={<View style={{ alignItems: "center", paddingVertical: 42, paddingHorizontal: 18, gap: 10 }}>
        {add(true)}
        <Text style={[ui.section, { color: p.ink }]}>Your library is empty</Text>
        <Text style={{ color: p.muted, textAlign: "center" }}>Import TXT, EPUB or PDF files. Your documents and generated audio stay on this device.</Text>
      </View>}
      renderItem={({ item }) => item.id === "import" ? list
        ? <Button p={p} label="Import a book" action={importFile} disabled={!!importing} />
        : <View style={{ width: `${100 / count}%`, padding: 5 }}>{add()}</View>
        : list ? <View style={[ui.row, { paddingVertical: 4 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => open(item.id)}
            onLongPress={() => options(item)} style={[ui.row, { flex: 1, minHeight: 48 }]}>
            <View style={{ width: 43 }}><Cover {...item} p={p} compact /></View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[ui.title, { color: p.ink }]}>{item.title}</Text>
              <Text style={{ color: p.muted }}>{progress(item)}</Text>
            </View>
          </Pressable>
          <IconButton p={p} icon="more-vertical" label={`Options for ${item.title}`} action={() => options(item)} />
        </View> : <View style={{ width: `${100 / count}%`, padding: 5 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => open(item.id)} onLongPress={() => options(item)}>
            <Cover {...item} p={p} />
            <Text numberOfLines={1} style={{ color: p.ink, fontWeight: "600", marginTop: 5 }}>{item.title}</Text>
          </Pressable>
          <View style={[ui.row, { justifyContent: "space-between", gap: 0 }]}>
            <Text numberOfLines={1} style={{ color: p.muted, flex: 1 }}>{progress(item)}</Text>
            <IconButton p={p} icon="more-vertical" label={`Options for ${item.title}`} action={() => options(item)} />
          </View>
        </View>} />
    {viewOptions && <Sheet p={p} title="View options" close={() => setViewOptions(false)}>
      <Text style={{ color: p.muted }}>Format</Text>
      <View style={[ui.row, { flexWrap: "wrap" }]}>{formats.map(value => <Button key={value} p={p} label={value}
        selected={format === value} action={() => { setFormat(value); savePreference("libraryFormat", value); }} />)}</View>
      <Text style={{ color: p.muted }}>Layout</Text>
      <View style={[ui.row, { flexWrap: "wrap" }]}>
        <Button p={p} label="List" selected={list} action={() => { setList(true); savePreference("libraryView", "list"); }} />
        {[2, 3, 4].map(value => <Button key={value} p={p} label={`${value} columns`} selected={!list && columns === value}
          action={() => { setList(false); setColumns(value); savePreference("libraryView", "grid"); savePreference("libraryColumns", String(value)); }} />)}
      </View>
    </Sheet>}
  </>;
}
