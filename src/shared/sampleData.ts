// SAMPLE DATA ONLY. Invented products, stores, stock, offers and prices.
// None of this describes real Macy's inventory, stores or promotions.
// Do not edit from a feature account. Features must read data via the DataProvider prop.
import type { Category, DataProvider, InventoryRecord, Offer, Product, Store } from "./types";

const APPAREL = ["2", "4", "6", "8", "10", "12", "14", "16", "18", "20"];
const APPAREL_TO_14 = ["2", "4", "6", "8", "10", "12", "14"]; // intentionally excludes 16+ (missed-demand demo)
const SHOES = ["6", "7", "8", "9", "10", "11"];

const p = (x: Omit<Product, "isSampleData">): Product => ({ ...x, isSampleData: true });

export const SAMPLE_PRODUCTS: Product[] = [
  // ---- Work ----
  p({ id: "P01", name: "Relaxed Satin Blouse", brand: "Sample Label Studio", category: "top", occasions: ["work", "interview", "date-night"], colors: ["Ivory", "Navy"], sizes: APPAREL, price: 39, fit: { runs: "true", note: "True to size, relaxed through the body" }, swatchHex: "#F3EBDD" }),
  p({ id: "P02", name: "Ponte Knit Top", brand: "Sample Label Studio", category: "top", occasions: ["work", "casual"], colors: ["Black", "Burgundy"], sizes: APPAREL, price: 34, fit: { runs: "small", note: "Runs small, size up" }, swatchHex: "#7A1F2B" }),
  p({ id: "P03", name: "Sleeveless Shell", brand: "Sample Basics", category: "top", occasions: ["work"], colors: ["White", "Blush"], sizes: APPAREL, price: 29, fit: { runs: "true", note: "True to size" }, swatchHex: "#F2D4D0" }),
  p({ id: "P04", name: "Straight-Leg Trouser", brand: "Sample Label Studio", category: "bottom", occasions: ["work", "interview"], colors: ["Charcoal", "Navy"], sizes: APPAREL, price: 59, fit: { runs: "true", note: "True to size, hemmable length" }, swatchHex: "#3C4048" }),
  p({ id: "P05", name: "Pencil Skirt", brand: "Sample Basics", category: "bottom", occasions: ["work", "interview"], colors: ["Black", "Camel"], sizes: APPAREL, price: 49, fit: { runs: "small", note: "Runs small at the hip, size up" }, swatchHex: "#2B2B2B" }),
  p({ id: "P06", name: "Wide-Leg Pant", brand: "Sample Label Studio", category: "bottom", occasions: ["work", "casual"], colors: ["Olive", "Black"], sizes: APPAREL_TO_14, price: 64, fit: { runs: "large", note: "Runs large, consider sizing down" }, swatchHex: "#5B6142" }),
  p({ id: "P07", name: "Seamed Sheath Dress", brand: "Sample Label Studio", category: "dress", occasions: ["work", "interview", "event"], colors: ["Navy", "Black"], sizes: APPAREL, price: 89, fit: { runs: "true", note: "True to size, structured fit" }, swatchHex: "#1F3A5F" }),
  p({ id: "P08", name: "Jersey Wrap Dress", brand: "Sample Basics", category: "dress", occasions: ["work", "date-night", "wedding-guest"], colors: ["Emerald", "Print"], sizes: APPAREL, price: 79, fit: { runs: "large", note: "Runs slightly large, adjustable wrap" }, swatchHex: "#1E7A5A" }),
  p({ id: "P09", name: "One-Button Blazer", brand: "Sample Label Studio", category: "outerwear", occasions: ["work", "interview"], colors: ["Black", "Cream"], sizes: APPAREL, price: 99, fit: { runs: "small", note: "Runs small in the shoulders, size up" }, swatchHex: "#151515" }),
  p({ id: "P10", name: "Longline Cardigan", brand: "Sample Basics", category: "outerwear", occasions: ["work", "casual"], colors: ["Oatmeal", "Grey"], sizes: APPAREL, price: 45, fit: { runs: "large", note: "Oversized fit, size down for a closer fit" }, swatchHex: "#CBBBA0" }),
  p({ id: "P11", name: "Block-Heel Pump", brand: "Sample Footwear Co.", category: "shoes", occasions: ["work", "interview", "event"], colors: ["Black", "Nude"], sizes: SHOES, price: 69, fit: { runs: "true", note: "True to size, medium width" }, swatchHex: "#222222" }),
  p({ id: "P12", name: "Classic Loafer", brand: "Sample Footwear Co.", category: "shoes", occasions: ["work", "casual"], colors: ["Cognac", "Black"], sizes: SHOES, price: 59, fit: { runs: "small", note: "Runs a half size small" }, swatchHex: "#8B4A22" }),
  // ---- Casual / event ----
  p({ id: "P13", name: "High-Rise Straight Jean", brand: "Sample Denim", category: "bottom", occasions: ["casual"], colors: ["Mid Wash", "Black"], sizes: APPAREL, price: 49, fit: { runs: "true", note: "True to size, slight stretch" }, swatchHex: "#4A6A8F" }),
  p({ id: "P14", name: "Everyday Crew Tee", brand: "Sample Basics", category: "top", occasions: ["casual"], colors: ["White", "Heather"], sizes: APPAREL, price: 19, fit: { runs: "true", note: "True to size" }, swatchHex: "#EDEDED" }),
  p({ id: "P15", name: "Satin Midi Cocktail Dress", brand: "Sample Label Studio", category: "dress", occasions: ["event", "wedding-guest", "date-night"], colors: ["Champagne", "Sapphire"], sizes: APPAREL_TO_14, price: 119, fit: { runs: "small", note: "Runs small through the bust, size up" }, swatchHex: "#C9A96E" }),
  p({ id: "P16", name: "Canvas Sneaker", brand: "Sample Footwear Co.", category: "shoes", occasions: ["casual"], colors: ["White"], sizes: SHOES, price: 55, fit: { runs: "large", note: "Runs a half size large" }, swatchHex: "#F7F7F7" }),
  p({ id: "P17", name: "Statement Necklace", brand: "Sample Accessories", category: "accessory", occasions: ["event", "work", "date-night"], colors: ["Gold"], sizes: ["One Size"], price: 29, fit: { runs: "true", note: "One size" }, swatchHex: "#D4AF37" }),
];

