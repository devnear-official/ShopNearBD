/** Customer-facing wording for the internal order state machine. */
export const CUSTOMER_STATUS: Record<string, { label: string; bn: string; detail: string }> = {
  pending: { label: "Order received", bn: "অর্ডার পেয়েছি", detail: "We'll call you shortly to confirm the order." },
  confirmed: { label: "Confirmed", bn: "নিশ্চিত হয়েছে", detail: "Your order is confirmed and waiting to be packed." },
  packed: { label: "Packed", bn: "প্যাক করা হয়েছে", detail: "Packed and waiting for the courier pickup." },
  shipped: { label: "On the way", bn: "পথে আছে", detail: "With the courier and on its way to you." },
  delivered: { label: "Delivered", bn: "ডেলিভারি হয়েছে", detail: "Delivered. Enjoy, and let us know how it is!" },
  cancelled: { label: "Cancelled", bn: "বাতিল", detail: "This order was cancelled." },
  returned: { label: "Returned", bn: "ফেরত", detail: "This order was returned." },
};
export const PROGRESS = ["pending", "confirmed", "packed", "shipped", "delivered"] as const;

export const PAYMENT_STATUS: Record<string, { label: string; tone: "neutral" | "warn" | "good" | "bad" }> = {
  unpaid: { label: "Not paid yet", tone: "neutral" },
  pending_verification: { label: "Payment submitted — awaiting verification", tone: "warn" },
  paid: { label: "Paid — verified", tone: "good" },
  failed: { label: "Payment could not be verified", tone: "bad" },
  refunded: { label: "Refunded", tone: "neutral" },
  partially_refunded: { label: "Partially refunded", tone: "neutral" },
};
export const METHOD_LABEL: Record<string, string> = { cod: "Cash on Delivery", bkash_manual: "bKash", nagad_manual: "Nagad" };
