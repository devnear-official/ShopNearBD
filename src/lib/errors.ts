/** Maps stable error codes raised by database functions to customer-facing text. */
const messages: Record<string, string> = {
  CART_EMPTY: "Your cart is empty.",
  TOO_MANY_ITEMS: "That's a lot of items — please split it into two orders or contact us.",
  INVALID_PHONE: "Please enter a valid Bangladeshi mobile number (01XXXXXXXXX).",
  INVALID_QUANTITY: "Quantity must be between 1 and 20 per item.",
  PRODUCT_UNAVAILABLE: "One of the items is no longer available. Please review your cart.",
  OUT_OF_STOCK: "Sorry — one of the items just went out of stock. Please review your cart.",
  PAYMENT_METHOD_UNAVAILABLE: "That payment method isn't available right now.",
  INVALID_TXID: "That transaction ID doesn't look right. It's usually 8–10 letters and numbers.",
  INVALID_SENDER: "Enter the mobile number you sent the payment from.",
  TXID_USED: "This transaction ID has already been used. Please check it and try again.",
  COUPON_INVALID: "That coupon code isn't valid.",
  COUPON_NOT_STARTED: "That coupon isn't active yet.",
  COUPON_EXPIRED: "That coupon has expired.",
  COUPON_EXHAUSTED: "That coupon has been fully used.",
  COUPON_MIN_SUBTOTAL: "Add a bit more to your cart to use this coupon.",
  COUPON_PHONE_LIMIT: "This coupon has already been used with this phone number.",
  DISTRICT_REQUIRED: "Please choose your district.",
  ZONE_NOT_CONFIGURED: "Delivery to this area isn't configured yet. Please contact us.",
  ORDER_NOT_FOUND: "We couldn't find that order.",
  ORDER_CLOSED: "This order is closed.",
  PAYMENT_ALREADY_SUBMITTED: "A payment for this order is already waiting for verification.",
  RATE_LIMITED: "Too many attempts. Please wait a minute and try again.",
  FORBIDDEN: "You don't have permission to do that.",
  INVALID_TRANSITION: "That status change isn't allowed from the current status.",
  PAYMENT_ALREADY_REVIEWED: "This payment has already been reviewed.",
  REFUND_EXCEEDS_PAID: "The refund is larger than the amount collected.",
  STOCK_NEGATIVE: "Stock can't go below zero.",
  NOTE_REQUIRED: "Please add a short note.",
  INVALID_AMOUNT: "Enter a valid amount.",
  NOT_COD: "This order isn't Cash on Delivery.",
};

export function dbErrorCode(e: unknown): string | null {
  const m = (e as { message?: string })?.message;
  if (m && /^[A-Z_]+$/.test(m)) return m;
  return null;
}

export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const code = dbErrorCode(e);
  if (code && messages[code]) return messages[code];
  return fallback;
}

export class AppError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
