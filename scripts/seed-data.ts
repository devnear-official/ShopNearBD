/** Development seed catalogue. Prices in BDT. Replace with real products before launch. */
import type { Palette } from "./seed-assets/art";

export type SeedVariant = { name: string; sku: string; options: Record<string, string>; stock: number; price?: number; sale_price?: number; palette?: Palette };
export type SeedProduct = {
  slug: string; sku: string; name: string; name_bn: string; category: string; art: string;
  price: number; sale_price?: number; cost_price?: number; short: string; description: string;
  specs: [string, string][]; tags: string[]; collections?: string[]; featured?: boolean;
  option_names?: string[]; variants: SeedVariant[]; palette: Palette; bg: [string, string]; sold?: number;
};

export const categories = [
  { slug: "audio", name: "Audio", name_bn: "অডিও", accent: "#1E6BFF", description: "Earphones, earbuds and speakers tuned for everyday listening." },
  { slug: "wearables", name: "Wearables", name_bn: "ওয়্যারেবল", accent: "#00B3FF", description: "Smart watches and fitness bands." },
  { slug: "power", name: "Power & Charging", name_bn: "চার্জিং", accent: "#FF7A1A", description: "Power banks, fast chargers and cables that survive load-shedding." },
  { slug: "home", name: "Home & Kitchen", name_bn: "ঘর ও রান্নাঘর", accent: "#10B981", description: "Small appliances that make Dhaka flats more comfortable." },
  { slug: "bags", name: "Bags & Travel", name_bn: "ব্যাগ", accent: "#7C3AED", description: "Backpacks and slings built for buses, bikes and rain." },
  { slug: "lifestyle", name: "Lifestyle", name_bn: "লাইফস্টাইল", accent: "#F43F5E", description: "Bottles, fans and small things you carry every day." },
];

const v = (name: string, sku: string, color: string, stock: number, palette: Palette, extra: Partial<SeedVariant> = {}): SeedVariant =>
  ({ name, sku, options: { Color: color }, stock, palette, ...extra });

