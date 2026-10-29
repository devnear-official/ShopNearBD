import { execSync } from "node:child_process";

/** Resets the integration-test database (dev shim + migrations + seed) once per run. */
export default function setup() {
  if (process.env.SKIP_DB_RESET === "1") return;
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54322/shopnear_test";
  const db = new URL(url).pathname.slice(1);
  try {
    execSync(`./scripts/db-reset-dev.sh ${db}`, { stdio: "pipe", env: { ...process.env, PGPORT: new URL(url).port || "5432" } });
  } catch (e) {
    console.warn("[tests] could not reset the test database — integration tests will be skipped.\n", String((e as { stderr?: Buffer }).stderr ?? e).slice(0, 400));
    process.env.NO_TEST_DB = "1";
  }
}
