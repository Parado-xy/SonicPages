// Expo Audio 1.1.1 leaves Media3's headset-disconnect handler disabled.
// Keep this patch until the SDK supplies the setting itself.
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const source = join(__dirname, "../node_modules/expo-audio/android/src/main/java/expo/modules/audio/AudioPlayer.kt");
const code = readFileSync(source, "utf8");
const setting = ".setHandleAudioBecomingNoisy(true)";
if (!code.includes(setting)) {
  const anchor = ".setAudioAttributes(AudioAttributes.DEFAULT, false)";
  if (!code.includes(anchor)) throw new Error("Review the Android audio route patch for this Expo Audio version");
  writeFileSync(source, code.replace(anchor, anchor + "\n    " + setting));
}