export const products: SeedProduct[] = [
  {
    slug: "kiki-type-c-earphones", sku: "AUD-KIKI-C", name: "Kiki Type-C Earphones", name_bn: "কিকি টাইপ-সি ইয়ারফোন", category: "audio", art: "earphones",
    price: 450, sale_price: 390, cost_price: 210, featured: true, sold: 184,
    short: "Wired USB-C earphones with an in-line mic and a tangle-resistant flat cable.",
    description: "Plug straight into any USB-C phone — no dongle. 10 mm dynamic drivers give clear vocals for calls and a warm low end for music. The flat cable resists tangling in your pocket, and the in-line remote handles play/pause and calls.",
    specs: [["Connector", "USB-C (digital DAC)"], ["Driver", "10 mm dynamic"], ["Cable", "1.2 m flat TPE"], ["Mic", "In-line, with remote"], ["Warranty", "3 months replacement"]],
    tags: ["earphones", "type-c", "wired", "mic", "ইয়ারফোন"], option_names: ["Color"],
    palette: { body: "#1B2236", accent: "#2FC6FF" }, bg: ["#DDEBFF", "#F6F9FF"],
    variants: [v("Black", "AUD-KIKI-C-BLK", "Black", 60, { body: "#1B2236", accent: "#2FC6FF" }), v("White", "AUD-KIKI-C-WHT", "White", 3, { body: "#E9EEF6", accent: "#1E6BFF" })],
  },
  {
    slug: "pulse-anc-earbuds-pro", sku: "AUD-PULSE-PRO", name: "Pulse ANC Earbuds Pro", name_bn: "পালস এএনসি ইয়ারবাডস প্রো", category: "audio", art: "earbuds",
    price: 3490, sale_price: 2990, cost_price: 1800, featured: true, sold: 96, collections: ["commute-kit"],
    short: "Hybrid noise cancelling that quiets bus engines and traffic, with 32 hours total battery.",
    description: "Hybrid active noise cancellation takes the edge off engine rumble and horns on your commute. Transparency mode lets you hear announcements without taking a bud out. Six hours per charge, 32 hours with the case, and a 10-minute charge gives you another two hours.",
    specs: [["ANC", "Hybrid, up to 35 dB"], ["Battery", "6 h buds · 32 h with case"], ["Charging", "USB-C, fast charge"], ["Bluetooth", "5.3, multipoint"], ["Water resistance", "IPX4"], ["Warranty", "6 months"]],
    tags: ["earbuds", "anc", "bluetooth", "tws", "noise cancelling"], option_names: ["Color"],
    palette: { body: "#20283D", accent: "#FF7A1A" }, bg: ["#D6E6FF", "#F2F7FF"],
    variants: [v("Midnight", "AUD-PULSE-PRO-MID", "Midnight", 24, { body: "#20283D", accent: "#FF7A1A" }), v("Ice Blue", "AUD-PULSE-PRO-ICE", "Ice Blue", 11, { body: "#B9DCFF", accent: "#1E6BFF" })],
  },
  {
    slug: "bassbox-mini-speaker", sku: "AUD-BASSBOX", name: "Bassbox Mini Bluetooth Speaker", name_bn: "বেসবক্স মিনি স্পিকার", category: "audio", art: "speaker",
    price: 1850, cost_price: 1050, sold: 61,
    short: "Pocket-sized 10 W speaker with a carry strap, 12-hour battery and splash resistance.",
    description: "A palm-sized speaker that fills a room. The passive radiator adds real bass, the strap clips onto a bag, and IPX5 splash resistance means a monsoon shower won't stop the music. Pair two for stereo.",
    specs: [["Output", "10 W"], ["Battery", "12 hours"], ["Bluetooth", "5.3, TWS pairing"], ["Water resistance", "IPX5"], ["Weight", "310 g"]],
    tags: ["speaker", "bluetooth", "portable"], option_names: ["Color"],
    palette: { body: "#1D3A8A", accent: "#FF7A1A" }, bg: ["#FFE6D3", "#FFF6EE"],
    variants: [v("Navy", "AUD-BASSBOX-NVY", "Navy", 18, { body: "#1D3A8A", accent: "#FF7A1A" }), v("Sunset", "AUD-BASSBOX-SUN", "Sunset", 9, { body: "#FF6A2B", accent: "#1B2236" })],
  },
  {
    slug: "orbit-smart-watch-s2", sku: "WR-ORBIT-S2", name: "Orbit Smart Watch S2", name_bn: "অরবিট স্মার্ট ওয়াচ এস২", category: "wearables", art: "watch",
    price: 2790, sale_price: 2390, cost_price: 1500, featured: true, sold: 133,
    short: "1.9\" AMOLED, Bluetooth calling, heart-rate and SpO₂ — with a 7-day battery.",
    description: "A bright 1.9-inch AMOLED screen you can read in Dhaka sunlight. Take calls from your wrist, track steps, heart rate, SpO₂ and sleep, and get WhatsApp and Messenger notifications. Charges fully in about two hours and lasts up to a week.",
    specs: [["Display", "1.9\" AMOLED, 410×502"], ["Battery", "Up to 7 days"], ["Calling", "Bluetooth calling"], ["Sensors", "Heart rate, SpO₂, sleep"], ["Water resistance", "IP67"], ["Warranty", "6 months"]],
    tags: ["smart watch", "bluetooth calling", "fitness", "ঘড়ি"], option_names: ["Color"],
    palette: { body: "#1B2236", accent: "#FF7A1A" }, bg: ["#E3E9F5", "#F8FAFE"],
    variants: [v("Midnight", "WR-ORBIT-S2-MID", "Midnight", 14, { body: "#1B2236", accent: "#FF7A1A" }), v("Ocean", "WR-ORBIT-S2-OCN", "Ocean", 2, { body: "#1E6BFF", accent: "#FFB020" })],
  },
  {
    slug: "fit-band-7", sku: "WR-FITBAND-7", name: "Fit Band 7", name_bn: "ফিট ব্যান্ড ৭", category: "wearables", art: "band",
    price: 1450, cost_price: 820, sold: 47,
    short: "Light fitness band with step, heart-rate and sleep tracking and a 14-day battery.",
    description: "Barely noticeable on the wrist at 24 g. Tracks steps, heart rate and sleep, buzzes for calls and messages, and goes two weeks between charges.",
    specs: [["Display", "1.1\" colour"], ["Battery", "Up to 14 days"], ["Weight", "24 g"], ["Water resistance", "5 ATM"]],
    tags: ["fitness band", "tracker"], option_names: ["Color"],
    palette: { body: "#10B981", accent: "#FFB020" }, bg: ["#D9F7EC", "#F3FDF9"],
    variants: [v("Mint", "WR-FITBAND-7-MNT", "Mint", 20, { body: "#10B981", accent: "#FFB020" }), v("Graphite", "WR-FITBAND-7-GRP", "Graphite", 0, { body: "#374151", accent: "#2FC6FF" })],
  },
  {
    slug: "voltgo-20000-power-bank", sku: "PWR-VOLTGO-20K", name: "VoltGo 20000mAh Power Bank", name_bn: "ভোল্টগো ২০০০০ পাওয়ার ব্যাংক", category: "power", art: "powerbank",
    price: 1990, sale_price: 1690, cost_price: 1100, featured: true, sold: 211, collections: ["commute-kit"],
    short: "22.5 W fast charging, three outputs and enough capacity to ride out a long load-shedding.",
    description: "Charges a typical phone four to five times. 22.5 W output fast-charges supported phones, the USB-C port works both ways, and the four-LED gauge shows what's left. Protection against overcharge, short circuit and overheating.",
    specs: [["Capacity", "20000 mAh (74 Wh)"], ["Output", "22.5 W max, 2× USB-A + USB-C"], ["Input", "USB-C 18 W"], ["Recharge time", "~6.5 hours"], ["Weight", "395 g"], ["Warranty", "6 months"]],
    tags: ["power bank", "fast charging", "20000mah", "পাওয়ার ব্যাংক"], option_names: ["Color"],
    palette: { body: "#1E6BFF", accent: "#7CF0FF" }, bg: ["#D8E7FF", "#F4F8FF"],
    variants: [v("Electric Blue", "PWR-VOLTGO-20K-BLU", "Electric Blue", 40, { body: "#1E6BFF", accent: "#7CF0FF" }), v("Carbon", "PWR-VOLTGO-20K-CRB", "Carbon", 17, { body: "#2A3247", accent: "#FF7A1A" })],
  },
  {
    slug: "65w-gan-charger", sku: "PWR-GAN-65", name: "65W GaN 3-Port Charger", name_bn: "৬৫ ওয়াট গ্যান চার্জার", category: "power", art: "charger",
    price: 1650, cost_price: 980, sold: 58,
    short: "Charge a laptop, phone and earbuds at once from one compact, cool-running plug.",
    description: "Gallium-nitride parts make this 65 W charger half the size of a laptop brick. Two USB-C ports and one USB-A share power intelligently. Two-pin plug for Bangladeshi sockets.",
    specs: [["Total output", "65 W"], ["Ports", "2× USB-C PD, 1× USB-A QC"], ["Plug", "2-pin (Type C/D compatible)"], ["Input", "100–240 V"]],
    tags: ["charger", "gan", "65w", "laptop charger"],
    palette: { body: "#F3F6FB", accent: "#1E6BFF" }, bg: ["#FFE3CF", "#FFF7F1"],
    variants: [{ name: "Default", sku: "PWR-GAN-65-STD", options: {}, stock: 25 }],
  },
  {
    slug: "braided-usb-c-cable", sku: "PWR-CABLE-C", name: "Braided USB-C to USB-C Cable", name_bn: "ব্রেইডেড ইউএসবি-সি কেবল", category: "power", art: "cable",
    price: 350, cost_price: 140, sold: 302,
    short: "60 W rated nylon-braided cable that survives being yanked, bent and stepped on.",
    description: "Double-braided nylon and reinforced joints tested to 20,000 bends. Rated for 60 W charging and 480 Mbps data.",
    specs: [["Rating", "60 W, 480 Mbps"], ["Jacket", "Double nylon braid"], ["Bend test", "20,000 cycles"]],
    tags: ["cable", "usb-c", "type-c"], option_names: ["Length"],
    palette: { body: "#FF7A1A", accent: "#1B2236" }, bg: ["#E7ECF6", "#F8FAFD"],
    variants: [
      { name: "1 m", sku: "PWR-CABLE-C-1M", options: { Length: "1 m" }, stock: 80 },
      { name: "2 m", sku: "PWR-CABLE-C-2M", options: { Length: "2 m" }, stock: 45, price: 450 },
    ],
  },
  {
    slug: "breeze-rechargeable-desk-fan", sku: "HOME-BREEZE", name: "Breeze Rechargeable Desk Fan", name_bn: "ব্রিজ রিচার্জেবল ফ্যান", category: "home", art: "fan",
    price: 1290, sale_price: 1090, cost_price: 640, featured: true, sold: 167,
    short: "Four speeds, quiet motor and up to 10 hours on battery for load-shedding nights.",
    description: "A 4000 mAh battery keeps air moving when the power goes. Four speeds, a near-silent brushless motor for sleeping, and a tilting head. Charges by USB-C, so your power bank can top it up too.",
    specs: [["Battery", "4000 mAh, up to 10 h (low)"], ["Speeds", "4"], ["Charging", "USB-C"], ["Noise", "< 30 dB on low"]],
    tags: ["fan", "rechargeable", "load shedding", "ফ্যান"], option_names: ["Color"],
    palette: { body: "#E8EEF8", accent: "#1E6BFF" }, bg: ["#D5F3FF", "#F1FBFF"],
    variants: [v("Cloud", "HOME-BREEZE-CLD", "Cloud", 30, { body: "#E8EEF8", accent: "#1E6BFF" }), v("Peach", "HOME-BREEZE-PCH", "Peach", 12, { body: "#FFD9C2", accent: "#FF6A2B" })],
  },
  {
    slug: "brew-electric-kettle", sku: "HOME-BREW-18", name: "Brew 1.8L Electric Kettle", name_bn: "ব্রু ইলেকট্রিক কেটলি", category: "home", art: "kettle",
    price: 1750, cost_price: 1020, sold: 39,
    short: "Food-grade stainless steel, boils 1.8 L in about five minutes with auto shut-off.",
    description: "Stainless-steel interior with no plastic touching the water, 1500 W heating, boil-dry protection and automatic shut-off. The 360° base makes it easy to lift from any side.",
    specs: [["Capacity", "1.8 L"], ["Power", "1500 W"], ["Material", "SUS304 stainless steel"], ["Safety", "Auto shut-off, boil-dry protection"]],
    tags: ["kettle", "kitchen", "tea", "কেটলি"],
    palette: { body: "#C9D3E3", accent: "#FF7A1A" }, bg: ["#DDF5EA", "#F4FCF8"],
    variants: [{ name: "Default", sku: "HOME-BREW-18-STD", options: {}, stock: 16 }],
  },
  {
    slug: "glow-led-desk-lamp", sku: "HOME-GLOW", name: "Glow LED Desk Lamp", name_bn: "গ্লো এলইডি ডেস্ক ল্যাম্প", category: "home", art: "lamp",
    price: 1390, cost_price: 760, sold: 28,
    short: "Flicker-free study light with three colour temperatures and a USB charging port.",
    description: "Flicker-free LEDs that are easy on the eyes for late study sessions. Three colour temperatures, stepless dimming, and a USB-A port in the base to charge your phone.",
    specs: [["Brightness", "Up to 500 lux"], ["Colour temperature", "3000 K / 4500 K / 6000 K"], ["Extras", "USB-A charging port"]],
    tags: ["lamp", "study", "led"], option_names: ["Color"],
    palette: { body: "#2A3247", accent: "#FFB020" }, bg: ["#FFF0C9", "#FFFAEE"],
    variants: [v("Charcoal", "HOME-GLOW-CHR", "Charcoal", 13, { body: "#2A3247", accent: "#FFB020" }), v("Snow", "HOME-GLOW-SNW", "Snow", 7, { body: "#EEF2F8", accent: "#FF7A1A" })],
  },
  {
    slug: "commuter-backpack-25l", sku: "BAG-COMMUTER-25", name: "Commuter Backpack 25L", name_bn: "কমিউটার ব্যাকপ্যাক ২৫ লিটার", category: "bags", art: "backpack",
    price: 2450, sale_price: 2190, cost_price: 1300, featured: true, sold: 74, collections: ["commute-kit"],
    short: "Water-resistant shell, padded 15.6\" laptop sleeve and a hidden anti-theft pocket.",
    description: "The shell sheds monsoon rain and the zips are water-resistant. A padded sleeve fits laptops up to 15.6 inches, and a hidden back pocket keeps your phone and wallet away from crowded-bus hands.",
    specs: [["Capacity", "25 L"], ["Laptop", "Up to 15.6\""], ["Material", "600D polyester, PU coated"], ["Weight", "780 g"]],
    tags: ["backpack", "laptop bag", "water resistant", "ব্যাগ"], option_names: ["Color"],
    palette: { body: "#2A3247", accent: "#FF7A1A" }, bg: ["#E6E0FF", "#F7F5FF"],
    variants: [v("Charcoal", "BAG-COMMUTER-25-CHR", "Charcoal", 22, { body: "#2A3247", accent: "#FF7A1A" }), v("Navy", "BAG-COMMUTER-25-NVY", "Navy", 15, { body: "#1D3A8A", accent: "#2FC6FF" })],
  },
  {
    slug: "city-sling-bag", sku: "BAG-SLING", name: "City Sling Bag", name_bn: "সিটি স্লিং ব্যাগ", category: "bags", art: "sling",
    price: 990, cost_price: 480, sold: 52,
    short: "Wear it front or back — fits a phone, power bank, wallet and keys.",
    description: "A slim crossbody you can swing to the front in a crowd. Water-resistant fabric and a padded back panel.",
    specs: [["Capacity", "3 L"], ["Strap", "Adjustable 70–130 cm"], ["Material", "Water-resistant nylon"]],
    tags: ["sling", "crossbody", "bag"], option_names: ["Color"],
    palette: { body: "#7C3AED", accent: "#FFB020" }, bg: ["#F1E6FF", "#FBF8FF"],
    variants: [v("Violet", "BAG-SLING-VLT", "Violet", 19, { body: "#7C3AED", accent: "#FFB020" }), v("Black", "BAG-SLING-BLK", "Black", 26, { body: "#1B2236", accent: "#FF7A1A" })],
  },
  {
    slug: "steel-water-bottle-750", sku: "LIFE-BOTTLE-750", name: "Insulated Steel Bottle 750ml", name_bn: "স্টিল ওয়াটার বোতল", category: "lifestyle", art: "bottle",
    price: 650, cost_price: 300, sold: 143,
    short: "Keeps water cold for 24 hours in Dhaka heat. Leak-proof lid, fits a cup holder.",
    description: "Double-wall vacuum insulation keeps drinks cold for 24 hours or hot for 12. The leak-proof lid has a carry loop and the powder coat doesn't sweat.",
    specs: [["Capacity", "750 ml"], ["Insulation", "Double-wall vacuum"], ["Cold / hot", "24 h / 12 h"], ["Material", "18/8 stainless steel"]],
    tags: ["bottle", "water bottle", "insulated", "বোতল"], option_names: ["Color"],
    palette: { body: "#1E6BFF", accent: "#0B1530" }, bg: ["#D8F0FF", "#F3FAFF"],
    variants: [
      v("Blue", "LIFE-BOTTLE-750-BLU", "Blue", 35, { body: "#1E6BFF", accent: "#0B1530" }),
      v("Orange", "LIFE-BOTTLE-750-ORG", "Orange", 21, { body: "#FF7A1A", accent: "#0B1530" }),
      v("Black", "LIFE-BOTTLE-750-BLK", "Black", 4, { body: "#1B2236", accent: "#FF7A1A" }),
    ],
  },
  {
    slug: "airloop-neck-fan", sku: "LIFE-AIRLOOP", name: "AirLoop Bladeless Neck Fan", name_bn: "এয়ারলুপ নেক ফ্যান", category: "lifestyle", art: "neckfan",
    price: 1190, sale_price: 890, cost_price: 520, featured: true, sold: 121, collections: ["commute-kit"],
    short: "Hands-free cooling for the walk to the bus stop. No blades to catch your hair.",
    description: "Air flows through 78 vents along the band with no exposed blades. Three speeds, up to 8 hours per charge, and a weight of 260 g that sits lightly on the shoulders.",
    specs: [["Battery", "4000 mAh, 3–8 h"], ["Speeds", "3"], ["Weight", "260 g"], ["Charging", "USB-C"]],
    tags: ["neck fan", "portable fan", "summer"], option_names: ["Color"],
    palette: { body: "#F3F6FB", accent: "#1E6BFF" }, bg: ["#CFEFFF", "#EFFAFF"],
    variants: [v("Cloud", "LIFE-AIRLOOP-CLD", "Cloud", 28, { body: "#F3F6FB", accent: "#1E6BFF" }), v("Coral", "LIFE-AIRLOOP-CRL", "Coral", 10, { body: "#FF8A65", accent: "#1B2236" })],
  },
];

