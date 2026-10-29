import "server-only";
import { GoogleGenAI } from "@google/genai";

export type GeminiSettings = { model: string; temperature: number; max_output_tokens: number };
export type GeminiResult = { text: string; inputTokens: number | null; outputTokens: number | null; latencyMs: number };

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  // GEMINI_BASE_URL is only for tests against a local mock.
  client ??= new GoogleGenAI({ apiKey: key, httpOptions: process.env.GEMINI_BASE_URL ? { baseUrl: process.env.GEMINI_BASE_URL } : undefined });
  return client;
}

export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

/** One bounded, server-side call. Throws on timeout/empty output so the caller can fall back. */
export async function generate(system: string, contents: { role: "user" | "model"; text: string }[], s: GeminiSettings, timeoutMs = 12000): Promise<GeminiResult> {
  const c = ai();
  if (!c) throw new Error("GEMINI_NOT_CONFIGURED");
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await c.models.generateContent({
      model: s.model,
      contents: contents.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      config: { systemInstruction: system, temperature: s.temperature, maxOutputTokens: s.max_output_tokens, abortSignal: ctrl.signal, httpOptions: { timeout: timeoutMs } },
    });
    const text = res.text?.trim();
    if (!text) throw new Error("GEMINI_EMPTY");
    return { text, inputTokens: res.usageMetadata?.promptTokenCount ?? null, outputTokens: res.usageMetadata?.candidatesTokenCount ?? null, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

/**
 * One multimodal call that must answer with JSON (image or audio + instructions).
 * Used by image and voice search; the media is sent inline and never stored.
 */
export async function generateJson<T>(parts: Part[], s: Pick<GeminiSettings, "model">, schema: Record<string, unknown>, timeoutMs = 15000): Promise<T> {
  const c = ai();
  if (!c) throw new Error("GEMINI_NOT_CONFIGURED");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await c.models.generateContent({
      model: s.model,
      contents: [{ role: "user", parts }],
      config: { temperature: 0.1, maxOutputTokens: 400, responseMimeType: "application/json", responseSchema: schema, abortSignal: ctrl.signal, httpOptions: { timeout: timeoutMs } },
    });
    const text = res.text?.trim();
    if (!text) throw new Error("GEMINI_EMPTY");
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
  } finally {
    clearTimeout(timer);
  }
}
