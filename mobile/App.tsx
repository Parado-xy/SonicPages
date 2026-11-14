import { useFonts } from "expo-font";
import { Newsreader_400Regular } from "@expo-google-fonts/newsreader/400Regular";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { dark, serif } from "./src/theme/tokens";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, FlatList, Image, Pressable, ScrollView, StatusBar, Text, View, type GestureResponderEvent } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { documentTypes, readDocument, readPdf } from "./src/imports/readDocument";
import { ExpoPlayer } from "./src/audio/expoPlayer";
import { NarrationController, type NarrationState } from "./src/narration/controller";
import { documentChunks } from "./src/reader/pdfPages";
import { PdfReader } from "./src/reader/PdfReader";
import { Library } from "./src/reader/Library";
import { Button, Cover, LibraryShelf, Paper, Sheet, ui } from "./src/reader/Design";
import { deleteThumbnail, readerMedia } from "./src/storage/thumbnails";
import { NARRATORS } from "./src/vendor/kokoro/models";
import { Reader } from "./src/reader/Reader";
import { cachedPassageAudio, kokoroEngine } from "./src/speech/kokoroEngine";
import { deleteDocumentAudio, speechStorageUsage } from "./src/storage/audioFiles";
import { originalFile } from "./src/storage/originalFiles";
import { exportDocument, exportNarration } from "./src/storage/exportFiles";
import { deleteDocument, saveMetadata, listDocuments, loadDocument, openDocument, renameDocument, preference, savePreference, saveDocument, savePosition, type LibraryEntry } from "./src/storage/readerStore";

const DEMO = {
  id: "demo-1",
  title: "Welcome to SonicPages",
  content: "Hello world. This is a test. SonicPages turns your documents into immersive listening experiences. Follow each passage as it plays. Your library stays on your device.",
};

export default function App() {
  const [loaded, error] = useFonts({ [serif]: Newsreader_400Regular });
  if (!loaded && !error) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
        <BottomSheetModalProvider><ReaderScreen /></BottomSheetModalProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>;
}

