import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(value.trim().toLowerCase(), "utf8").digest("hex");
}

function loadEnvFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Environment file not found: ${resolvedPath}`);
  }

  for (const line of fs.readFileSync(resolvedPath, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trimStart().startsWith("#") || process.env[match[1]] !== undefined) continue;

    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    process.env[match[1]] = value;
  }
}

async function main() {
  loadEnvFile(".env");

  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const pixelId = process.env.META_PIXEL_ID?.trim() || "2302029777254670";
  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim();

  if (!accessToken) throw new Error("META_CAPI_ACCESS_TOKEN is missing from .env.");
  if (!testEventCode) {
    throw new Error("META_TEST_EVENT_CODE is missing from .env; refusing to send a non-test event.");
  }

  const endpoint = new URL(`https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events`);
  endpoint.searchParams.set("access_token", accessToken);

  const payload = {
    data: [{
      event_name: "PageView",
      event_time: Math.floor(Date.now() / 1000),
      event_id: `shopnearbd-capi-test-${randomUUID()}`,
      action_source: "website",
      ...(process.env.NEXT_PUBLIC_SITE_URL?.trim()
        ? { event_source_url: process.env.NEXT_PUBLIC_SITE_URL.trim() }
        : {}),
      user_data: {
        client_ip_address: "127.0.0.1",
        client_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        em: [sha256("test@example.com")],
        ph: [sha256("8801700000000")],
      },
    }],
    test_event_code: testEventCode,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const responseBody = await response.text();

  console.log(`HTTP status: ${response.status} ${response.statusText}`);
  console.log("Response body:");
  try {
    console.log(JSON.stringify(JSON.parse(responseBody), null, 2));
  } catch {
    console.log(responseBody);
  }

  if (!response.ok) process.exitCode = 1;
  try {
    const result = JSON.parse(responseBody);
    if (Number(result.events_received) === 1) {
      console.log("Meta accepted the test event (events_received: 1).");
    } else {
      console.error(`Meta did not confirm one accepted event (events_received: ${result.events_received ?? "missing"}).`);
      process.exitCode = 1;
    }
  } catch {
    console.error("Meta returned a response that was not valid JSON.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Meta CAPI test failed: ${error.message}`);
  process.exitCode = 1;
});
