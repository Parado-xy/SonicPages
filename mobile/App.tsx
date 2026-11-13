import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { splitIntoChunks } from "./src/reader/chunks";

const DEMO = "SonicPages turns your documents into immersive listening experiences. The narration should follow the words on screen. Your library belongs to you, and speech should be generated on your own device.";

export default function App() {
  const [title, setTitle] = useState("Welcome to SonicPages");
  const [content, setContent] = useState(DEMO);
  const [loading, setLoading] = useState(false);
  const [activeChunk, setActiveChunk] = useState(0);
  const chunks = useMemo(() => splitIntoChunks("current-document", content), [content]);
  const importText = async () => {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({ type: "text/plain", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const next = await new File(asset.uri).text();
      if (!next.trim()) throw new Error("This document is empty.");
      setContent(next);
      setTitle(asset.name);
      setActiveChunk(0);
    } catch (e) { Alert.alert("Import failed", e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  return <SafeAreaView style={styles.root}>
    <View style={styles.header}><Text style={styles.brand}>sonicpages</Text><Text style={styles.subtitle}>Listen deeply. Read along.</Text></View>
    <View style={styles.top}><Text style={styles.title}>{title}</Text><Pressable accessibilityRole="button" onPress={importText} style={styles.import}><Text style={styles.importText}>Import TXT</Text></Pressable></View>
    {loading && <ActivityIndicator />}
    <ScrollView contentContainerStyle={styles.reader}>
      {chunks.map((chunk, index) => <Pressable key={chunk.id} onPress={() => setActiveChunk(index)} accessibilityRole="button" style={[styles.chunk, index === activeChunk && styles.selected]}><Text style={styles.prose}>{chunk.text.trim()}</Text></Pressable>)}
    </ScrollView>
    <View style={styles.player}><Text style={styles.playerTitle}>Narration is not connected yet</Text><Text style={styles.playerCaption}>Kokoro native inference, cached audio, and verified highlighting are required before this is a playable milestone.</Text><Text style={styles.progress}>Passage {Math.min(activeChunk + 1, chunks.length)} / {chunks.length}</Text></View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({root:{flex:1,backgroundColor:"#FCF9F3"},header:{paddingHorizontal:24,paddingTop:18,paddingBottom:14},brand:{fontSize:26,fontWeight:"800",color:"#253A39"},subtitle:{fontSize:13,color:"#6B7876",marginTop:2},top:{paddingHorizontal:24,paddingBottom:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},title:{fontSize:15,fontWeight:"600",color:"#253A39",flex:1},import:{backgroundColor:"#253A39",borderRadius:12,paddingHorizontal:14,paddingVertical:11},importText:{color:"white",fontWeight:"600"},reader:{paddingHorizontal:22,paddingBottom:40},chunk:{borderRadius:12,padding:10,marginBottom:7},selected:{backgroundColor:"#FFE8BB"},prose:{fontSize:19,lineHeight:32,color:"#253A39"},player:{borderTopWidth:1,borderTopColor:"#E4E0D9",padding:20,backgroundColor:"#FFFFFF"},playerTitle:{fontWeight:"700",color:"#253A39"},playerCaption:{fontSize:12,color:"#6B7876",marginTop:5,lineHeight:18},progress:{marginTop:8,fontSize:12,color:"#253A39"}});
