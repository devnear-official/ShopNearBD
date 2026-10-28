import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

// Load .env.local for integration tests (local Supabase-compatible stack).
const envFile = path.resolve(__dirname, ".env.local");
const env: Record<string, string> = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && m[2]) env[m[1]] = m[2];
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    env,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
