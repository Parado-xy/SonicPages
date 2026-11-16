import { Notes, type ReaderNote } from "./src/reader/Notes";
import { extractEpubContents } from "./src/imports/epub";
import { NavigationContainer, createNavigationContainerRef, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LibraryShelf } from "./src/reader/LibraryShelf";
import { IconButton, MiniPlayer, ProgressLine, Transport } from "./src/reader/Controls";
import TabIcon from "@expo/vector-icons/Feather";
import Slider from "@react-native-community/slider";
import { DocumentOptions } from "./src/reader/DocumentOptions";
import { Contents, type ContentsEntry } from "./src/reader/Contents";
import { displayTitle } from "./src/imports/documentTitle";
import { useFonts } from "expo-font";
import { Newsreader_400Regular } from "@expo-google-fonts/newsreader/400Regular";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { dark, serif } from "./src/theme/tokens";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, BackHandler, Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { documentTypes, readDocument, readPdf } from "./src/imports/readDocument";
import { ExpoPlayer } from "./src/audio/expoPlayer";
import { NarrationController, type NarrationState } from "./src/narration/controller";
import { documentChunks } from "./src/reader/pdfPages";
import { PdfReader } from "./src/reader/PdfReader";
import { Button, Cover, Paper, Sheet, ui } from "./src/reader/Design";
import { deleteThumbnail, readerMedia, thumbnail } from "./src/storage/thumbnails";
import { NARRATORS } from "./src/vendor/kokoro/models";
import { sentenceAt } from "./src/reader/sentence";
import { Reader } from "./src/reader/Reader";
import { cachedPassageAudio, kokoroEngine } from "./src/speech/kokoroEngine";
import { deleteDocumentAudio, speechStorageUsage } from "./src/storage/audioFiles";
import { originalFile, originalsSize } from "./src/storage/originalFiles";
import { exportDocument, exportNarration } from "./src/storage/exportFiles";
import { deleteDocument, saveMetadata, listDocuments, loadDocument, openDocument, renameDocument, preference, savePreference, saveDocument, savePosition, type LibraryEntry } from "./src/storage/readerStore";

