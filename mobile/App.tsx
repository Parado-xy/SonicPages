import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Audio } from "expo-av";
import kokoro from "./src/vendor/kokoro/kokoroOnnx";
import { downloadModel, isModelDownloaded } from "./src/vendor/kokoro/models";
import { splitIntoChunks } from "./src/reader/chunks";

const MODEL = "model_q8f16.onnx";
const VOICE = "af_heart";
const DEMO = "SonicPages turns your documents into immersive listening experiences. The narration should follow the words on screen. Your library belongs to you, and speech should be generated on your own device.";

export default function App() {
  const [title, setTitle] = useState("Welcome to SonicPages");
  const [content, setContent] = useState(DEMO);
  const [activeChunk, setActiveChunk] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("Model not installed");
  const soundRef = useRef<Audio.Sound | null>(null);
  const generationRef = useRef(0);
  const inferenceInProgressRef = useRef(false);
  const chunks = useMemo(() => splitIntoChunks("current-document", content), [content]);
  const chunksRef = useRef(chunks);
  chunksRef.current = chunks;

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true }).catch(console.warn);
    isModelDownloaded(MODEL).then(exists => setMessage(exists ? "Model downloaded · tap Prepare" : "Model not installed")).catch(console.warn);
    return () => { generationRef.current++; soundRef.current?.unloadAsync().catch(console.warn); };
  }, []);

  const stop = async () => {
    generationRef.current++;
    const sound = soundRef.current;
    soundRef.current = null;
    setPlaying(false);
    if (sound) await sound.unloadAsync().catch(console.warn);
  };

  const prepare = async () => {
    setBusy(true);
    try {
      if (!(await isModelDownloaded(MODEL))) {
        setMessage("Downloading Kokoro model (about 86 MB)…");
        const downloaded = await downloadModel(MODEL, (progress: number) => setMessage("Downloading Kokoro " + Math.round(progress * 100) + "%"));
        if (!downloaded) throw new Error("Model download failed");
      }
      setMessage("Loading Kokoro on this device…");
      if (!(await kokoro.loadModel(MODEL))) throw new Error("ONNX model could not be loaded");
      setReady(true);
      setMessage("Kokoro ready · fully on-device");
    } catch (error) { setMessage("Model error"); Alert.alert("Speech setup failed", String(error)); }
    finally { setBusy(false); }
  };

  const narrate = async (index: number) => {
    if (inferenceInProgressRef.current) return;
    if (!ready) { Alert.alert("Prepare Kokoro first", "Download and load the speech model before listening."); return; }
    if (index >= chunksRef.current.length) { await stop(); return; }
    await stop();
    const generation = generationRef.current;
    setActiveChunk(index);
    inferenceInProgressRef.current = true;
    setBusy(true);
    setMessage("Generating short diagnostic sample locally…");
    try {
      // Limit the first on-device inference test to a short sample to avoid long stalls.
      const sample = chunksRef.current[index].text.trim().split(/\s+/).slice(0, 8).join(" ");
      const sound = await kokoro.generateAudio(sample, VOICE, 1);
      if (generation !== generationRef.current) { await sound.unloadAsync(); return; }
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) return;
        if (status.didJustFinish && generation === generationRef.current) {
          void narrate(index + 1);
        }
      });
      await sound.playAsync();
      setPlaying(true);
      setMessage("Listening · passage highlighting (word alignment pending)");
    } catch (error) { setMessage("Narration failed"); Alert.alert("Narration error", String(error)); }
    finally { inferenceInProgressRef.current = false; if (generation === generationRef.current) setBusy(false); }
  };

  const toggle = async () => {
    if (!soundRef.current) { await narrate(activeChunk); return; }
    if (playing) { await soundRef.current.pauseAsync(); setPlaying(false); }
    else { await soundRef.current.playAsync(); setPlaying(true); }
  };

  const importText = async () => {
    try {
      await stop();
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({ type: "text/plain", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const next = await new File(asset.uri).text();
      if (!next.trim()) throw new Error("This document is empty");
      setContent(next);
      setTitle(asset.name);
      setActiveChunk(0);
    } catch (error) { Alert.alert("Import failed", String(error)); }
    finally { setBusy(false); }
  };

  return <SafeAreaView style={styles.root}>
    <View style={styles.header}><Text style={styles.brand}>sonicpages</Text><Text style={styles.subtitle}>Listen deeply. Read along.</Text></View>
    <View style={styles.top}><Text style={styles.title}>{title}</Text><Pressable accessibilityRole="button" onPress={importText} style={styles.import}><Text style={styles.importText}>Import TXT</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.reader}>
      {chunks.map((chunk, index) => <Pressable key={chunk.id} onPress={() => { void narrate(index); }} accessibilityRole="button" style={[styles.chunk, index === activeChunk && styles.selected]}><Text style={styles.prose}>{chunk.text.trim()}</Text></Pressable>)}
    </ScrollView>
    <View style={styles.player}>
      <Text style={styles.playerTitle}>{message}</Text>
      {busy && <ActivityIndicator style={{marginTop:8}} />}
      <View style={styles.controls}>
        <Pressable style={styles.import} onPress={prepare} disabled={busy}><Text style={styles.importText}>{ready ? "Reload" : "Prepare Kokoro"}</Text></Pressable>
        <Pressable style={styles.import} onPress={() => void toggle()} disabled={busy || !ready}><Text style={styles.importText}>{playing ? "Pause" : "Play"}</Text></Pressable>
        <Pressable style={styles.import} onPress={() => void stop()}><Text style={styles.importText}>Stop</Text></Pressable>
      </View>
      <Text style={styles.progress}>Passage {Math.min(activeChunk + 1, chunks.length)} / {chunks.length}</Text>
      <Text style={styles.note}>Audio runs locally. Passage highlighting is real; word-level timing, persistent audio cache and lock-screen controls are not implemented yet.</Text>
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({root:{flex:1,backgroundColor:"#FCF9F3"},header:{paddingHorizontal:24,paddingTop:18,paddingBottom:14},brand:{fontSize:26,fontWeight:"800",color:"#253A39"},subtitle:{fontSize:13,color:"#6B7876",marginTop:2},top:{paddingHorizontal:24,paddingBottom:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},title:{fontSize:15,fontWeight:"600",color:"#253A39",flex:1},import:{backgroundColor:"#253A39",borderRadius:12,paddingHorizontal:12,paddingVertical:10},importText:{color:"white",fontWeight:"600",fontSize:12},reader:{paddingHorizontal:22,paddingBottom:40},chunk:{borderRadius:12,padding:10,marginBottom:7},selected:{backgroundColor:"#FFE8BB"},prose:{fontSize:19,lineHeight:32,color:"#253A39"},player:{borderTopWidth:1,borderTopColor:"#E4E0D9",padding:18,backgroundColor:"#FFFFFF"},playerTitle:{fontWeight:"700",color:"#253A39"},controls:{flexDirection:"row",gap:8,marginTop:12,flexWrap:"wrap"},progress:{marginTop:8,fontSize:12,color:"#253A39"},note:{marginTop:6,fontSize:11,lineHeight:16,color:"#6B7876"}});