export const SAMPLE_STORES: Store[] = [
  { id: "S-A", name: "Sample Store A (Downtown)", city: "Sample City", distanceMiles: 0, isSampleData: true },
  { id: "S-B", name: "Sample Store B (Northside Mall)", city: "Sample City", distanceMiles: 6.2, isSampleData: true },
  { id: "S-C", name: "Sample Store C (Lakeview)", city: "Sample City", distanceMiles: 11.5, isSampleData: true },
];

const LOCATION: Record<Category, { floor: string; department: string }> = {
  top: { floor: "2", department: "Women's Career & Tops" },
  bottom: { floor: "2", department: "Women's Career & Tops" },
  dress: { floor: "2", department: "Dresses" },
  outerwear: { floor: "2", department: "Coats & Jackets" },
  shoes: { floor: "1", department: "Women's Shoes" },
  accessory: { floor: "1", department: "Fashion Jewelry" },
};

// Deterministic pseudo-random stock (0-3) so demos are repeatable.
function hashQty(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 4;
}

// Hand-set stock for the demo scripts in docs/. Key = storeId|productId|size.
const STOCK_OVERRIDES: Record<string, number> = {
  "S-A|P01|16": 2, // blouse in stock at Store A
  "S-A|P04|16": 1, // trouser: last one at Store A
  "S-A|P07|16": 0, // sheath dress OUT at Store A ...
  "S-B|P07|16": 2, // ... but available at Store B (fallback demo)
  "S-C|P07|16": 0,
  "S-A|P09|16": 0, // blazer OUT in size 16 everywhere (ship-to-home demo)
  "S-B|P09|16": 0,
  "S-C|P09|16": 0,
  "S-A|P02|16": 3,
  "S-A|P03|16": 0, // shell out at Store A in 16
  "S-A|P05|16": 2,
  "S-A|P08|16": 1,
  "S-A|P09|18": 1, // size up for blazer (runs small) is available
};

export const SAMPLE_INVENTORY: InventoryRecord[] = SAMPLE_STORES.flatMap((s) =>
  SAMPLE_PRODUCTS.flatMap((prod) =>
    prod.sizes.map((size) => {
      const key = `${s.id}|${prod.id}|${size}`;
      return {
        storeId: s.id,
        productId: prod.id,
        size,
        qty: key in STOCK_OVERRIDES ? STOCK_OVERRIDES[key] : hashQty(key),
        ...LOCATION[prod.category],
      };
    })
  )
);

// Offers. The demo "now" is 2026-10-02, so validity below is deliberate.
const o = (x: Omit<Offer, "isSampleData">): Offer => ({ ...x, isSampleData: true });
export const SAMPLE_OFFERS: Offer[] = [
  o({ id: "O1", label: "Sample weekend offer: 20% off tops, bottoms and dresses", type: "percent", value: 20, categories: ["top", "bottom", "dress"], validFrom: "2026-10-01", validTo: "2026-10-05", requiresLogin: false, stackable: false }),
  o({ id: "O2", label: "Sample offer: $15 off purchases of $100 or more", type: "amount", value: 15, minSpend: 100, validFrom: "2026-09-28", validTo: "2026-10-10", requiresLogin: false, stackable: false }),
  o({ id: "O3", label: "Sample rewards offer: extra 10% for signed-in members", type: "percent", value: 10, validFrom: "2026-09-01", validTo: "2026-12-31", requiresLogin: true, stackable: true }),
  o({ id: "O4", label: "Sample offer: 30% off outerwear (EXPIRED)", type: "percent", value: 30, categories: ["outerwear"], validFrom: "2026-09-01", validTo: "2026-09-30", requiresLogin: false, stackable: false }),
  o({ id: "O5", label: "Sample offer: $25 off shoes (starts Oct 15)", type: "amount", value: 25, categories: ["shoes"], validFrom: "2026-10-15", validTo: "2026-10-20", requiresLogin: false, stackable: false }),
];

// Fixed demo clock: Friday Oct 2, 2026, 2:00 PM local.
export const DEMO_NOW = new Date(2026, 9, 2, 14, 0, 0);

export function createSampleDataProvider(): DataProvider {
  return {
    getProducts: () => SAMPLE_PRODUCTS,
    getProduct: (id) => SAMPLE_PRODUCTS.find((x) => x.id === id),
    getStores: () => SAMPLE_STORES,
    getStore: (id) => SAMPLE_STORES.find((x) => x.id === id),
    getInventory: (storeId, productId) =>
      SAMPLE_INVENTORY.filter((r) => r.storeId === storeId && r.productId === productId),
    getOffers: () => SAMPLE_OFFERS,
    now: () => new Date(DEMO_NOW.getTime()),
  };
}
