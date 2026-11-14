import { useEffect, useState } from "react";
import { File } from "expo-file-system";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { originalFile } from "../storage/originalFiles";
import { readerMedia } from "../storage/thumbnails";
import { IconButton } from "./Controls";
import { Button, ui, type Palette } from "./Design";

export function PdfReader({ id, page, total, text, move, openText, onTap, showNavigation, palette: p }: {
  id: string; page: number; total: number; text?: string; move(page: number): void; openText(): void; onTap(): void; showNavigation: boolean; palette: Palette;
}) {
  const [image, setImage] = useState<{uri: string; aspect: number}>();
  const [bounds, setBounds] = useState<Awaited<ReturnType<NonNullable<typeof readerMedia>["pdfHighlight"]>>>([]);
  const [matched, setMatched] = useState<{ page: number; text: string }>();
  const matchingCurrentPage = !!text && matched?.text === text && matched.page === page;
  const [unmatchedPage, setUnmatchedPage] = useState<number>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let uri: string | undefined;
    setImage(undefined);
    setFailed(false);
    const media = readerMedia;
    if (!media) { setFailed(true); return; }
    const remove = (path: string) => {
      const file = new File(path);
      if (file.exists) file.delete();
    };
    void media.pdfPage(originalFile(id).uri, page).then(result => {
      if (!active) { remove(result.uri); return; }
      uri = result.uri;
      setImage(result);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (uri) remove(uri); };
  }, [id, page]);
  useEffect(() => {
    let active = true;
    setBounds([]);
    setMatched(undefined);
    if (text) void readerMedia?.pdfHighlight(originalFile(id).uri, page, text)
      .then(result => { if (active) { setBounds(result); setMatched({ page, text }); if (!result.length) setUnmatchedPage(page); } }).catch(() => { if (active) { setMatched({ page, text }); setUnmatchedPage(page); } });
    return () => { active = false; };
  }, [id, page, text]);
  return <View style={{ flex: 1 }}>
    <ScrollView key={page} contentContainerStyle={{ padding: 8, paddingBottom: 58 }}>
      {image ? <Pressable accessibilityRole="button" accessibilityLabel="Toggle reader controls" onPress={onTap} style={{ width: "100%", aspectRatio: image.aspect, backgroundColor: p.pdfPaper }}>
        <Image source={{ uri: image.uri }} resizeMode="stretch" style={{ width: "100%", height: "100%" }} />
        {matchingCurrentPage && bounds.map((box, index) => <View key={index} pointerEvents="none" style={{ position: "absolute",
          backgroundColor: p.pdfHighlight, left: `${box.x * 100}%`, top: `${box.y * 100}%`,
          width: `${box.width * 100}%`, height: `${box.height * 100}%` }} />)}
      </Pressable> : <Text style={{ color: p.ink }}>{failed ? "Could not show this PDF page. Use Text view to keep reading." : "Opening page…"}</Text>}
    </ScrollView>
    {unmatchedPage === page && <View style={{ position: "absolute", left: 12, right: 12, bottom: showNavigation ? 49 : 8,
      backgroundColor: p.card, borderRadius: 12, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" }}>
      <Text style={{ flex: 1, color: p.muted }}>Some highlights are unavailable.</Text>
      <Button p={p} label="Text view" action={openText} />
    </View>}
    {showNavigation && <View style={[ui.row, { justifyContent: "space-between", paddingHorizontal: 12 }]}>
      <IconButton p={p} icon="chevron-left" label="Previous PDF page" disabled={page === 0} action={() => move(page - 1)} />
      <Text style={{ color: p.ink }}>Page {page + 1} of {total}</Text>
      <IconButton p={p} icon="chevron-right" label="Next PDF page" disabled={page + 1 >= total} action={() => move(page + 1)} />
    </View>}
  </View>;
}
