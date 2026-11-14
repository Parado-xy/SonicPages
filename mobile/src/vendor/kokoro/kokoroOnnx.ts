import { InferenceSession, Tensor } from "onnxruntime-react-native";
import { inspectWaveform, assertPlayableWaveform } from "../../speech/waveformDiagnostics";

export const SAMPLE_RATE = 24000;
const STYLE_SIZE = 256;

export async function openKokoro(modelUri: string) {
  const session = await InferenceSession.create(modelUri, { executionProviders: ["cpu"], intraOpNumThreads: 2, graphOptimizationLevel: "all" });
  if (!["input_ids", "style", "speed"].every(name => session.inputNames.includes(name)) ||
      !session.outputNames.includes("waveform")) {
    await session.release();
    throw new Error("Downloaded model does not match the Kokoro 1.0 ONNX contract");
  }
  return session;
}

export async function runKokoro(session: InferenceSession, tokens: number[], voice: Float32Array) {
  const offset = (tokens.length - 2) * STYLE_SIZE;
  const style = voice.slice(offset, offset + STYLE_SIZE);
  if (style.length !== STYLE_SIZE || !style.every(Number.isFinite)) {
    throw new Error("Voice style data does not match the Kokoro model");
  }
  const started = Date.now();
  const { waveform } = await session.run({
    input_ids: new Tensor("int64", BigInt64Array.from(tokens, token => BigInt(token)), [1, tokens.length]),
    style: new Tensor("float32", style, [1, STYLE_SIZE]),
    speed: new Tensor("float32", Float32Array.of(1), [1]),
  });
  if (!(waveform?.data instanceof Float32Array)) throw new Error("Invalid Kokoro waveform output");
  const report = inspectWaveform(waveform.data, SAMPLE_RATE);
  console.info("Kokoro waveform", { inferenceMs: Date.now() - started, tokens: tokens.length - 2, sampleRate: SAMPLE_RATE, ...report });
  assertPlayableWaveform(report);
  return waveform.data;
}
