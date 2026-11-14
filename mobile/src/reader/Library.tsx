import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LibraryEntry } from "../storage/readerStore";
import { styles } from "./styles";

export function Library({ entries, activeId, close, open, rename }: {
  entries: LibraryEntry[];
  activeId: string;
  close(): void;
  open(id: string): void;
  rename(id: string, title: string): boolean;
}) {
  const [editing, setEditing] = useState<LibraryEntry>();
  const [title, setTitle] = useState("");
  const dismiss = () => editing ? setEditing(undefined) : close();

  return (
    <Modal animationType="slide" onRequestClose={dismiss}>
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Text accessibilityRole="header" style={styles.brand}>{editing ? "Rename document" : "Library"}</Text>
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.import}>
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
          <FlatList data={entries} keyExtractor={item => item.id} contentContainerStyle={styles.reader}
            renderItem={({ item }) => (
              <View style={local.row}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: item.id === activeId }}
                  onPress={() => open(item.id)} style={local.document}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.subtitle}>Passage {item.index + 1}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Rename ${item.title}`}
                  style={styles.import} onPress={() => { setTitle(item.title); setEditing(item); }}>
                  <Text style={styles.importText}>Rename</Text>
                </Pressable>
              </View>
            )} />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#E4E0D9" },
  document: { flex: 1, paddingVertical: 4 },
  form: { paddingHorizontal: 24, gap: 12 },
  input: { padding: 12, borderWidth: 1, borderColor: "#A4AEAA", borderRadius: 8, color: "#253A39", fontSize: 16 },
});
