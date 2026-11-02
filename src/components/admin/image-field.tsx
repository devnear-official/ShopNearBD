"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { getImageUploadSignature } from "@/actions/admin-products";
import { toast } from "@/components/admin/form";

/** Single-image uploader: the file goes browser → Cloudinary, the form submits only the resulting https link. */
export function ImageField({ name = "image_url", label, defaultValue, hint }: { name?: string; label: string; defaultValue?: string | null; hint?: string }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (f: File) => {
    if (!/^image\/(jpeg|png|webp|avif)$/.test(f.type)) return toast("Use a JPG, PNG, WebP or AVIF image.", "error");
    if (f.size > 10 * 1024 * 1024) return toast("That image is larger than 10 MB.", "error");
    setBusy(true);
    try {
      const sig = await getImageUploadSignature();
      if (!sig.ok) throw new Error(sig.error);
      const { cloudName, apiKey, signature, timestamp, folder, transformation } = sig.params;
      const fd = new FormData();
      fd.set("file", f); fd.set("api_key", apiKey); fd.set("timestamp", String(timestamp));
      fd.set("signature", signature); fd.set("folder", folder); fd.set("transformation", transformation);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: fd, signal: AbortSignal.timeout(90_000) });
      const json = (await res.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
      if (!res.ok || !json?.secure_url) throw new Error(json?.error?.message ?? "Upload failed.");
      setUrl(json.secure_url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed. Please try again.", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <span className="label">{label}{hint && <span className="ml-1 font-normal text-mist">· {hint}</span>}</span>
      <input type="hidden" name={name} value={url} />
      <div className="mt-1 flex items-center gap-3">
        <span className="relative grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cloud text-mist">
          {url ? <Image src={url} alt="" fill sizes="128px" className="object-cover" /> : <ImagePlus className="size-6" />}
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-full bg-cloud px-4 text-sm font-semibold hover:bg-line disabled:opacity-60">
            {busy ? <><Loader2 className="size-4 animate-spin" /> Uploading…</> : url ? "Replace image" : "Upload image"}
          </button>
          {url && !busy && <button type="button" onClick={() => setUrl("")} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-flame hover:bg-flame/10"><Trash2 className="size-4" /> Remove</button>}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      </div>
    </div>
  );
}
