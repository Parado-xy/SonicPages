// React Native's ONNX binding does not forward session configuration entries.
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const source = join(__dirname, "../node_modules/onnxruntime-react-native/cpp/SessionUtils.cpp");
const code = readFileSync(source, "utf8");
const setting = '    sessionOptions.AddConfigEntry("session.intra_op.allow_spinning", "0");';
if (!code.includes(setting)) {
  const anchor = "    // intraOpNumThreads";
  if (!code.includes(anchor)) throw new Error("Review the Android ONNX threading patch for this version");
  const config = ["#ifdef __ANDROID__", setting, "#endif", "", anchor].join("\n");
  writeFileSync(source, code.replace(anchor, config));
}
