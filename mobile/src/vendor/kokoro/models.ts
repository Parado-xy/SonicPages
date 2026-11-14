// Keep weights, voice styles and token IDs on the Kokoro 1.0 release.
const BASE = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231";

export const MODEL = {
  id: "kokoro-v1-int8",
  filename: "model_quantized.onnx",
  url: BASE + "/onnx/model_quantized.onnx",
  bytes: 92361116,
};

export const VOICE = {
  id: "af_heart",
  filename: "af_heart.bin",
  url: BASE + "/voices/af_heart.bin",
  bytes: 522240,
};
