/** Renders development product images to public/seed/*.webp. Run: npx tsx scripts/seed-assets/render.ts */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { products } from "../seed-data";
import { scene } from "./art";

const out = path.resolve("public/seed");
fs.mkdirSync(out, { recursive: true });

async function write(name: string, svg: string) {
  await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(path.join(out, `${name}.webp`));
}

async function main() {
  for (const p of products) {
    await write(`${p.slug}-1`, scene(p.art, p.palette, p.bg));
    await write(`${p.slug}-2`, scene(p.art, p.palette, ["#0B1530", "#1E3A8A"], { angle: -9, scale: 1.12, badge: p.specs[0][1], glow: 0.16 }));
    for (const v of p.variants.slice(1)) {
      if (v.palette) await write(`${p.slug}-${v.sku.toLowerCase()}`, scene(p.art, v.palette, p.bg, { angle: 4 }));
    }
  }
  console.log("rendered", fs.readdirSync(out).length, "images");
}
main();
