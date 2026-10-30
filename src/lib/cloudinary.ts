import "server-only";
import { createHash } from "node:crypto";

/** Product photos live on Cloudinary; the database stores only their public URL. */
const FOLDER = "shopnearbd/products";
// Applied by Cloudinary on arrival, so phone photos are never stored at full size.
const INCOMING = "c_limit,w_1600,h_2000,q_auto";

function config() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

const sign = (params: Record<string, string | number>, secret: string) =>
  createHash("sha1")
    .update(Object.entries(params).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("&") + secret)
    .digest("hex");

/** Parameters the browser needs to upload one image straight to Cloudinary (the file never passes through our server). */
export function uploadSignature() {
  const c = config();
  if (!c) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { folder: FOLDER, timestamp, transformation: INCOMING };
  return { cloudName: c.cloudName, apiKey: c.apiKey, ...signed, signature: sign(signed, c.apiSecret) };
}

/** `https://res.cloudinary.com/<cloud>/image/upload/v123/shopnearbd/products/abc.jpg` → `shopnearbd/products/abc`. */
export function publicIdFromUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname !== "res.cloudinary.com") return null;
    return decodeURIComponent(u.pathname).match(/\/image\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(shopnearbd\/.+?)(?:\.[a-z0-9]+)?$/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Best-effort cleanup: a leftover file is harmless, a failed save is not. */
export async function destroyImages(urls: string[]) {
  const c = config();
  if (!c) return;
  await Promise.all(
    urls.map(publicIdFromUrl).filter((id): id is string => Boolean(id)).map(async (public_id) => {
      const signed = { invalidate: "true", public_id, timestamp: Math.floor(Date.now() / 1000) };
      const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(signed).map(([k, v]) => [k, String(v)])), api_key: c.apiKey, signature: sign(signed, c.apiSecret) });
      await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/image/destroy`, { method: "POST", body }).catch(() => {});
    }),
  );
}
