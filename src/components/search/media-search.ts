"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type MediaHit = { slug: string; name: string; name_bn: string | null; price: number; image: string | null; category: string | null };
export type MediaResult = { kind: "voice" | "image"; label: string; query: string | null; items: MediaHit[]; preview?: string };

type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
};
type SpeechCtor = new () => SpeechRec;

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceSupport(): "speech" | "record" | "none" {
  if (speechCtor()) return "speech";
  if (typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") return "record";
  return "none";
}

async function postJson(url: string, init: RequestInit) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Search failed. Please try again.");
  return j;
}

/**
 * Voice search. Uses the browser's own speech recognition when it exists
 * (Chrome, Edge, Safari), otherwise records up to 8 seconds and lets the server
 * transcribe it. Nothing is recorded until the shopper taps the mic.
 */
export function useVoiceSearch(onResult: (r: MediaResult) => void) {
  const [state, setState] = useState<"idle" | "listening" | "working" | "error">("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SpeechRec | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onResult);
  useEffect(() => { cb.current = onResult; });

  const fail = (msg: string) => { setError(msg); setState("error"); };

  const searchText = useCallback(async (text: string) => {
    setState("working");
    try {
      const j = await postJson("/api/search/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      cb.current({ kind: "voice", label: j.transcript || text, query: j.query, items: j.items ?? [] });
      setState("idle");
    } catch (e) { fail((e as Error).message); }
  }, []);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    rec.current?.stop();
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async (lang: string) => {
    setError(null);
    setInterim("");
    const Ctor = speechCtor();
    if (Ctor) {
      const r = new Ctor();
      rec.current = r;
      r.lang = lang;
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;
      let finalText = "";
      r.onresult = (e) => {
        let live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += res[0].transcript; else live += res[0].transcript;
        }
        setInterim((finalText + " " + live).trim());
      };
      r.onerror = (e) => {
        finalText = "";
        fail(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone access is blocked. Allow it in your browser settings, or type your search."
          : e.error === "no-speech" ? "We didn't hear anything. Tap the mic and try again." : e.error === "network" ? "Voice recognition needs an internet connection." : "Voice search stopped. Please try again.");
      };
      r.onend = () => {
        rec.current = null;
        const t = finalText.trim();
        if (t) void searchText(t);
        else setState((s) => (s === "listening" ? "idle" : s));
      };
      setState("listening");
      try { r.start(); } catch { fail("Voice search couldn't start. Please try again."); }
      timer.current = setTimeout(() => r.stop(), 10000);
      return;
    }
    if (voiceSupport() === "none") return fail("Voice search isn't supported in this browser. Please type your search.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
      recorder.current = mr;
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 800) return fail("That was too short. Tap the mic and say what you're looking for.");
        setState("working");
        try {
          const fd = new FormData();
          fd.set("audio", blob, "voice");
          const j = await postJson("/api/search/voice", { method: "POST", body: fd });
          if (!j.transcript && !j.items?.length) return fail("We couldn't make that out. Please try again.");
          cb.current({ kind: "voice", label: j.transcript, query: j.query, items: j.items ?? [] });
          setState("idle");
        } catch (e) { fail((e as Error).message); }
      };
      mr.start();
      setState("listening");
      timer.current = setTimeout(() => mr.state === "recording" && mr.stop(), 8000);
    } catch {
      fail("Microphone access is blocked. Allow it in your browser settings, or type your search.");
    }
  }, [searchText]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    rec.current?.abort();
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  return { state, interim, error, start, stop, reset: () => { setError(null); setState("idle"); } };
}

/** Shrinks a photo to ≤1024px JPEG in the browser (smaller upload, no EXIF/location data). */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file; // e.g. HEIC in a browser that can't decode it: the server handles it
  }
}

export function useImageSearch(onResult: (r: MediaResult) => void) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const search = useCallback(async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) { setError("Choose a photo."); setState("error"); return; }
    setState("working");
    const blob = await shrink(file);
    const url = URL.createObjectURL(blob);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return url; });
    try {
      if (blob.size > 6 * 1024 * 1024) throw new Error("That photo is too large (max 6 MB).");
      const fd = new FormData();
      fd.set("image", blob, "photo");
      const j = await postJson("/api/search/image", { method: "POST", body: fd });
      onResult({ kind: "image", label: j.description || "your photo", query: j.query, items: j.items ?? [], preview: url });
      setState("idle");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }, [onResult]);

  return { state, error, preview, search, reset: () => { setError(null); setState("idle"); } };
}
