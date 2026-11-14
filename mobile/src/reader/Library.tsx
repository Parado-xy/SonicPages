import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LibraryEntry } from "../storage/readerStore";
import { styles } from "./styles";

export function Library({ entries, activeId, close, open, rename, storage, busy, clear, exportFile }: {
  entries: LibraryEntry[];
  activeId: string;
  close(): void;
  open(id: string): void;
  storage: { voiceBytes: number; audioBytes: number };
  busy: boolean;
  clear(): void;
  exportFile(id: string, kind: "document" | "audio"): void;
  rename(id: string, title: string): boolean;
}) {
  const [editing, setEditing] = useState<LibraryEntry>();
  const [title, setTitle] = useState("");
  const dismiss = () => { if (!busy) { if (editing) setEditing(undefined); else close(); } };

  return (
    <Modal animationType="slide" onRequestClose={dismiss}>
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Text accessibilityRole="header" style={styles.brand}>{editing ? "Rename document" : "Library"}</Text>
          <Pressable accessibilityRole="button" onPress={dismiss} disabled={busy} style={styles.import}>
            <Text style={styles.importText}>{editing ? "Cancel" : "Done"}</Text>
          </Pressable>
        </View>
        {editing ? (
          <View style={local.form}>
            <TextInput accessibilityLabel="Document title" value={title} onChangeText={setTitle}
              maxLength={200} autoFocus style={local.input} />
            <Pressable accessibilityRole="button" disabled={!title.trim()} style={styles.import}
              onPress={() => { if (rename(editing.id, title)) setEditing(undefined); }}>
              <Text style={styles.importText}>Save title</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList ListHeaderComponent={
            <View style={local.storage}>
              <Text accessibilityRole="header" style={styles.title}>Storage</Text>
              <Text style={styles.subtitle}>Offline voice {formatSize(storage.voiceBytes)}</Text>
              <Text style={styles.subtitle}>Generated audio {formatSize(storage.audioBytes)}</Text>
              {busy && <ActivityIndicator />}
              <Pressable accessibilityRole="button" onPress={clear} disabled={busy || !storage.audioBytes}
                style={[styles.import, (busy || !storage.audioBytes) && local.disabled]}>
                <Text style={styles.importText}>Clear generated audio</Text>
              </Pressable>
            </View>
          } data={entries} keyExtractor={item => item.id} contentContainerStyle={styles.reader}
            renderItem={({ item }) => (
              <View style={local.row}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: item.id === activeId }}
                  disabled={busy} onPress={() => open(item.id)} style={local.document}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.subtitle}>Passage {item.index + 1}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${item.title}`}
                  disabled={busy} style={styles.import} onPress={() => Alert.alert(item.title, undefined, [
                    { text: "Rename", onPress: () => { setTitle(item.title); setEditing(item); } },
                    { text: "Export document", onPress: () => exportFile(item.id, "document") },
                    { text: "Export audio", onPress: () => exportFile(item.id, "audio") },
                  ], { cancelable: true })}>
                  <Text style={styles.importText}>Options</Text>
                </Pressable>
              </View>
            )} />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function formatSize(bytes: number) {
  if (!bytes) return "0 MB";
  if (bytes < 1_000_000) return `${Math.ceil(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

const local = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#E4E0D9" },
  storage: { gap: 8, alignItems: "flex-start", paddingBottom: 16 },
  disabled: { opacity: 0.45 },
  document: { flex: 1, paddingVertical: 4 },
  form: { paddingHorizontal: 24, gap: 12 },
  input: { padding: 12, borderWidth: 1, borderColor: "#A4AEAA", borderRadius: 8, color: "#253A39", fontSize: 16 },
});
