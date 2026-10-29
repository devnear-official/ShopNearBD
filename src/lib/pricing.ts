/**
 * Unit price rules — must match public.variant_unit_price() in the database.
 * The database is the source of truth at checkout; this copy exists for display.
 */
export type PriceSource = { price: number; sale_price: number | null };

export function unitPrice(product: PriceSource, variant: { price: number | null; sale_price: number | null }): number {
  if (variant.price !== null && variant.price !== undefined) return variant.sale_price ?? variant.price;
  return variant.sale_price ?? product.sale_price ?? product.price;
}

/** The "was" price shown with a strike-through, or null when not on sale. */
export function compareAtPrice(product: PriceSource, variant: { price: number | null; sale_price: number | null }): number | null {
  const base = variant.price ?? product.price;
  const now = unitPrice(product, variant);
  return now < base ? base : null;
}

export function couponDiscount(
  c: { type: "percent" | "fixed"; value: number; max_discount: number | null },
  subtotal: number,
): number {
  let d = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
  if (c.max_discount) d = Math.min(d, c.max_discount);
  return Math.min(d, subtotal);
}
