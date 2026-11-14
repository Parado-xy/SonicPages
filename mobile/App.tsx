import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { documentTypes, readDocument } from "./src/imports/readDocument";
import { ExpoPlayer } from "./src/audio/expoPlayer";
import { NarrationController, type NarrationState } from "./src/narration/controller";
import { splitIntoChunks } from "./src/reader/chunks";
import { Library } from "./src/reader/Library";
import { Reader } from "./src/reader/Reader";
import { styles } from "./src/reader/styles";
import { kokoroEngine } from "./src/speech/kokoroEngine";
import { listDocuments, loadDocument, openDocument, renameDocument, saveDocument, savePosition, type LibraryEntry } from "./src/storage/readerStore";

const DEMO = {
  id: "demo-1",
  title: "Welcome to SonicPages",
  content: "Hello world. This is a test. SonicPages turns your documents into immersive listening experiences. Follow each passage as it plays. Your library stays on your device.",
};

export default function App() {
  return <SafeAreaProvider><ReaderScreen /></SafeAreaProvider>;
}

function ReaderScreen() {
  const [document, setDocument] = useState(() => loadDocument(DEMO));
  const chunks = useMemo(() => splitIntoChunks(document.id, document.content), [document]);
  const initial = { index: Math.min(document.index, Math.max(0, chunks.length - 1)), positionMs: document.positionMs };
  const [state, setState] = useState<NarrationState>({ ...initial, phase: "idle", highlightedIndex: null });
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState<string>();
  const [setupError, setSetupError] = useState<string>();
  const [library, setLibrary] = useState<LibraryEntry[] | null>(null);
  const [importing, setImporting] = useState(false);
  const importInProgress = useRef(false);
  const setupInProgress = useRef(false);
  const controller = useRef<NarrationController>(null);

  useEffect(() => {
    const position = { index: Math.min(document.index, Math.max(0, chunks.length - 1)), positionMs: document.positionMs };
    setState({ ...position, phase: "idle", highlightedIndex: null });
    const session = new NarrationController(kokoroEngine, new ExpoPlayer(), chunks, document.title, position,
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
    if (kokoroEngine.hasOfflineVoice()) void prepare(true);
  }, [prepare]);

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
        const content = await readDocument(file, asset.name, asset.mimeType);
        setDocument(saveDocument(asset.name, content));
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
      setLibrary(listDocuments());
    } catch (error) {
      Alert.alert("Could not open the library", String(error));
    }
  };

  const switchDocument = (id: string) => {
    try {
      if (id !== document.id) {
        controller.current?.stop();
        setDocument(openDocument(id));
      }
      setLibrary(null);
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
      return true;
    } catch (error) {
      Alert.alert("Could not rename document", String(error));
      return false;
    }
  };

  const status = setup ?? setupError ?? (state.phase === "error" ? state.error : {
    generating: "Preparing passage on this device…",
    buffering: "Buffering audio…",
    playing: "Listening",
    paused: "Paused",
    finished: "End of document",
    idle: ready ? "Ready to listen offline" : "Prepare Kokoro for offline listening (93 MB on first setup)",
  }[state.phase]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>sonicpages</Text>
        <Text style={styles.subtitle}>Listen deeply. Read along.</Text>
      </View>
      <View style={styles.top}>
        <Text style={styles.title}>{document.title}</Text>
        <Pressable accessibilityRole="button" onPress={showLibrary} disabled={importing} style={styles.import}>
          <Text style={styles.importText}>Library</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={importDocument} disabled={importing} style={styles.import}>
          <Text style={styles.importText}>Import</Text>
        </Pressable>
      </View>
      <Reader key={document.id} chunks={chunks} index={state.index} highlightedIndex={state.highlightedIndex}
        onSelect={index => {
          if (!ready) { Alert.alert("Prepare Kokoro first"); return; }
          if (!importing) void controller.current?.listen(index);
        }} />
      <View style={styles.player}>
        <Text accessibilityLiveRegion="polite" style={styles.playerTitle}>{status}</Text>
        {(setup || importing || state.phase === "generating") && <ActivityIndicator />}
        <View style={styles.controls}>
          {!ready && <Pressable accessibilityRole="button" style={styles.import} onPress={() => void prepare()} disabled={!!setup}>
            <Text style={styles.importText}>{setupError ? "Retry setup" : "Prepare Kokoro"}</Text>
          </Pressable>}
          <Pressable accessibilityRole="button" style={styles.import} onPress={() => controller.current?.toggle()}
            disabled={importing || !ready || (state.phase === "generating" || state.phase === "buffering")}>
            <Text style={styles.importText}>{state.phase === "playing" ? "Pause" : "Play"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.import} onPress={() => controller.current?.stop()}>
            <Text style={styles.importText}>Stop</Text>
          </Pressable>
        </View>
        <Text style={styles.progress}>Passage {Math.min(state.index + 1, chunks.length)} / {chunks.length}</Text>
      </View>
      {library && <Library entries={library} activeId={document.id} close={() => setLibrary(null)}
        open={switchDocument} rename={updateTitle} />}
    </SafeAreaView>
  );
}
