/** Pure PCM diagnostics: independent of Expo and ONNX. */
export interface WaveformReport {
  samples: number;
  seconds: number;
  peak: number;
  rms: number;
  nonFinite: number;
  clipped: number;
  silent: boolean;
}
export function inspectWaveform(samples: ArrayLike<number>, sampleRate = 24000): WaveformReport {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error("Invalid sample rate");
  let peak = 0, sum = 0, nonFinite = 0, clipped = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i];
    if (!Number.isFinite(value)) { nonFinite++; continue; }
    const magnitude = Math.abs(value);
    peak = Math.max(peak, magnitude);
    sum += value * value;
    if (magnitude >= 1) clipped++;
  }
  const rms = Math.sqrt(sum / Math.max(1, samples.length - nonFinite));
  return { samples: samples.length, seconds: samples.length / sampleRate, peak, rms, nonFinite, clipped, silent: rms < 0.0001 };
}
export function assertPlayableWaveform(report: WaveformReport): void {
  if (report.samples === 0 || report.nonFinite > 0) throw new Error("Invalid generated waveform");
  if (report.silent) throw new Error("Generated waveform is silent; check phonemes, model and voice");
  if (report.seconds > 30) throw new Error("Suspiciously long generated speech chunk: " + report.seconds.toFixed(1) + "s");
}
