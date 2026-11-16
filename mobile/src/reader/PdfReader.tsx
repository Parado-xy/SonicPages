import { useEffect, useMemo, useState } from "react";
import { File } from "expo-file-system";
import { Image, NativeModules, Pressable, ScrollView, Text, View } from "react-native";
import { originalFile } from "../storage/originalFiles";
import { readerMedia } from "../storage/thumbnails";
import { IconButton } from "./Controls";
import { locatePdfRange, normalizePdfPage, type PdfTextGeometry, type TextRange } from "./pdfGeometry";
import { Button, ui, type Palette } from "./Design";

export function PdfReader({ id, page, total, pageText, range, move, openText, onTap, showNavigation, palette: p }: {
  id: string; page: number; total: number; pageText: string; range?: TextRange; move(page: number): void; openText(): void; onTap(): void; showNavigation: boolean; palette: Palette;
}) {
  const [image, setImage] = useState<{uri: string; aspect: number}>();
  const [geometry, setGeometry] = useState<{ page: number; value?: PdfTextGeometry }>();
  const needsGeometry = range !== undefined;
  const normalized = useMemo(() => geometry?.value && normalizePdfPage(geometry.value.text), [geometry]);
  const bounds = useMemo(() => geometry?.page === page && geometry.value && normalized && range
    ? locatePdfRange(geometry.value.spans, normalized, pageText, range) : [], [geometry, normalized, page, pageText, range?.start, range?.end]);
  const missingHighlight = needsGeometry && geometry?.page === page && !bounds.length;
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
    if (!pageText) return;
    let active = true;
    const native = NativeModules.SonicPagesPdfText as { pageTextGeometry(uri: string, page: number): Promise<PdfTextGeometry> } | undefined;
    const request = native?.pageTextGeometry?.(originalFile(id).uri, page) ?? Promise.resolve(undefined);
    void request.then(value => { if (active) setGeometry({ page, value }); })
      .catch(() => { if (active) setGeometry({ page }); });
    return () => { active = false; };
  }, [id, page, pageText]);
  return <View style={{ flex: 1 }}>
    <ScrollView key={page} contentContainerStyle={{ padding: 8, paddingBottom: 58 }}>
      {image ? <Pressable accessibilityRole="button" accessibilityLabel="Toggle reader controls" onPress={onTap} style={{ width: "100%", aspectRatio: image.aspect, backgroundColor: p.pdfPaper }}>
        <Image source={{ uri: image.uri }} resizeMode="stretch" style={{ width: "100%", height: "100%" }} />
        {bounds.map((box, index) => <View key={index} pointerEvents="none" style={{ position: "absolute",
          backgroundColor: p.pdfHighlight, left: `${box.x * 100}%`, top: `${box.y * 100}%`,
          width: `${box.width * 100}%`, height: `${box.height * 100}%` }} />)}
      </Pressable> : <Text style={{ color: p.ink }}>{failed ? "Could not show this PDF page. Use Text view to keep reading." : "Opening page…"}</Text>}
    </ScrollView>
    {missingHighlight && <View style={{ position: "absolute", left: 12, right: 12, bottom: showNavigation ? 49 : 8,
      backgroundColor: p.card, borderRadius: 12, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" }}>
      <Text style={{ flex: 1, color: p.muted }}>Some highlights are unavailable.</Text>
      <Button p={p} label="Text view" action={openText} />
    </View>}
    <View style={[ui.row, { justifyContent: "space-between", paddingHorizontal: 12, opacity: showNavigation ? 1 : 0 }]}
      pointerEvents={showNavigation ? "auto" : "none"} importantForAccessibility={showNavigation ? "auto" : "no-hide-descendants"}>
      <IconButton p={p} icon="chevron-left" label="Previous PDF page" disabled={page === 0} action={() => move(page - 1)} />
      <Text style={{ color: p.ink }}>Page {page + 1} of {total}</Text>
      <IconButton p={p} icon="chevron-right" label="Next PDF page" disabled={page + 1 >= total} action={() => move(page + 1)} />
    </View>
  </View>;
}
