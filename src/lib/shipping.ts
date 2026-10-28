/** Bangladesh's 64 districts, grouped by division. Fees/zones come from site_settings.shipping. */
export const DIVISIONS: Record<string, string[]> = {
  Dhaka: ["Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj", "Madaripur", "Manikganj", "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari", "Shariatpur", "Tangail"],
  Chattogram: ["Bandarban", "Brahmanbaria", "Chandpur", "Chattogram", "Cox's Bazar", "Cumilla", "Feni", "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati"],
  Rajshahi: ["Bogura", "Joypurhat", "Naogaon", "Natore", "Chapainawabganj", "Pabna", "Rajshahi", "Sirajganj"],
  Khulna: ["Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"],
  Barishal: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
  Sylhet: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
  Rangpur: ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"],
  Mymensingh: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
};

export const DISTRICTS = Object.values(DIVISIONS).flat().sort((a, b) => a.localeCompare(b));

export type ShippingZone = { id: string; label: string; label_bn?: string; fee: number; eta?: string };
export type ShippingSettings = {
  zones: ShippingZone[];
  district_zones: Record<string, string[]>;
  default_zone: string;
  free_shipping_threshold: number | null;
};

/** Mirrors public.shipping_quote(). */
export function zonesForDistrict(s: ShippingSettings, district: string): ShippingZone[] {
  const ids = s.district_zones[district]?.length ? s.district_zones[district] : [s.default_zone];
  return ids.map((id) => s.zones.find((z) => z.id === id)).filter(Boolean) as ShippingZone[];
}

export function quoteShipping(s: ShippingSettings, district: string, zoneHint: string | null, subtotal: number) {
  const zones = zonesForDistrict(s, district);
  const zone = zones.find((z) => z.id === zoneHint) ?? zones[0];
  if (!zone) return null;
  const free = s.free_shipping_threshold !== null && s.free_shipping_threshold !== undefined && subtotal >= s.free_shipping_threshold;
  return { zone, fee: free ? 0 : zone.fee, free };
}
