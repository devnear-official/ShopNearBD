import fs from "node:fs";
import path from "node:path";

/** Minimal .env.local loader for scripts (Next.js loads it for the app itself). */
export function loadEnv(file = ".env.local") {
  const p = path.resolve(file);
  if (!fs.existsSync(p)) return;
  for (const rawLine of fs.readFileSync(p, "utf8").split("\n")) {
    const line = rawLine.replace(/\r$/, "").trim();
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.startsWith("#")) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined && value !== "") process.env[m[1]] = value;
  }
}
