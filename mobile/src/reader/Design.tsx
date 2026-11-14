import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRef } from "react";
import { useEffect, useState, type ReactNode } from "react";
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { thumbnail } from "../storage/thumbnails";

import { light, serif, type Palette } from "../theme/tokens";
export type { Palette } from "../theme/tokens";

export const ui = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  heading: { fontFamily: serif, fontSize: 27, flex: 1 },
  title: { fontFamily: serif, fontSize: 20 },
  section: { fontFamily: serif, fontSize: 23 },
  button: { minHeight: 48, minWidth: 48, paddingHorizontal: 10, justifyContent: "center", alignItems: "center", borderRadius: 24 },
  cover: { width: "100%", aspectRatio: 0.76, borderRadius: 8, overflow: "hidden", justifyContent: "center", alignItems: "center", padding: 12 },
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
    style={[ui.button, { backgroundColor: primary ? p.fill : selected ? p.highlight : "transparent", opacity: disabled ? 0.48 : 1 }]}>
    <Text style={{ color: primary ? p.onFill : selected ? p.accent : p.ink, fontWeight: "600", textAlign: "center" }}>{label}</Text>
  </Pressable>;
}

export function Cover({ id, format, title, p, compact }: { id: string; format: string; title: string; p: Palette; compact?: boolean }) {
  const [uri, setUri] = useState<string>();
  useEffect(() => {
    let live = true;
    void thumbnail(id, format).then(result => { if (live) setUri(result); });
    return () => { live = false; };
  }, [id, format]);
  return <View style={[ui.cover, { backgroundColor: p.card }]}>
    {uri ? <Image source={{ uri }} resizeMode="contain" accessibilityLabel={`${title} cover`}
      onError={() => setUri(undefined)} style={StyleSheet.absoluteFill} />
      : compact ? <Image source={require("../../assets/sonicpages-icon.png")} style={StyleSheet.absoluteFill} /> : <><Image source={require("../../assets/sonicpages-icon.png")} accessibilityIgnoresInvertColors style={{ width: 34, height: 34, borderRadius: 6, marginBottom: 8 }} /><Text numberOfLines={4} style={[ui.title, { color: p.ink, textAlign: "center" }]}>{title}</Text>
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
