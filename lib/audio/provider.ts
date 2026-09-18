import { parseAudioEnvironment } from "@/lib/audio/config";

export type SynthesisRequest = { text: string; voiceId: string; model: string; rate: number };
export type SynthesisResult = { bytes: Uint8Array; contentType: string; durationMs: number };
export interface SpeechProvider { readonly id: string; synthesize(request: SynthesisRequest): Promise<SynthesisResult>; }

export function createSpeechProvider(environment: Record<string, string | undefined> = process.env): SpeechProvider {
  const config = parseAudioEnvironment(environment);
  return new OpenAiSpeechProvider(config.OPENAI_API_KEY);
}

class OpenAiSpeechProvider implements SpeechProvider {
  readonly id = "openai";
  constructor(private readonly apiKey: string) {}

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: request.model, voice: request.voiceId, input: request.text, response_format: "mp3", speed: request.rate }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Speech provider returned ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error("Speech provider returned empty audio.");
    return { bytes, contentType: "audio/mpeg", durationMs: estimateDurationMs(request.text, request.rate) };
  }
}

export function estimateDurationMs(text: string, rate = 1) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1_000, Math.round((words / (165 * rate)) * 60_000));
}

