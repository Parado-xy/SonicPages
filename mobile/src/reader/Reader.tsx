import { useEffect, useMemo, useRef } from "react";
import { FlatList, Text, View } from "react-native";
import type { ReaderNote } from "./Notes";
import { sentenceAt } from "./sentence";
import type { SpeechChunk } from "../speech/types";
import { serif } from "../theme/tokens";
import type { Palette } from "./Design";

export function Reader({ content, chunks, pageStarts, chapters, notes, index, highlightedIndex, onSelect, onAnnotate, onTap, palette, fontSize }: {
  content: string;
  chunks: SpeechChunk[];
  pageStarts?: number[];
  chapters: { title: string; offset: number }[];
  notes: ReaderNote[];
  onAnnotate(index: number): void;
  index: number;
  highlightedIndex: number | null;
  onSelect(index: number): void;
  onTap(): void;
  palette: Palette;
  fontSize: number;
}) {
  const list = useRef<FlatList>(null);
  const attempts = useRef(0);
  const retry = useRef<ReturnType<typeof setTimeout>>(undefined);
  const paragraphs = useMemo(() => {
    let cursor = 0;
    return Array.from(content.matchAll(/\S[\s\S]*?(?=\n\s*\n|$)/g), match => {
      const start = match.index;
      const end = start + match[0].length;
      while (chunks[cursor] && chunks[cursor].endChar <= start) cursor++;
      const first = cursor;
      while (chunks[cursor] && chunks[cursor].startChar < end) cursor++;
      const page = chunks[first]?.pageIndex;
      const previousPage = first > 0 ? chunks[first - 1]?.pageIndex : undefined;
      return { start, end, first, last: cursor, pageHeading: page !== undefined && page !== previousPage ? page + 1 : undefined };
    });
  }, [chunks, content]);

  const chapterHeadings = useMemo(() => {
    const headings = new Map<number, string>();
    for (const chapter of chapters) {
      const item = paragraphs.find(paragraph => paragraph.end > chapter.offset);
      if (item && !headings.has(item.start)) headings.set(item.start, chapter.title);
    }
    return headings;
  }, [chapters, paragraphs]);
  const selected = highlightedIndex ?? index;
  const paragraph = paragraphs.findIndex(item => selected >= item.first && selected < item.last);
  const sentence = highlightedIndex !== null && chunks[highlightedIndex]
    ? sentenceAt(content, chunks[highlightedIndex]) : undefined;

  useEffect(() => {
    attempts.current = 0;
    if (paragraph >= 0) list.current?.scrollToIndex({ index: paragraph, animated: true, viewPosition: 0.28 });
    return () => clearTimeout(retry.current);
  }, [paragraph]);

  return <FlatList ref={list} data={paragraphs} keyExtractor={item => String(item.start)}
    onScrollToIndexFailed={({ index: target, averageItemLength }) => {
      if (attempts.current++ >= 3) return;
      list.current?.scrollToOffset({ offset: target * averageItemLength, animated: false });
      clearTimeout(retry.current);
      retry.current = setTimeout(() => list.current?.scrollToIndex({ index: target, animated: false, viewPosition: 0.28 }), 120);
    }}
    contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 22 }}
    renderItem={({ item }) => {
      const start = sentence && Math.max(item.start, sentence.start);
      const end = sentence && Math.min(item.end, sentence.end);
      const marked = notes.some(note => note.index >= item.first && note.index < item.last);
      const heading = chapterHeadings.get(item.start);
      const plain = start === undefined || end === undefined || start >= end;
      return <View style={marked ? { borderLeftWidth: 3, borderLeftColor: palette.accent, paddingLeft: 8 } : undefined}>
        {heading && <Text accessibilityRole="header" style={{ color: palette.accent, fontFamily: serif,
          fontSize: fontSize + 4, marginVertical: 12 }}>{heading}</Text>}
        {item.pageHeading !== undefined && pageStarts && <Text accessibilityRole="header"
          style={{ color: palette.muted, paddingVertical: 10, marginBottom: 8 }}>Page {item.pageHeading} of {pageStarts.length}</Text>}
        <Text onPress={onTap} onLongPress={() => { if (item.first < item.last) onAnnotate(item.first); }}
          accessibilityActions={[{ name: "activate", label: "Toggle reader controls" }, ...(item.first < item.last ? [{ name: "listen", label: "Listen from this paragraph" }, { name: "annotate", label: "Add highlight or note" }] : [])]}
          onAccessibilityAction={({ nativeEvent }) => nativeEvent.actionName === "listen" ? onSelect(item.first) : nativeEvent.actionName === "annotate" ? onAnnotate(item.first) : onTap()}
          style={{ color: palette.ink, fontFamily: serif, fontSize, lineHeight: fontSize * 1.54, marginBottom: 18 }}>
          {plain ? content.slice(item.start, item.end) : <>
            {content.slice(item.start, start)}
            <Text style={{ backgroundColor: palette.highlight }}>{content.slice(start, end)}</Text>
            {content.slice(end, item.end)}
          </>}
        </Text>
      </View>;
    }} />;
}
