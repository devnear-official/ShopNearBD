import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(value.trim().toLowerCase(), "utf8").digest("hex");
}

function loadEnvFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) return;

  for (const line of fs.readFileSync(resolvedPath, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trimStart().startsWith("#")) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    if (value && (!process.env[match[1]] || process.env[match[1]].trim() === "")) {
      process.env[match[1]] = value;
    }
  }
}

async function sendMetaEvent({
  endpoint,
  accessToken,
  pixelId,
  testEventCode,
  eventName,
  customData,
  userData,
  sourceUrl,
}) {
  const eventTime = Math.floor(Date.now() / 1000);
  const eventId = `test-${eventName.toLowerCase()}-${randomUUID()}`;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        ...(sourceUrl ? { event_source_url: sourceUrl } : {}),
        user_data: userData,
        custom_data: customData,
      },
    ],
    test_event_code: testEventCode,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  const responseText = await response.text();
  let parsedBody;
  try {
    parsedBody = JSON.parse(responseText);
  } catch {
    parsedBody = responseText;
  }

  return {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    payload,
    body: parsedBody,
  };
}

async function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const pixelId = process.env.META_PIXEL_ID?.trim() || "2302029777254670";
  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

  if (!accessToken) throw new Error("META_CAPI_ACCESS_TOKEN is missing from .env.");
  if (!testEventCode) throw new Error("META_TEST_EVENT_CODE is missing from .env.");

  console.log("==================================================");
  console.log(" Meta Conversions API (CAPI) Sequence Test Runner ");
  console.log("==================================================");
  console.log(`Pixel ID:        ${pixelId}`);
  console.log(`Test Event Code: ${testEventCode}`);
  console.log(`API Base:        https://graph.facebook.com/v19.0`);
  console.log("==================================================\n");

  const endpoint = new URL(`https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events`);
  endpoint.searchParams.set("access_token", accessToken);

  // Common hashed user data with valid dummy values
  const dummyUserData = {
    em: [sha256("test.customer@shopnear.shop")],
    ph: [sha256("8801700000000")],
    client_ip_address: "103.147.218.1",
    client_user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };

  const orderId = `SN-${Date.now().toString().slice(-6)}`;
  const sampleProduct = {
    id: "AUD-PULSE-PRO-MID",
    price: 2990,
    currency: "BDT",
  };

  // Sequence of standard eCommerce events requested:
  // 1. ViewContent (content_ids, content_type: 'product', value, currency)
  // 2. AddToCart (content_ids, value, currency)
  // 3. InitiateCheckout (num_items, value, currency)
  // 4. Purchase (order_id, value, currency)
  const eventSequence = [
    {
      step: 1,
      name: "ViewContent",
      customData: {
        content_ids: [sampleProduct.id],
        content_type: "product",
        value: sampleProduct.price,
        currency: sampleProduct.currency,
      },
    },
    {
      step: 2,
      name: "AddToCart",
      customData: {
        content_ids: [sampleProduct.id],
        content_type: "product",
        value: sampleProduct.price,
        currency: sampleProduct.currency,
      },
    },
    {
      step: 3,
      name: "InitiateCheckout",
      customData: {
        content_ids: [sampleProduct.id],
        num_items: 1,
        value: sampleProduct.price,
        currency: sampleProduct.currency,
      },
    },
    {
      step: 4,
      name: "Purchase",
      customData: {
        content_ids: [sampleProduct.id],
        order_id: orderId,
        value: sampleProduct.price,
        currency: sampleProduct.currency,
      },
    },
  ];

  let allPassed = true;

  for (const item of eventSequence) {
    console.log(`[Step ${item.step}/4] Sending '${item.name}'...`);
    console.log(`Custom Data: ${JSON.stringify(item.customData)}`);

    try {
      const result = await sendMetaEvent({
        endpoint,
        accessToken,
        pixelId,
        testEventCode,
        eventName: item.name,
        customData: item.customData,
        userData: dummyUserData,
        sourceUrl: `${siteUrl}/shop/pulse-anc-earbuds-pro`,
      });

      console.log(`Response Status: ${result.status} ${result.statusText}`);
      console.log("Response Body:", JSON.stringify(result.body, null, 2));

      if (result.ok && Number(result.body.events_received) >= 1) {
        console.log(`✓ '${item.name}' successfully received by Meta CAPI.\n`);
      } else {
        console.error(`✗ '${item.name}' failed or not confirmed by Meta CAPI.\n`);
        allPassed = false;
      }
    } catch (err) {
      console.error(`✗ Error sending '${item.name}':`, err.message, "\n");
      allPassed = false;
    }

    // Small delay between sequential events
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  if (!allPassed) {
    console.error("Some events in the sequence encountered errors.");
    process.exitCode = 1;
  } else {
    console.log("==================================================");
    console.log(" All 4 eCommerce events delivered successfully!  ");
    console.log(" Check Meta Events Manager Test Events tab.      ");
    console.log("==================================================");
  }
}

main().catch((err) => {
  console.error("Fatal script error:", err.message);
  process.exitCode = 1;
});
