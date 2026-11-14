const HEADER_BYTES = 44;

export function wavHeader(dataLength: number, sampleRate: number): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(dataLength) || dataLength < 0 || dataLength % 2 || dataLength > 0xffffffff - 36) {
    throw new Error("Audio is too large or invalid for WAV export.");
  }
  const bytes = new Uint8Array(HEADER_BYTES);
  const view = new DataView(bytes.buffer);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, dataLength, true);
  return bytes;
}

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(HEADER_BYTES + samples.length * 2);
  bytes.set(wavHeader(samples.length * 2, sampleRate));
  const view = new DataView(bytes.buffer);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(HEADER_BYTES + index * 2, Math.round(clamped * (clamped < 0 ? 32768 : 32767)), true);
  });
  return bytes;
}

export function wavDurationMs(header: Uint8Array, fileSize: number, sampleRate: number): number | null {
  if (header.byteLength !== HEADER_BYTES) return null;
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const dataLength = view.getUint32(40, true);
  if (view.getUint32(0) !== 0x52494646 || view.getUint32(8) !== 0x57415645 ||
      view.getUint32(36) !== 0x64617461 || view.getUint16(20, true) !== 1 ||
      view.getUint16(22, true) !== 1 || view.getUint16(34, true) !== 16 ||
      view.getUint32(24, true) !== sampleRate || dataLength === 0 ||
      dataLength % 2 !== 0 || dataLength + HEADER_BYTES !== fileSize) return null;
  return dataLength * 500 / sampleRate;
}