function ReaderScreen() {
  const { theme, setTheme, palette } = useTheme();
  const [screen, setScreen] = useState<"library" | "reader" | "player">("library");
  const [sheet, setSheet] = useState<"speed" | "voice" | "appearance" | "contents">();
  const [fontSize, setFontSize] = useState(() => Number(preference("fontSize")) || 21);
  const [rate, setRate] = useState(() => Number(preference("rate")) || 1);
  const [voice, setVoice] = useState(() => {
    const saved = preference("voice");
    if (saved && (saved.startsWith("device:") || NARRATORS.some(item => item.id === saved))) kokoroEngine.narrator = saved;
    return kokoroEngine.narrator;
  });
  const [device, setDevice] = useState<string>();
  const [previewing, setPreviewing] = useState<string>();
  const preview = useRef<AbortController>(null);
  const previewPlayer = useMemo(() => new ExpoPlayer(), []);
  const player = useRef<ExpoPlayer>(null);
  const speed = useRef(rate);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [pdfPageOverride, setPdfPageOverride] = useState<number>();
  const [pdfTextMode, setPdfTextMode] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const [document, setDocument] = useState(() => loadDocument(DEMO));
  const chunks = useMemo(() => documentChunks(document.id, document.content, document.pageStarts), [document]);
  const initial = { index: Math.min(document.index, Math.max(0, chunks.length - 1)), positionMs: document.positionMs };
  const [state, setState] = useState<NarrationState>({ ...initial, phase: "idle", highlightedIndex: null });
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState<string>();
  const [setupError, setSetupError] = useState<string>();
  const [library, setLibrary] = useState<LibraryEntry[] | null>(null);
  const [storage, setStorage] = useState({ voiceBytes: 0, audioBytes: 0 });
  const [libraryBusy, setLibraryBusy] = useState(false);
  const libraryOperation = useRef(false);
  const [importing, setImporting] = useState(false);
  const importInProgress = useRef(false);
  const setupInProgress = useRef(false);
  const controller = useRef<NarrationController>(null);

  useEffect(() => {
    const position = { index: Math.min(document.index, Math.max(0, chunks.length - 1)), positionMs: document.positionMs };
    setState({ ...position, phase: "idle", highlightedIndex: null });
    const audio = new ExpoPlayer();
    player.current = audio;
    audio.setRate(speed.current);
    const session = new NarrationController(kokoroEngine, audio, chunks, document.title, position,
      setState, progress => {
        try { savePosition(document.id, progress); }
        catch (error) { console.warn("Could not save SonicPages progress", error); }
      });
    controller.current = session;
    const lifecycle = AppState.addEventListener("change", next => {
      if (next !== "active") session.checkpoint();
    });
    return () => {
      lifecycle.remove();
      controller.current = null;
      player.current = null;
      session.stop();
    };
  }, [document, chunks]);

  const prepare = useCallback(async (offlineOnly = false) => {
    if (setupInProgress.current) return;
    setupInProgress.current = true;
    setSetupError(undefined);
    setSetup("Checking offline speech files…");
    try {
      await kokoroEngine.prepare(setSetup, offlineOnly);
      setReady(true);
    } catch (error) {
      console.warn("Voice setup failed", error);
      setSetupError(offlineOnly
        ? "Could not load the saved voice. Tap Retry setup."
        : "Voice setup failed. Check your connection and available storage, then retry.");
    } finally {
      setupInProgress.current = false;
      setSetup(undefined);
    }
  }, []);

  useEffect(() => {
    const id = kokoroEngine.narrator;
    if (id.startsWith("device:")) {
      void readerMedia?.deviceVoice().then(current => {
        if (kokoroEngine.narrator !== id) return;
        if (current && "device:" + current === id) setReady(true);
        else {
          kokoroEngine.narrator = NARRATORS[0].id;
          setVoice(NARRATORS[0].id);
          if (kokoroEngine.hasOfflineVoice()) void prepare(true);
        }
      }).catch(console.warn);
    } else if (kokoroEngine.hasOfflineVoice()) void prepare(true);
  }, [prepare]);

  useEffect(() => {
    setEntries(listDocuments());
  }, [document]);

  useEffect(() => {
    if (document.pageStarts || !document.sourceName?.toLowerCase().endsWith(".pdf")) return;
    const source = originalFile(document.id);
    if (!source.exists) return;
    let alive = true;
    void readPdf(source).then(result => {
      if (!alive) return;
      if (result.content !== document.content) return;
      controller.current?.stop();
      saveMetadata(document.id, result.title, result.pageStarts);
      setDocument(openDocument(document.id));
    }).catch(console.warn);
    return () => { alive = false; };
  }, [document]);

  const importDocument = async () => {
    if (importInProgress.current) return;
    importInProgress.current = true;
    setImporting(true);
    controller.current?.stop();
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: documentTypes, copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const file = new File(asset.uri);
      try {
        const result = await readDocument(file, asset.name, asset.mimeType);
        setPdfPageOverride(undefined);
        setDocument(saveDocument(asset.name, result.content, file, result));
        setScreen("reader");
      } finally {
        if (file.exists) file.delete();
      }
    } catch (error) {
      Alert.alert("Import failed", String(error));
    } finally {
      importInProgress.current = false;
      setImporting(false);
    }
  };

  const showLibrary = () => {
    try {
      controller.current?.checkpoint();
      setStorage(speechStorageUsage());
      setLibrary(listDocuments());
    } catch (error) {
      Alert.alert("Could not open the library", String(error));
    }
  };

  const switchDocument = (id: string) => {
    try {
      if (id !== document.id) {
        controller.current?.stop();
        setPdfPageOverride(undefined);
        setDocument(openDocument(id));
      }
      setLibrary(null);
      setScreen("reader");
    } catch (error) {
      Alert.alert("Could not open document", String(error));
    }
  };

  const updateTitle = (id: string, title: string) => {
    try {
      renameDocument(id, title);
      if (id === document.id) {
        controller.current?.stop();
        setDocument(openDocument(id));
      }
      setLibrary(listDocuments());
      setEntries(listDocuments());
      return true;
    } catch (error) {
      Alert.alert("Could not rename document", String(error));
      return false;
    }
  };

  const runLibraryOperation = async (operation: () => Promise<unknown>) => {
    if (libraryOperation.current) return;
    libraryOperation.current = true;
    setLibraryBusy(true);
    try {
      await operation();
      setStorage(speechStorageUsage());
    } catch (error) {
      Alert.alert("Library action failed", error instanceof Error ? error.message : String(error));
    } finally {
      libraryOperation.current = false;
      setLibraryBusy(false);
    }
  };

  const removeDocument = (id: string, title: string) => {
    Alert.alert("Delete document?", `“${title}” and its saved position and generated audio will be removed from SonicPages. Files outside the app are kept.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void runLibraryOperation(async () => {
        if (id === document.id) controller.current?.stop();
        deleteDocument(id);
        if (id === document.id) {
          const next = listDocuments()[0];
          setPdfPageOverride(undefined);
          setDocument(next ? openDocument(next.id) : loadDocument(DEMO));
        }
        const updated = listDocuments();
        setEntries(updated);
        setLibrary(updated);
        deleteDocumentAudio(id);
        const original = originalFile(id);
        if (original.exists) original.delete();
        await deleteThumbnail(id);
      }) },
    ]);
  };

  const clearAudio = () => {
    Alert.alert("Clear generated audio?", "Your documents, voice download, and reading positions are kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear audio", style: "destructive", onPress: () => void runLibraryOperation(async () => {
        controller.current?.stop();
        await kokoroEngine.clearGeneratedAudio();
        setLibrary(listDocuments());
      }) },
    ]);
  };

  const status = setup ?? setupError ?? (state.phase === "error" ? state.error : {
    generating: "Preparing passage on this device…",
    buffering: "Buffering audio…",
    playing: "Listening",
    paused: "Paused",
    finished: "End of document",
    idle: ready ? "Ready to listen offline" : "Prepare Kokoro for offline listening (93 MB on first setup)",
  }[state.phase]);

  const pdfPage = pdfPageOverride ?? chunks[state.index]?.pageIndex ?? 0;
  const totalPages = document.pageStarts?.length ?? 0;
  const play = () => {
    if (pdfPageOverride !== undefined && ready) {
      const start = chunks.findIndex(chunk => (chunk.pageIndex ?? -1) >= pdfPageOverride);
      setPdfPageOverride(undefined);
      if (start >= 0) void controller.current?.listen(start);
      return;
    }
    if (preview.current && !preview.current.signal.aborted) preview.current.abort();
    if (libraryOperation.current) return;
    if (!ready) { void prepare(); return; }
    controller.current?.toggle();
  };
  const selectPassage = (index: number) => {
    if (!ready) { void prepare(); return; }
    setPdfPageOverride(undefined);
    if (!importing && chunks[index]) void controller.current?.listen(index);
  };
  const closeSheet = () => { preview.current?.abort(); setPreviewing(undefined); setSheet(undefined); };
  const openVoice = () => {
    setSheet("voice");
    void readerMedia?.deviceVoice().then(id => setDevice(id ? "device:" + id : undefined)).catch(() => setDevice(undefined));
  };
  const chooseVoice = async (id: string, listen: boolean) => {
    if (setupInProgress.current) return;
    setupInProgress.current = true;
    preview.current?.abort();
    const request = new AbortController();
    preview.current = request;
    controller.current?.stop();
    setSetupError(undefined);
    setSetup("Preparing voice…");
    try {
      await kokoroEngine.prepare(setSetup, false, id);
      if (request.signal.aborted) return;
      if (!listen) {
        kokoroEngine.narrator = id;
        setVoice(id);
        savePreference("voice", id);
        setReady(true);
        closeSheet();
      } else {
        setPreviewing(id);
        const clip = await kokoroEngine.synthesize({
          id: "preview:0", documentId: "voice-preview", startChar: 0, endChar: 42,
          text: "Settle in, and let the story carry you.",
        }, request.signal, id);
        if (!request.signal.aborted) {
          setSetup(undefined);
          await previewPlayer.play(clip.localAudioUri, "Voice preview", 0, request.signal, () => {}, false);
        }
        request.abort();
      }
    } catch (error) {
      if (!request.signal.aborted) Alert.alert("Voice unavailable", String(error));
    } finally {
      request.abort();
      setupInProgress.current = false;
      setPreviewing(undefined);
      setSetup(undefined);
    }
  };
  const active = entries.find(entry => entry.id === document.id) ?? { ...document, format: "TXT" };
  const narratorLabel = NARRATORS.find(item => item.id === voice)?.label ?? "Device voice";
  const playing = state.phase === "playing";
  const pending = !!setup || importing || state.phase === "generating" || state.phase === "buffering";
  const elapsed = Math.floor(state.positionMs / 1000);
  const passage = totalPages ? `Page ${(chunks[state.index]?.pageIndex ?? 0) + 1} of ${totalPages}` : `Passage ${Math.min(state.index + 1, chunks.length)} of ${chunks.length}`;
  const hasTimeline = !!state.durationMs && state.highlightedIndex !== null;
  const progress = hasTimeline ? Math.min(1, state.positionMs / state.durationMs!) : 0;
  const seek = (event: GestureResponderEvent) => {
    if (hasTimeline && trackWidth) {
      void controller.current?.seek(event.nativeEvent.locationX / trackWidth * state.durationMs!).catch(console.warn);
    }
  };
  const skip = (seconds: number) => {
    void controller.current?.skip(seconds * 1000, index => chunks[index]
      ? cachedPassageAudio(chunks[index], voice)?.durationMs : undefined).catch(console.warn);
  };

  return <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
    <StatusBar barStyle={palette === dark ? "light-content" : "dark-content"} />
    <Paper palette={palette}>
      <View style={[ui.header, { borderColor: palette.line }]}>
        {screen === "library" && <Image source={require("./assets/sonicpages-icon.png")} style={{ width: 38, height: 38, borderRadius: 8 }} />}
        {screen === "reader" && <Button p={palette} label="‹" accessibilityLabel="Back to Library" action={() => setScreen("library")} />}
        <Text accessibilityRole="header" numberOfLines={2} style={[ui.heading, { color: palette.ink }]}>
          {screen === "library" ? "My Library" : screen === "player" ? "Now Playing" : document.title}
        </Text>
        {screen === "library"
          ? <Button p={palette} label="Import" action={() => void importDocument()} disabled={importing || libraryBusy} />
          : <Button p={palette} label={screen === "reader" ? "Aa" : "Read"} action={() => screen === "reader" ? setSheet("appearance") : setScreen("reader")} />}
        {screen === "reader" && totalPages > 0 && <Button p={palette} label={pdfTextMode ? "Page" : "Text"}
          accessibilityLabel={pdfTextMode ? "Show original PDF page" : "Show text view"} action={() => setPdfTextMode(!pdfTextMode)} />}
        {screen !== "reader" && <Button p={palette} label="Aa" accessibilityLabel="Appearance" action={() => setSheet("appearance")} />}
      </View>

      {screen === "library" && <LibraryShelf entries={entries} active={{ ...active, index: state.index }} p={palette}
        open={switchDocument} play={play} playing={playing} controls={showLibrary} disabled={pending} />}
      {screen === "reader" && totalPages > 0 && !pdfTextMode
        ? <PdfReader key={document.id} id={document.id} page={pdfPage} total={totalPages}
            text={pdfPageOverride === undefined && state.highlightedIndex !== null ? chunks[state.highlightedIndex]?.text : undefined}
            move={page => { controller.current?.stop(); setPdfPageOverride(page); }} palette={palette} />
        : screen === "reader" && <Reader key={document.id} chunks={chunks} index={state.index} highlightedIndex={state.highlightedIndex}
        onSelect={selectPassage} palette={palette} fontSize={fontSize} />}
      {screen === "player" && <ScrollView contentContainerStyle={{ padding: 20, gap: 12, alignItems: "center", flexGrow: 1, justifyContent: "center" }}>
        <View style={{ width: "68%", maxWidth: 245 }}>
          <Cover key={document.id} id={document.id} title={document.title} format={active.format} p={palette} />
        </View>
        <Text numberOfLines={2} ellipsizeMode="tail" style={[ui.heading, { color: palette.ink, flex: 0, textAlign: "center", maxWidth: "100%" }]}>{document.title}</Text>
        <Text style={{ color: palette.muted }}>{passage}</Text>
        <Pressable accessibilityRole="adjustable" accessibilityLabel="Position in current passage" disabled={!hasTimeline}
          accessibilityValue={{ min: 0, max: Math.max(1, Math.round((state.durationMs ?? 0) / 1000)), now: elapsed }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={event => skip(event.nativeEvent.actionName === "increment" ? 15 : -15)}
          onLayout={event => setTrackWidth(event.nativeEvent.layout.width)} onPress={seek}
          style={{ width: "100%", height: 44, justifyContent: "center" }}>
          <View pointerEvents="none" style={{ height: 5, backgroundColor: palette.line, borderRadius: 4 }}>
            <View style={{ width: `${progress * 100}%`, height: 5, backgroundColor: palette.accent, borderRadius: 4 }} />
          </View>
          <Text pointerEvents="none" style={{ color: palette.muted, marginTop: 5 }}>{hasTimeline ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")} in passage` : passage}</Text>
        </Pressable>
        <View style={[ui.row, { gap: 14 }]}>
          <Button p={palette} label="↶ 15" accessibilityLabel="Back 15 seconds" action={() => skip(-15)} disabled={!hasTimeline} />
          <Button p={palette} primary label={playing ? "Ⅱ Pause" : "▶ Play"} action={play} disabled={pending} />
          <Button p={palette} label="15 ↷" accessibilityLabel="Forward 15 seconds" action={() => skip(15)} disabled={!hasTimeline} />
        </View>
        <View style={[ui.row, { flexWrap: "wrap", justifyContent: "center" }]}>
          <Button p={palette} label={`Speed ${rate}×`} action={() => setSheet("speed")} />
          <Button p={palette} label={`Voice ${narratorLabel}`} action={openVoice} />
          <Button p={palette} label="Contents" action={() => setSheet("contents")} />
        </View>
      </ScrollView>}

      {screen !== "library" && <View style={[ui.dock, { borderColor: palette.line, backgroundColor: palette.card }]}>
        <Text accessibilityLiveRegion="polite" style={{ color: palette.muted }}>{status}</Text>
        {pending && <ActivityIndicator color={palette.accent} />}
        <View style={[ui.row, { justifyContent: "space-between" }]}>
          {screen === "reader" && <>
            <Button p={palette} label="|◀" accessibilityLabel="Previous passage" action={() => selectPassage(state.index - 1)} disabled={state.index <= 0 || pending} />
            <Button p={palette} primary label={playing ? "Ⅱ" : "▶"} accessibilityLabel={playing ? "Pause" : "Play"} action={play} disabled={pending} />
            <Button p={palette} label="▶|" accessibilityLabel="Next passage" action={() => selectPassage(state.index + 1)} disabled={state.index + 1 >= chunks.length || pending} />
            <Button p={palette} label={`${rate}×`} action={() => setSheet("speed")} />
          </>}
          {screen === "reader" && <Text style={{ color: palette.muted, flexShrink: 1 }}>{passage}</Text>}
          {screen === "player" && <Button p={palette} label="Stop" action={() => controller.current?.stop()} disabled={!playing && state.phase !== "paused" && !pending} />}
        </View>
      </View>}
      {screen === "library" && (ready || pending) && <View style={[ui.dock, ui.row, { borderColor: palette.line, backgroundColor: palette.card }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Now Playing" onPress={() => setScreen("player")} style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: palette.ink, fontWeight: "600" }}>{document.title}</Text>
          <Text style={{ color: palette.muted }}>{pending ? status : passage}</Text>
        </Pressable>
        <Button p={palette} primary label={playing ? "Ⅱ" : "▶"} accessibilityLabel={playing ? "Pause" : "Play"} action={play} disabled={pending} />
      </View>}
      {screen !== "reader" && <View style={[ui.tabs, { borderColor: palette.line, backgroundColor: palette.bg }]}>
        <Button p={palette} label="Library" selected={screen === "library"} action={() => { controller.current?.checkpoint(); setEntries(listDocuments()); setScreen("library"); }} />
        <Button p={palette} label="Now Playing" selected={screen === "player"} action={() => setScreen("player")} />
      </View>}
    </Paper>

    {sheet === "speed" && <Sheet title="Playback speed" close={closeSheet} p={palette}>
      <View style={[ui.row, { flexWrap: "wrap" }]}>{[0.75, 1, 1.25, 1.5, 2].map(value =>
        <Button key={value} p={palette} label={`${value}×`} selected={rate === value} action={() => {
          speed.current = value; player.current?.setRate(value); setRate(value); savePreference("rate", String(value)); closeSheet();
        }} />)}</View>
    </Sheet>}
    {sheet === "appearance" && <Sheet title="Appearance" close={closeSheet} p={palette}>
      <View style={ui.row}>{(["system", "light", "dark"] as const).map(value =>
        <Button key={value} p={palette} label={value[0].toUpperCase() + value.slice(1)} selected={theme === value} action={() => setTheme(value)} />)}</View>
      <View style={ui.row}><Text style={{ color: palette.ink, flex: 1 }}>Reading text size</Text>
        <Button p={palette} label="A−" action={() => { const size = Math.max(16, fontSize - 1); setFontSize(size); savePreference("fontSize", String(size)); }} />
        <Button p={palette} label="A+" action={() => { const size = Math.min(32, fontSize + 1); setFontSize(size); savePreference("fontSize", String(size)); }} />
      </View>
    </Sheet>}
    {sheet === "voice" && <Sheet title="Narration voice" close={closeSheet} p={palette}>
      {!!setup && <Text style={{ color: palette.muted }}>{setup}</Text>}
      {[...NARRATORS, { id: device ?? "device-unavailable", label: "Device voice", description: device ? "System text-to-speech · Offline ready" : "No installed offline system voice" }].map(item => {
        const offline = item.id === device || kokoroEngine.hasOfflineVoice(item.id);
        const disabled = !!setup || !!previewing || item.id === "device-unavailable";
        return <View key={item.id} style={ui.row}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: voice === item.id, disabled }} disabled={disabled}
            onPress={() => void chooseVoice(item.id, false)}
            style={{ flex: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: 10, borderRadius: 8, backgroundColor: voice === item.id ? palette.highlight : palette.card }}>
            <Text style={{ color: palette.ink, fontWeight: "600" }}>{item.label}{voice === item.id ? "  ✓" : ""}</Text>
            <Text style={{ color: palette.muted }}>{item.description}{offline && item.id !== device ? " · Offline ready" : ""}</Text>
          </Pressable>
          <Button p={palette} label={previewing === item.id ? "■" : "▶"} accessibilityLabel={`Preview ${item.label}`}
            disabled={disabled && previewing !== item.id} action={() => previewing === item.id ? preview.current?.abort() : void chooseVoice(item.id, true)} />
        </View>;
      })}
    </Sheet>}
    {sheet === "contents" && <Sheet title="Passages" close={closeSheet} p={palette}>
      <FlatList style={{ maxHeight: 280 }} data={chunks} keyExtractor={chunk => chunk.id}
        initialScrollIndex={chunks.length ? Math.min(state.index, chunks.length - 1) : undefined}
        getItemLayout={(_, index) => ({ index, length: 52, offset: 52 * index })}
        renderItem={({ item, index }) => <Pressable accessibilityRole="button"
          onPress={() => { closeSheet(); selectPassage(index); }}
          style={{ height: 52, padding: 8, backgroundColor: index === state.index ? palette.highlight : palette.bg }}>
          <Text numberOfLines={2} style={{ color: palette.ink }}>{index + 1}. {item.text.trim()}</Text>
        </Pressable>} />
    </Sheet>}
    {library && <Library palette={palette} entries={library} activeId={document.id} close={() => setLibrary(null)}
      open={switchDocument} remove={removeDocument} rename={updateTitle} storage={storage} busy={libraryBusy} clear={clearAudio}
      exportFile={(id, kind) => void runLibraryOperation(() => kind === "document" ? exportDocument(id) : exportNarration(id, voice))} />}
  </SafeAreaView>;
}
