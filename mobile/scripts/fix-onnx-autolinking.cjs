#!/usr/bin/env node
/**
 * Work around ONNX Runtime's unimodule.json misclassification in Expo autolinking.
 * https://github.com/microsoft/onnxruntime/issues/29004
 *
 * This runs before Expo prebuild / EAS native autolinking. It is safe to rerun.
 */
const fs = require('node:fs');
const path = require('node:path');

const packageDir = path.join(__dirname, '..', 'node_modules', 'onnxruntime-react-native');
const marker = path.join(packageDir, 'unimodule.json');

if (!fs.existsSync(packageDir)) {
  console.warn('[sonicpages] ONNX Runtime not installed yet; skipping autolinking workaround.');
  process.exit(0);
}
if (fs.existsSync(marker)) {
  fs.rmSync(marker);
  console.log('[sonicpages] Removed ONNX unimodule.json so Expo registers the React Native native module.');
} else {
  console.log('[sonicpages] ONNX autolinking marker already absent.');
}
