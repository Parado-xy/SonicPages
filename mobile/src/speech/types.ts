/**
 * Speech contracts for the SonicPages native proof of concept.
 *
 * All generated speech must stay on-device. An implementation must not
 * transmit document text or speech data to an external service.
 */
export type SpeechWord = {
  text: string;
  startChar: number;
  endChar: number;
  startMs: number;
  endMs: number;
};

export type SpeechChunk = {
  id: string;
  documentId: string;
  text: string;
  startChar: number;
  endChar: number;
};

export type GeneratedSpeech = {
  chunkId: string;
  localAudioUri: string;
  durationMs: number;
  /**
   * Verified word timing returned by synthesis or a real alignment pass.
   * Empty means the UI must use passage-level highlighting instead.
   */
  words: SpeechWord[];
  modelId: string;
};

export interface LocalSpeechEngine {
  prepare(onStatus: (message: string) => void): Promise<void>;
  synthesize(chunk: SpeechChunk, signal: AbortSignal): Promise<GeneratedSpeech>;
}
