/**
 * WhatsApp click-to-chat helpers (wa.me links). No API or token: the link opens WhatsApp
 * with the message pre-filled and the person presses send.
 */

/** International digits for a Bangladeshi number (01712-345678 → 8801712345678), or null if it doesn't look like one. */
export function waNumber(raw: string | null | undefined): string | null {
  const bn = "০১২৩৪৫৬৭৮৯";
  const digits = (raw ?? "").replace(/[০-৯]/g, (d) => String(bn.indexOf(d))).replace(/\D/g, "");
  const intl = digits.replace(/^00/, "").replace(/^880/, "0");
  return /^01[3-9]\d{8}$/.test(intl) ? "88" + intl : null;
}

export function waLink(raw: string | null | undefined, text: string): string | null {
  const n = waNumber(raw);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

/** The order-confirmation message the admin sends from the order page (Bangla greeting, order facts, a clear reply word). */
export function confirmMessage(o: { store: string; name: string; orderNumber: string; items: string; total: number; method: "cod" | "bkash_manual" | "nagad_manual"; address: string; district: string }) {
  const pay = o.method === "cod" ? "ক্যাশ অন ডেলিভারি" : o.method === "bkash_manual" ? "bKash" : "Nagad";
  return [
    `আসসালামু আলাইকুম ${o.name}, ${o.store} থেকে বলছি।`,
    `আপনার অর্ডার ${o.orderNumber} পেয়েছি:`,
    o.items,
    `মোট: ৳${o.total.toLocaleString("en-BD")} (${pay})`,
    `ঠিকানা: ${o.address}, ${o.district}`,
    ``,
    `অর্ডারটি কনফার্ম করতে "YES" লিখে রিপ্লাই দিন। কোনো পরিবর্তন লাগলে জানান। ধন্যবাদ!`,
  ].join("\n");
}
