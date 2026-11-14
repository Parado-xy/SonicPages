import Feather from "@expo/vector-icons/Feather";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { ComponentProps } from "react";
import { Cover, ui, type Palette } from "./Design";

export type IconName = ComponentProps<typeof Feather>["name"];

export function IconButton({ p, icon, label, action, selected, disabled, primary, busy, number }: {
  p: Palette; icon: IconName; label: string; action(): void; selected?: boolean; disabled?: boolean;
  primary?: boolean; busy?: boolean; number?: string;
}) {
  const color = primary ? p.onFill : selected ? p.accent : p.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled, busy: !!busy, ...(selected !== undefined && { selected }) }}
    onPress={action} disabled={disabled}
    style={[styles.button, { backgroundColor: primary ? p.fill : "transparent", opacity: disabled && !busy ? 0.38 : 1 }]}>
    {busy ? <ActivityIndicator color={color} /> : <Feather name={icon} color={color} size={22} />}
    {number && <Text allowFontScaling={false} style={{ fontSize: 10, color, marginTop: -3 }}>{number}</Text>}
  </Pressable>;
}

export type TransportProps = {
  p: Palette; playing: boolean; pending: boolean; disabled: boolean; canSeek: boolean;
  play(): void; skip(seconds: number): void;
};

export function Transport({ p, playing, pending, disabled, canSeek, play, skip }: TransportProps) {
  return <View style={ui.row}>
    <IconButton p={p} icon="rotate-ccw" number="15" label="Back 15 seconds" disabled={!canSeek} action={() => skip(-15)} />
    <IconButton p={p} primary icon={playing ? "pause" : "play"} label={playing ? "Pause" : "Play"} busy={pending} disabled={disabled} action={play} />
    <IconButton p={p} icon="rotate-cw" number="15" label="Forward 15 seconds" disabled={!canSeek} action={() => skip(15)} />
  </View>;
}

export function MiniPlayer({ document, subtitle, progress, expand, ...transport }: TransportProps & {
  document: { id: string; title: string; format: string };
  subtitle: string; progress: number; expand(): void;
}) {
  const { p } = transport;
  return <View style={[styles.pill, { backgroundColor: p.card }]}>
    <View style={ui.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open Now Playing, ${document.title}, ${subtitle}`}
        onPress={expand} style={[ui.row, { flex: 1, minHeight: 48 }]}>
        <View style={{ width: 29 }} accessible={false}><Cover {...document} p={p} compact /></View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: p.ink, fontWeight: "600" }}>{document.title}</Text>
          <Text numberOfLines={1} style={{ color: p.muted, fontSize: 12 }}>{subtitle}</Text>
        </View>
      </Pressable>
      <Transport {...transport} />
    </View>
    <ProgressLine p={p} progress={progress} />
  </View>;
}

export function ProgressLine({ p, progress }: { p: Palette; progress: number }) {
  return <View style={{ backgroundColor: p.line, height: 2, overflow: "hidden", borderRadius: 1 }}>
    <View style={{ backgroundColor: p.accent, height: 2, width: `${Math.max(0, Math.min(100, progress))}%` }} />
  </View>;
}

const styles = StyleSheet.create({
  button: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 30 },
  pill: { marginHorizontal: 10, marginBottom: 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, elevation: 4 },
});
