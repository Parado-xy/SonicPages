import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Button, ui, type Palette } from "./Design";

export type ReaderNote = { index: number; text: string };

export function Notes({ notes, current, excerpt, save, jump, remove, listen, palette }: {
  notes: ReaderNote[];
  current: number;
  excerpt(index: number): string;
  save(note: ReaderNote): void;
  jump(index: number): void;
  remove(index: number): void;
  listen(index: number): void;
  palette: Palette;
}) {
  const [text, setText] = useState(() => notes.find(note => note.index === current)?.text ?? "");
  return <>
    <Text numberOfLines={3} style={{ color: palette.ink }}>{excerpt(current)}</Text>
    <TextInput accessibilityLabel="Note for this passage" multiline maxLength={1500} value={text} onChangeText={setText}
      placeholder="Add a note (optional)" placeholderTextColor={palette.muted}
      style={{ color: palette.ink, backgroundColor: palette.card, padding: 10, minHeight: 48 }} />
    <Button p={palette} primary label="Save highlight" action={() => save({ index: current, text: text.trim() })} />
    <Button p={palette} label="Listen from this passage" action={() => listen(current)} />
    {!!notes.length && <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
      {notes.map(note => <View key={note.index} style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button p={palette} label={`Passage ${note.index + 1}`} action={() => jump(note.index)} />
          {!!note.text && <Text style={{ color: palette.muted }}>{note.text}</Text>}
        </View>
        <Button p={palette} label="Remove" accessibilityLabel={`Remove highlight in passage ${note.index + 1}`} action={() => remove(note.index)} />
      </View>)}
    </ScrollView>}
  </>;
}
