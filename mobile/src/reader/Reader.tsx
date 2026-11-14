import { useEffect, useRef } from "react";
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from "react-native";
import type { SpeechChunk } from "../speech/types";
import type { Palette } from "./Design";
import { styles } from "./styles";

export function Reader({ chunks, index, highlightedIndex, onSelect, palette, fontSize }: {
  palette: Palette;
  fontSize: number;
  chunks: SpeechChunk[];
  index: number;
  highlightedIndex: number | null;
  onSelect(index: number): void;
}) {
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<number[]>([]);
  const scrollToPassage = (passage: number, animated: boolean) => {
    const y = positions.current[passage];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated });
  };

  useEffect(() => {
    if (highlightedIndex !== null) scrollToPassage(highlightedIndex, true);
  }, [highlightedIndex]);

  const measure = (passage: number, event: LayoutChangeEvent) => {
    const firstLayout = positions.current[passage] === undefined;
    positions.current[passage] = event.nativeEvent.layout.y;
    if (firstLayout && passage === index && passage > 0) scrollToPassage(passage, false);
  };

  return (
    <ScrollView ref={scroll} contentContainerStyle={styles.reader}>
      <View>
        {chunks.map((chunk, passage) => (
          <Pressable key={chunk.id} onPress={() => onSelect(passage)}
            onLayout={event => measure(passage, event)} accessibilityRole="button"
            accessibilityState={{ selected: passage === highlightedIndex }}
            style={[styles.chunk, passage === highlightedIndex && { backgroundColor: palette.highlight, borderLeftWidth: 3, borderLeftColor: palette.accent }]}>
            <Text style={[styles.prose, { color: palette.ink, fontFamily: "serif", fontSize, lineHeight: fontSize * 1.52 }]}>{chunk.text.trim()}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