const Tabs = createBottomTabNavigator<{ Library: undefined; "Now Playing": undefined }>();

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
  const navigation = useMemo(() => createNavigationContainerRef<{ Library: undefined; "Now Playing": undefined }>(), []);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readingChrome, setReadingChrome] = useState(true);
  const [showScan, setShowScan] = useState(false);
  const [bookmark, setBookmark] = useState<string>();
  const setScreen = (next: "library" | "reader" | "player") => {
    setReaderOpen(next === "reader");
    if (next === "reader") setReadingChrome(true);
    else if (navigation.isReady()) navigation.navigate(next === "library" ? "Library" : "Now Playing");
  };
  useEffect(() => {
    if (!readerOpen && !contentsOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (contentsOpen) { setContentsOpen(false); return true; }
      setScreen("library");
      controller.current?.checkpoint();
      setEntries(listDocuments());
      return true;
    });
    return () => subscription.remove();
  }, [contentsOpen, readerOpen]);
  type SheetName = "speed" | "voice" | "appearance" | "storage" | "menu" | "textSize" | "listen" | "progress" | "notes";
  const currentSheet = useRef<SheetName | undefined>(undefined);
  const [sheet, updateSheet] = useState<SheetName>();
  const setSheet = (next?: SheetName) => { currentSheet.current = next; updateSheet(next); };
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
  const [navigateTo, setNavigateTo] = useState<number>();
  const [processing, setProcessing] = useState<{ raw: string; title: string }>();
  const [document, setDocument] = useState(() => loadDocument(DEMO));
  const chunks = useMemo(() => documentChunks(document.id, document.content, document.pageStarts), [document]);
  const [notes, setNotes] = useState<ReaderNote[]>([]);
  const [noteIndex, setNoteIndex] = useState<number>();
  const [chapters, setChapters] = useState<{ title: string; offset: number }[]>([]);
  useEffect(() => {
    setNotes(JSON.parse(preference("notes:" + document.id) ?? "[]") as ReaderNote[]);
    setNoteIndex(undefined);
  }, [document.id]);
  useEffect(() => {
    const source = originalFile(document.id);
    setChapters([]);
    if (!document.sourceName?.toLowerCase().endsWith(".epub") || !source.exists) return;
    let active = true;
    void source.bytes().then(extractEpubContents).then(items => { if (active) setChapters(items); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [document.id, document.sourceName]);
  const updateNotes = (next: ReaderNote[]) => {
    savePreference("notes:" + document.id, JSON.stringify(next));
    setNotes(next);
  };
  const initial = { index: Math.min(document.index, Math.max(0, chunks.length - 1)), positionMs: document.positionMs };
  const [state, setState] = useState<NarrationState>({ ...initial, phase: "idle", highlightedIndex: null });
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState<string>();
  const [setupError, setSetupError] = useState<string>();
  const [options, setOptions] = useState<LibraryEntry>();
  const [storage, setStorage] = useState({ voiceBytes: 0, audioBytes: 0, documents: 0 });
  const [libraryBusy, setLibraryBusy] = useState(false);
  const libraryOperation = useRef(false);
  const [importing, setImporting] = useState(false);
  const importInProgress = useRef(false);
  const setupInProgress = useRef(false);
  const controller = useRef<NarrationController>(null);

  useEffect(() => {
    const position = { index: Math.min(document.index, Math.max(0, chunks.length - 1)), positionMs: document.positionMs };
    setState({ ...position, phase: "idle", highlightedIndex: null });
    setShowScan(false);
    setBookmark(preference("bookmark:" + document.id));
    const page = Number(preference("pdfPage:" + document.id) || NaN);
    setPdfPageOverride(Number.isInteger(page) && page >= 0 && page < (document.pageStarts?.length ?? 0) ? page : undefined);
    const audio = new ExpoPlayer();
    player.current = audio;
    audio.setRate(speed.current);
    let savedPercent = preference("percent:" + document.id);
    const session = new NarrationController(kokoroEngine, audio, chunks, document.title, position,
      setState, progress => {
        try {
          savePosition(document.id, progress);
          const percent = chunks.length > 1 ? Math.round(100 * progress.index / (chunks.length - 1)) : 0;
          if (savedPercent !== String(percent)) {
            savedPercent = String(percent);
            savePreference("percent:" + document.id, savedPercent);
          }
        }
        catch (error) { console.warn("Could not save SonicPages progress", error); }
      }, () => thumbnail(document.id, document.pageStarts?.length ? "PDF" : document.sourceName?.toLowerCase().endsWith(".epub") ? "EPUB" : "TXT"));
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
      saveMetadata(document.id, result.title, result.pageStarts, result.author);
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
      setProcessing({ raw: asset.name, title: displayTitle(asset.name) });
      const file = new File(asset.uri);
      try {
        const result = await readDocument(file, asset.name, asset.mimeType);
        setPdfPageOverride(undefined);
        setNavigateTo(undefined);
        setPdfTextMode(false);
        setDocument(saveDocument(asset.name, result.content, file, result));
        setScreen("reader");
      } finally {
        if (file.exists) file.delete();
      }
    } catch (error) {
      Alert.alert("Import failed", String(error));
    } finally {
      importInProgress.current = false;
      setProcessing(undefined);
      setImporting(false);
    }
  };

  const showLibrary = () => {
    try {
      controller.current?.checkpoint();
      setStorage({ ...speechStorageUsage(), documents: originalsSize() });
      setEntries(listDocuments());
    } catch (error) {
      Alert.alert("Could not open the library", String(error));
    }
  };

  const switchDocument = (id: string) => {
    try {
      if (id !== document.id) {
        controller.current?.stop();
        setPdfPageOverride(undefined);
        setPdfTextMode(false);
        setDocument(openDocument(id));
      }
      setOptions(undefined);
      setNavigateTo(undefined);
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
      setStorage({ ...speechStorageUsage(), documents: originalsSize() });
    } catch (error) {
      Alert.alert("Library action failed", error instanceof Error ? error.message : String(error));
    } finally {
      libraryOperation.current = false;
      setLibraryBusy(false);
    }
  };

  const removeDocument = (id: string) => void runLibraryOperation(async () => {
    if (id === document.id) controller.current?.stop();
    deleteDocument(id);
    const updated = listDocuments();
    if (id === document.id) {
      setPdfPageOverride(undefined);
      setNavigateTo(undefined);
      setDocument(updated.length ? openDocument(updated[0].id) : { ...DEMO, index: 0, positionMs: 0 });
    }
    setEntries(updated);
    deleteDocumentAudio(id);
    const original = originalFile(id);
    if (original.exists) original.delete();
    await deleteThumbnail(id);
  });

  const clearAudio = () => {
    Alert.alert("Clear generated audio?", "Your documents, voice download, and reading positions are kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear audio", style: "destructive", onPress: () => void runLibraryOperation(async () => {
        controller.current?.stop();
        await kokoroEngine.clearGeneratedAudio();
        setEntries(listDocuments());
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

  const pdfPage = pdfPageOverride ?? chunks[navigateTo ?? state.index]?.pageIndex ?? 0;
  const totalPages = document.pageStarts?.length ?? 0;
  const play = () => {
    if (!chunks.length || !entries.length) return;
    if (navigateTo !== undefined && ready) {
      setNavigateTo(undefined);
      setPdfPageOverride(undefined);
      if (totalPages) savePreference("pdfPage:" + document.id, "");
      void controller.current?.listen(navigateTo);
      return;
    }
    if (pdfPageOverride !== undefined && ready) {
      const start = chunks.findIndex(chunk => (chunk.pageIndex ?? -1) >= pdfPageOverride);
      if (start >= 0) selectPassage(start);
      return;
    }
    if (preview.current && !preview.current.signal.aborted) preview.current.abort();
    if (libraryOperation.current) return;
    if (!ready) { openVoice(); return; }
    controller.current?.toggle();
  };
  const selectPassage = (index: number) => {
    if (!ready) { openVoice(); return; }
    setPdfPageOverride(undefined);
    setNavigateTo(undefined);
    if (!importing && chunks[index]) {
      if (totalPages && pdfPageOverride !== undefined) savePreference("pdfPage:" + document.id, "");
      void controller.current?.listen(index);
    }
  };
  const closeSheet = () => { preview.current?.abort(); setPreviewing(undefined); setSheet(undefined); };
  const dismissSheet = (name: SheetName) => () => { if (currentSheet.current === name) closeSheet(); };
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
      await kokoroEngine.prepare(setSetup, false, id, request.signal);
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
  const waitingForAudio = state.phase === "generating" || state.phase === "buffering";
  const [showBuffering, setShowBuffering] = useState(false);
  useEffect(() => {
    if (!waitingForAudio) { setShowBuffering(false); return; }
    const timer = setTimeout(() => setShowBuffering(true), 550);
    return () => clearTimeout(timer);
  }, [waitingForAudio]);
  const passage = totalPages ? `Page ${pdfPage + 1} of ${totalPages}` : `Passage ${Math.min((navigateTo ?? state.index) + 1, chunks.length)} of ${chunks.length}`;
  const hasTimeline = !!state.durationMs && state.highlightedIndex !== null;
  const playable = chunks.length > 0 && entries.length > 0;
  const controlsDisabled = pending || !playable;
  const jump = (entry: ContentsEntry, narrate: boolean, dismiss = true) => {
    const index = entry.offset !== undefined ? chunks.findIndex(chunk => chunk.endChar > entry.offset!)
      : totalPages ? chunks.findIndex(chunk => (chunk.pageIndex ?? -1) >= (entry.page ?? 0)) : entry.page ?? -1;
    if (dismiss) { closeSheet(); setContentsOpen(false); }
    if (!readerOpen) setScreen("reader");
    if (narrate && index >= 0 && ready) { selectPassage(index); return; }
    controller.current?.stop();
    setNavigateTo(index >= 0 ? index : undefined);
    if (totalPages && entry.page !== undefined) setPdfPageOverride(entry.page);
    if (index >= 0) savePosition(document.id, { index, positionMs: 0 });
    if (totalPages && entry.page !== undefined) savePreference("pdfPage:" + document.id, String(entry.page));
    if (narrate && index >= 0) openVoice();
  };
  const skip = (seconds: number) => {
    void controller.current?.skip(seconds * 1000, index => chunks[index]
      ? cachedPassageAudio(chunks[index], voice)?.durationMs : undefined).catch(console.warn);
  };

  const readingIndex = navigateTo ?? state.index;
  const readingPercent = chunks.length > 1 ? Math.round(100 * readingIndex / (chunks.length - 1)) : 0;
  const bookProgress = state.phase === "finished" ? 100 : totalPages ? Math.floor(100 * pdfPage / totalPages) : readingPercent;
  const remaining = 100 - bookProgress;
  const transport = { p: palette, playing: playing || waitingForAudio, pending: showBuffering || !!setup || importing,
    disabled: controlsDisabled, canSeek: hasTimeline && !pending, play, skip };
  const subtitle = `${passage} · ${remaining}% left · ${narratorLabel} · ${rate}×`;
  const miniPlayer = <MiniPlayer {...transport} document={active} subtitle={subtitle}
    progress={bookProgress} expand={() => setScreen("player")} />;
  const toggleChrome = () => setReadingChrome(value => !value);
  const move = (index: number) => jump({ title: "", depth: 0, page: index }, false, false);
  const location = totalPages ? pdfPage : readingIndex;
  const locations = totalPages || chunks.length;
  const bookmarkValue = String(location);
  const bookmarkKey = "bookmark:" + document.id;
  const spokenChunk = state.highlightedIndex === null ? undefined : chunks[state.highlightedIndex];
  const spokenSentence = spokenChunk?.pageIndex === pdfPage && spokenChunk && sentenceAt(document.content, spokenChunk);
  const pageStart = document.pageStarts?.[pdfPage] ?? 0;
  const pageText = totalPages ? document.content.slice(pageStart, document.pageStarts?.[pdfPage + 1]).trimEnd() : "";
  const pdfRange = pdfPageOverride === undefined && spokenSentence ? {
    start: Math.max(0, spokenSentence.start - pageStart),
    end: Math.min(pageText.length, spokenSentence.end - pageStart),
  } : undefined;
  const immersiveReader = readerOpen && !contentsOpen;
  const keepReaderAwake = immersiveReader && !playing && !pending;
  useEffect(() => {
    readerMedia?.setReadingAwake?.(keepReaderAwake);
    return () => readerMedia?.setReadingAwake?.(false);
  }, [keepReaderAwake]);
  const scanIntro = totalPages > 0 && !chunks.length && !showScan;
  const colors = {
    ...(palette === dark ? DarkTheme : DefaultTheme).colors,
    background: palette.bg, card: palette.bg, text: palette.ink, primary: palette.accent, border: palette.line,
  };

  const library = <Paper palette={palette}>
    <LibraryShelf entries={entries} active={{ ...active, index: state.index }} p={palette} open={switchDocument}
      expand={() => setScreen("player")} play={play} playing={playing} importFile={() => { if (!libraryBusy) void importDocument(); }}
      options={setOptions} importing={processing} disabled={controlsDisabled} menu={() => setSheet("menu")}
      progress={item => item.id === document.id && readingPercent ? `${readingPercent}%` : item.progress ? `${item.progress}%` : item.format} />
    {!!entries.length && miniPlayer}
  </Paper>;

  const currentChunk = chunks[state.highlightedIndex ?? readingIndex];
  const currentSentence = currentChunk && sentenceAt(document.content, currentChunk);
  const transcript = useMemo(() => {
    if (!currentSentence) return [];
    const before = chunks.findLast(chunk => chunk.endChar <= currentSentence.start);
    const after = chunks.find(chunk => chunk.startChar >= currentSentence.end);
    return [before && sentenceAt(document.content, before), currentSentence, after && sentenceAt(document.content, after)]
      .filter(item => item !== undefined);
  }, [currentSentence?.start, currentSentence?.end, chunks, document.content]);

  const nowPlaying = <Paper palette={palette}>
    {!entries.length ? <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
      <Text style={[ui.heading, { color: palette.ink, flex: 0 }]}>Nothing playing</Text>
      <Button p={palette} label="Open Library" action={() => setScreen("library")} />
    </View> : <>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10, alignItems: "center", flexGrow: 1, justifyContent: "center" }}>
        <View style={{ width: "48%", maxWidth: 205 }}><Cover key={document.id} {...active} p={palette} /></View>
        <Text accessibilityRole="header" numberOfLines={2} style={[ui.heading, { color: palette.ink, flex: 0, textAlign: "center" }]}>{document.title}</Text>
        <Text style={{ color: palette.muted, textAlign: "center" }}>{document.author || "Unknown author"}</Text>
        <View style={{ width: "100%" }}>
          <ProgressLine p={palette} progress={bookProgress} />
          <View style={[ui.row, { justifyContent: "space-between", marginTop: 8 }]}>
            <Text style={{ color: palette.muted }}>{passage}</Text>
            <Text style={{ color: palette.muted }}>{remaining}% left</Text>
          </View>
        </View>
        <Text accessibilityLiveRegion="polite" numberOfLines={1} style={{ color: palette.muted, minHeight: 21 }}>
          {waitingForAudio ? showBuffering ? "Buffering…" : "Listening" : status}
        </Text>
        {!!chunks.length && <View style={{ width: "100%", gap: 8 }}>
          {transcript.map(({ start, end }) => <Text key={start} numberOfLines={start === currentSentence?.start ? 6 : 2}
            style={{ padding: 8, borderRadius: 8, color: start === currentSentence?.start ? palette.ink : palette.muted,
              backgroundColor: start === currentSentence?.start ? palette.highlight : "transparent", textAlign: "center" }}>
            {document.content.slice(start, end).trim()}
          </Text>)}
        </View>}
        <Button p={palette} label="Read" action={() => setScreen("reader")} />
      </ScrollView>
      <View style={{ paddingVertical: 8, alignItems: "center" }}>
        <View style={[ui.row, { justifyContent: "space-evenly", alignSelf: "stretch", flexWrap: "wrap" }]}>
          <Button p={palette} label={narratorLabel} accessibilityLabel={`Voice, ${narratorLabel}`} action={openVoice} />
          <Button p={palette} label={`${rate}×`} accessibilityLabel={`Speed, ${rate} times`} action={() => setSheet("speed")} />
          <Button p={palette} label="Contents" action={() => setContentsOpen(true)} />
        </View>
        <Transport {...transport} />
      </View>
    </>}
  </Paper>;

  return <SafeAreaView edges={immersiveReader ? ["left", "right"] : ["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.bg }}>
    <StatusBar hidden={immersiveReader} barStyle={palette === dark ? "light-content" : "dark-content"} />
    <View style={{ flex: 1, display: readerOpen || contentsOpen ? "none" : "flex" }}>
      <NavigationContainer ref={navigation} theme={{ ...(palette === dark ? DarkTheme : DefaultTheme), colors }}>
        <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.accent,
          tabBarInactiveTintColor: palette.muted }}>
          <Tabs.Screen name="Library" listeners={{ focus: () => { controller.current?.checkpoint(); setEntries(listDocuments()); } }}
            options={{ tabBarIcon: ({ color, size }) => <TabIcon name="book-open" color={color} size={size} /> }}>{() => library}</Tabs.Screen>
          <Tabs.Screen name="Now Playing"
            options={{ tabBarIcon: ({ color, size }) => <TabIcon name="headphones" color={color} size={size} /> }}>{() => nowPlaying}</Tabs.Screen>
        </Tabs.Navigator>
      </NavigationContainer>
    </View>
    {readerOpen && !contentsOpen && <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
      <Paper palette={palette}>
        <View style={[ui.row, { paddingHorizontal: 8, justifyContent: "space-between", opacity: readingChrome ? 1 : 0 }]}
          pointerEvents={readingChrome ? "auto" : "none"} importantForAccessibility={readingChrome ? "auto" : "no-hide-descendants"}>
          <IconButton p={palette} icon="arrow-left" label="Back to Library" action={() => {
            controller.current?.checkpoint(); setEntries(listDocuments()); setScreen("library");
          }} />
          {totalPages > 0 && !!chunks.length ? <View style={[ui.row, { backgroundColor: palette.card, borderRadius: 18 }]}>
            <Button p={palette} label="Text" selected={pdfTextMode} action={() => setPdfTextMode(true)} />
            <Button p={palette} label="Page" selected={!pdfTextMode} action={() => setPdfTextMode(false)} />
          </View> : <Text numberOfLines={1} style={[ui.title, { flex: 1, color: palette.ink, textAlign: "center" }]}>{document.title}</Text>}
          <IconButton p={palette} icon="bookmark" label={bookmark === bookmarkValue ? "Remove bookmark" : "Bookmark current location"}
            selected={bookmark === bookmarkValue} action={() => {
              const next = bookmark === bookmarkValue ? "" : bookmarkValue;
              savePreference(bookmarkKey, next); setBookmark(next);
            }} />
        </View>
        {scanIntro ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 12 }}>
          <View style={{ width: 88 }}><Cover {...active} p={palette} /></View>
          <Text style={[ui.title, { color: palette.ink }]}>No selectable text</Text>
          <Text style={{ color: palette.muted, textAlign: "center" }}>This PDF contains page images. You can still read the original pages.</Text>
          <Button p={palette} primary label="View original pages" action={() => setShowScan(true)} />
        </View> : totalPages > 0 && (!pdfTextMode || !chunks.length)
          ? <PdfReader key={document.id} id={document.id} page={pdfPage} total={totalPages}
            pageText={pageText} range={pdfRange}
            move={move} showNavigation={readingChrome} onTap={toggleChrome} openText={() => setPdfTextMode(true)} palette={palette} />
          : <Reader key={document.id} content={document.content} chunks={chunks} pageStarts={document.pageStarts} chapters={chapters} notes={notes} index={readingIndex}
            highlightedIndex={navigateTo === undefined ? state.highlightedIndex : null}
            onSelect={selectPassage} onAnnotate={index => { setNoteIndex(index); setSheet("notes"); }} onTap={toggleChrome} palette={palette} fontSize={fontSize} />}
        {(playing || pending || state.phase === "paused") && <View pointerEvents="box-none"
          style={{ position: "absolute", left: 0, right: 0, bottom: 100 }}>{miniPlayer}</View>}
        {readingChrome ? <View style={[ui.row, { justifyContent: "space-evenly" }]}>
          <IconButton p={palette} icon="list" label="Contents" action={() => setContentsOpen(true)} />
          <IconButton p={palette} icon="sun" label="Appearance" action={() => setSheet("appearance")} />
          <IconButton p={palette} icon="sliders" label="Reading progress" action={() => setSheet("progress")} />
          <IconButton p={palette} icon="type" label="Text size" action={() => setSheet("textSize")} />
          <IconButton p={palette} icon="edit-3" label="Highlights and notes" disabled={!chunks.length}
            action={() => { setNoteIndex(readingIndex); setSheet("notes"); }} />
          <IconButton p={palette} icon="headphones" label="Listen" selected={playing} action={() => setSheet("listen")} />
        </View> : <Pressable accessibilityRole="button" accessibilityLabel="Show reader controls" onPress={toggleChrome}
          style={{ height: 48, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: palette.muted }}>{totalPages ? `${pdfPage + 1} / ${totalPages}` : `${readingPercent}%`}</Text>
        </Pressable>}
      </Paper>
    </SafeAreaView>}

    {contentsOpen && <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
      <Paper palette={palette}>
        <View style={ui.row}>
          <IconButton p={palette} icon="arrow-left" label="Back" action={() => setContentsOpen(false)} />
          <Text accessibilityRole="header" style={[ui.heading, { color: palette.ink }]}>Contents</Text>
        </View>
        <Text numberOfLines={1} style={{ paddingHorizontal: 16, color: palette.muted }}>{document.title}</Text>
        <View style={{ padding: 12, flex: 1 }}>
      <Contents key={document.id} id={document.id} format={totalPages ? "PDF" : active.format}
        current={totalPages ? pdfPage : chunks[navigateTo ?? state.index]?.startChar ?? 0}
        total={totalPages || chunks.length} read={entry => jump(entry, false)} play={entry => jump(entry, true)} p={palette} />
        </View>
      </Paper>
    </SafeAreaView>}

    {sheet === "notes" && noteIndex !== undefined && <Sheet key="notes" title="Highlights and notes" close={dismissSheet("notes")} p={palette}>
      <Notes key={noteIndex} notes={notes} current={noteIndex} excerpt={index => chunks[index]?.text.trim() ?? ""}
        palette={palette} save={note => { updateNotes([...notes.filter(item => item.index !== note.index), note]); closeSheet(); }}
        listen={index => { closeSheet(); selectPassage(index); }}
        remove={index => updateNotes(notes.filter(note => note.index !== index))}
        jump={index => {
          const chunk = chunks[index];
          if (!chunk) return;
          if (totalPages) setPdfTextMode(true);
          jump({ title: "", depth: 0, offset: chunk.startChar, page: chunk.pageIndex }, false);
        }} />
    </Sheet>}

    {sheet === "menu" && <Sheet key="menu" title="Menu" close={dismissSheet("menu")} p={palette}>
      <Button p={palette} label="Appearance" action={() => setSheet("appearance")} />
      <Button p={palette} label="Voices" action={openVoice} />
      <Button p={palette} label="Storage" action={() => { showLibrary(); setSheet("storage"); }} />
    </Sheet>}
    {sheet === "listen" && <Sheet key="listen" title="Listen" close={dismissSheet("listen")} p={palette}>
      <Text accessibilityLiveRegion="polite" style={{ color: palette.muted }}>{playable ? status : "This PDF has no selectable text."}</Text>
      <View style={{ alignItems: "center" }}><Transport {...transport} /></View>
      <Slider accessibilityLabel="Seek within this passage" minimumValue={0} maximumValue={state.durationMs || 1}
        disabled={!transport.canSeek} value={hasTimeline ? state.positionMs : 0} minimumTrackTintColor={palette.accent}
        maximumTrackTintColor={palette.line} thumbTintColor={palette.accent}
        onSlidingComplete={value => void controller.current?.seek(value).catch(console.warn)}
        accessibilityValue={{ text: `${Math.floor(state.positionMs / 1000)} seconds into this passage` }} style={{ height: 48 }} />
      <Button p={palette} label={`Voice · ${narratorLabel}`} action={openVoice} />
      <Button p={palette} label={`Speed · ${rate}×`} action={() => setSheet("speed")} />
      {state.phase !== "idle" && <Button p={palette} label="Stop" action={() => controller.current?.stop()} />}
    </Sheet>}
    {sheet === "progress" && <Sheet key="progress" title="Reading progress" close={dismissSheet("progress")} p={palette}>
      <Text style={{ color: palette.muted }}>{totalPages ? `Page ${location + 1} of ${locations}` : `Passage ${location + 1} of ${locations}`}</Text>
      <View style={ui.row}>
        <IconButton p={palette} icon="chevron-left" label="Previous location" action={() => move(location - 1)} disabled={location <= 0} />
        <Slider accessibilityLabel={totalPages ? "PDF page" : "Passage"} accessibilityValue={{ text: `${location + 1} of ${locations}` }}
          minimumValue={0} maximumValue={Math.max(1, locations - 1)} step={1} value={location} disabled={locations < 2}
          minimumTrackTintColor={palette.accent} maximumTrackTintColor={palette.line} thumbTintColor={palette.accent}
          style={{ flex: 1, height: 48 }} onSlidingComplete={move} />
        <IconButton p={palette} icon="chevron-right" label="Next location" action={() => move(location + 1)} disabled={location + 1 >= locations} />
      </View>
      {!!bookmark && <Button p={palette} label="Go to bookmark" action={() => move(Number(bookmark))} />}
    </Sheet>}
    {sheet === "textSize" && <Sheet key="textSize" title="Text size" close={dismissSheet("textSize")} p={palette}>
      <View style={ui.row}>
        <Text style={{ color: palette.ink, flex: 1 }}>{fontSize} pt</Text>
        <IconButton p={palette} icon="minus" label="Decrease text size" disabled={fontSize <= 16}
          action={() => { setFontSize(fontSize - 1); savePreference("fontSize", String(fontSize - 1)); }} />
        <IconButton p={palette} icon="plus" label="Increase text size" disabled={fontSize >= 32}
          action={() => { setFontSize(fontSize + 1); savePreference("fontSize", String(fontSize + 1)); }} />
      </View>
    </Sheet>}

    {sheet === "speed" && <Sheet key="speed" title="Playback speed" close={dismissSheet("speed")} p={palette}>
      <View style={[ui.row, { flexWrap: "wrap" }]}>{[0.75, 1, 1.25, 1.5, 1.75, 2].map(value =>
        <Button key={value} p={palette} label={`${value}×`} selected={rate === value} action={() => {
          speed.current = value; player.current?.setRate(value); setRate(value); savePreference("rate", String(value)); closeSheet();
        }} />)}</View>
    </Sheet>}
    {sheet === "appearance" && <Sheet key="appearance" title="Appearance" close={dismissSheet("appearance")} p={palette}>
      <View style={ui.row}>{(["system", "light", "dark"] as const).map(value =>
        <Button key={value} p={palette} label={value[0].toUpperCase() + value.slice(1)} selected={theme === value} action={() => setTheme(value)} />)}</View>
    </Sheet>}
    {sheet === "voice" && <Sheet key="voice" title="Narration voice" close={dismissSheet("voice")} p={palette}>
      {!!setup && <View style={ui.row}>
        <Text accessibilityLiveRegion="polite" style={{ color: palette.muted, flex: 1 }}>{setup}</Text>
        <Button p={palette} label="Cancel" action={closeSheet} />
      </View>}
      {[...NARRATORS, { id: device ?? "device-unavailable", label: "Android Device", description: device ? "System text-to-speech · Offline ready" : "No installed offline system voice" }].map(item => {
        const offline = item.id === device || kokoroEngine.hasOfflineVoice(item.id);
        const disabled = !!setup || !!previewing || item.id === "device-unavailable";
        return <View key={item.id} style={ui.row}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: voice === item.id, disabled }} disabled={disabled}
            onPress={() => void chooseVoice(item.id, false)}
            style={{ flex: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: 10, borderRadius: 8, backgroundColor: voice === item.id ? palette.highlight : palette.card }}>
            <Text style={{ color: palette.ink, fontWeight: "600" }}>{item.label}{voice === item.id ? "  ✓" : ""}</Text>
            <Text style={{ color: palette.muted }}>{item.description}{item.id !== device && item.id !== "device-unavailable" ? offline ? " · Ready offline" : " · Not downloaded" : ""}</Text>
          </Pressable>
          <IconButton p={palette} icon={previewing === item.id ? "square" : "play"} label={previewing === item.id ? `Stop preview of ${item.label}` : `Preview ${item.label}`}
            disabled={disabled && previewing !== item.id} action={() => previewing === item.id ? preview.current?.abort() : void chooseVoice(item.id, true)} />
        </View>;
      })}
    </Sheet>}
    {sheet === "storage" && <Sheet key="storage" title="Storage" close={dismissSheet("storage")} p={palette}>
      <Text style={{ color: palette.ink }}>Original documents · {(storage.documents / 1_000_000).toFixed(1)} MB</Text>
      <Text style={{ color: palette.ink }}>Offline voice · {(storage.voiceBytes / 1_000_000).toFixed(1)} MB</Text>
      <Text style={{ color: palette.ink }}>Generated audio · {(storage.audioBytes / 1_000_000).toFixed(1)} MB</Text>
      <Button p={palette} label="Clear generated audio" action={clearAudio} disabled={libraryBusy || !storage.audioBytes} />
    </Sheet>}
    {options && <DocumentOptions item={options} p={palette} close={() => setOptions(undefined)} rename={updateTitle}
      remove={removeDocument} exportFile={(id, kind) => void runLibraryOperation(() =>
        kind === "document" ? exportDocument(id) : exportNarration(id, voice))} />}
  </SafeAreaView>;
}