export const faqs = [
  { q: "How long does delivery take?", a: "Inside Dhaka city: usually 1–2 days. Dhaka suburbs (Savar, Gazipur, Narayanganj): 2–3 days. Outside Dhaka: 3–5 days. Orders confirmed before 5 pm are dispatched the same day.", tags: ["delivery", "shipping", "ডেলিভারি", "koto din"] },
  { q: "Can I pay cash on delivery?", a: "Yes. Cash on Delivery is available all over Bangladesh. You can also pay in advance by bKash or Nagad Send Money; we confirm the payment manually before shipping.", tags: ["payment", "cod", "bkash", "nagad", "টাকা"] },
  { q: "How do I check my order status?", a: "Use the order link on your confirmation page (it is also saved in this browser). For privacy we never share order details using only a phone number or order number.", tags: ["order", "status", "track", "অর্ডার"] },
  { q: "Can I return a product?", a: "Unused items in their original packaging can be returned within 7 days of delivery. If something arrives damaged or wrong, tell us within 24 hours and we will replace it at no cost.", tags: ["return", "refund", "exchange", "ফেরত"] },
  { q: "Can I open the parcel before paying?", a: "You may check the outer packaging and the product in front of the delivery person. If anything is wrong you can refuse the parcel and pay only the delivery charge (or nothing if it was our mistake).", tags: ["check", "open parcel", "delivery"] },
  { q: "Do products have a warranty?", a: "Electronics carry the warranty shown on each product page. Keep the box and your order number for claims.", tags: ["warranty", "guarantee", "ওয়ারেন্টি"] },
];
