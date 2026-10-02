/**
 * SHARED SAMPLE DATA — the single catalog, store list and inventory for the whole prototype.
 *
 * Everything here is FICTIONAL. Store names, addresses, prices, stock levels, floors and
 * departments are invented for demo purposes and must always be labelled as sample data in the UI.
 * IDs are stable: never rename them; add new rows instead.
 *
 * Teammates: extend this file (e.g. add offers / tax / delivery assumptions for Price & Handoff)
 * rather than creating another catalog. Append only, so merges stay trivial.
 */
import type { InventoryRecord, Occasion, Product, StockStatus, Store } from './types';

export const SAMPLE_DATA_LABEL = 'Sample data — not live inventory, prices or store details';

export const OCCASIONS: Occasion[] = [
  { id: 'work', label: 'Work' },
  { id: 'casual', label: 'Casual' },
  { id: 'evening', label: 'Evening out' },
  { id: 'wedding-guest', label: 'Wedding guest' },
];

export const STORES: Store[] = [
  { id: 'store-downtown', name: 'Downtown Flagship', address: '100 Sample Avenue, Sampleville (fictional)' },
  { id: 'store-lakeside', name: 'Lakeside Center', address: '250 Example Boulevard, Lakeside (fictional)' },
  { id: 'store-westgate', name: 'Westgate Mall', address: '8 Demo Parkway, Westgate (fictional)' },
];

// ---------------------------------------------------------------------------
// Product images: self-contained SVG placeholders (no network, no real photos).
// ---------------------------------------------------------------------------

const SILHOUETTES: Record<string, string> = {
  top: 'M40 40 L56 30 Q62 44 70 44 Q78 44 84 30 L100 40 L114 72 L96 78 L92 66 L92 134 L48 134 L48 66 L44 78 L26 72 Z',
  bottom: 'M44 36 H96 L104 152 H76 L70 82 L64 152 H36 Z',
  dress: 'M58 28 H82 L86 70 L108 154 H32 L54 70 Z',
  outerwear: 'M40 34 L58 26 L70 58 L82 26 L100 34 L118 84 L106 152 H34 L22 84 Z',
};

function placeholderImage(category: string, fill: string): string {
  const shape = SILHOUETTES[category] ?? SILHOUETTES.top;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 180">` +
    `<rect width="140" height="180" fill="#f3efe9"/>` +
    `<path d="${shape}" fill="${fill}" stroke="#00000022" stroke-width="2" stroke-linejoin="round"/>` +
    `<text x="70" y="172" font-family="sans-serif" font-size="9" fill="#7a7168" text-anchor="middle">SAMPLE IMAGE</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const NUMERIC = ['4', '6', '8', '10', '12', '14', '16', '18', '20'];
const NUMERIC_NO_4 = NUMERIC.slice(1);
const NUMERIC_TO_18 = NUMERIC.slice(0, -1);
const LETTER = ['XS', 'S', 'M', 'L', 'XL'];

function product(
  id: string,
  name: string,
  category: string,
  price: number,
  availableSizes: string[],
  fitNote: string,
  color: string,
): Product {
  return { id, name, imageUrl: placeholderImage(category, color), availableSizes, price, category, fitNote };
}

export const PRODUCTS: Product[] = [
  // Work & office (numeric sizes)
  product('prod-silk-blouse', 'Ivory Silk-Blend Blouse', 'top', 48, NUMERIC, 'Relaxed through the body; true to size.', '#efe6d2'),
  product('prod-oxford-shirt', 'Crisp Oxford Shirt', 'top', 42, NUMERIC, 'Slightly fitted at the waist; size up if layering.', '#cfdcec'),
  product('prod-shell-top', 'Sleeveless Shell Top', 'top', 34, NUMERIC_NO_4, 'Close through the shoulders; true to size.', '#d9c3c3'),
  product('prod-ponte-trouser', 'Ponte Straight Trouser', 'bottom', 59, NUMERIC, 'Mid-rise with stretch; true to size.', '#3d4a5c'),
  product('prod-wide-leg-trouser', 'Wide-Leg Crepe Trouser', 'bottom', 64, NUMERIC_NO_4, 'Roomy through the leg; runs slightly long.', '#2f3a38'),
  product('prod-pencil-skirt', 'Stretch Pencil Skirt', 'bottom', 45, NUMERIC_TO_18, 'Close through the hips; size up for more room.', '#4b3a3f'),
  product('prod-tailored-blazer', 'Tailored One-Button Blazer', 'outerwear', 89, NUMERIC, 'Structured shoulders; true to size.', '#2b3445'),
  product('prod-longline-cardigan', 'Longline Knit Cardigan', 'outerwear', 52, NUMERIC, 'Soft drape with a relaxed fit.', '#a9a08f'),
  product('prod-sheath-dress', 'Classic Sheath Dress', 'dress', 98, NUMERIC, 'Fitted through the waist; falls at the knee.', '#34404f'),
  product('prod-wrap-dress', 'Jersey Wrap Dress', 'dress', 86, NUMERIC, 'Adjustable wrap waist; forgiving fit.', '#6b4f5e'),
  // Evening & wedding guest (numeric sizes)
  product('prod-satin-slip-dress', 'Satin Slip Dress', 'dress', 120, NUMERIC_TO_18, 'Bias cut with a close drape; true to size.', '#7a2f48'),
  product('prod-velvet-dress', 'Velvet Evening Dress', 'dress', 145, NUMERIC, 'Fitted bodice, flared skirt; runs slightly small.', '#2c2350'),
  product('prod-sequin-top', 'Sequin Shell Top', 'top', 75, NUMERIC_TO_18, 'Slim fit; size up between sizes.', '#b99a54'),
  product('prod-satin-skirt', 'Satin Midi Skirt', 'bottom', 68, NUMERIC, 'Elastic back waist; true to size.', '#52304a'),
  product('prod-evening-wrap', 'Beaded Evening Wrap', 'outerwear', 79, NUMERIC, 'Open front, one drape length; true to size.', '#6e5b86'),
  product('prod-floral-midi', 'Floral Midi Dress', 'dress', 110, NUMERIC, 'A-line skirt with a smocked bodice; true to size.', '#c98a9b'),
  product('prod-chiffon-dress', 'Chiffon Maxi Dress', 'dress', 130, NUMERIC_NO_4, 'Lined and flowy; runs slightly long.', '#8fa8a3'),
  product('prod-lace-shrug', 'Lace Occasion Shrug', 'outerwear', 45, NUMERIC, 'Cropped, three-quarter sleeve; true to size.', '#e3d6cc'),
  // Casual (numeric sizes)
  product('prod-boxy-tee', 'Boxy Cotton Tee', 'top', 24, NUMERIC, 'Intentionally roomy; size down for a closer fit.', '#e8e2d6'),
  product('prod-knit-sweater', 'Merino-Blend Crewneck Sweater', 'top', 58, NUMERIC, 'Relaxed fit; true to size.', '#8d9b8a'),
  product('prod-denim-jean', 'Straight-Leg Denim Jean', 'bottom', 55, NUMERIC, 'High rise with a little stretch; true to size.', '#4a6a8c'),
  product('prod-linen-pant', 'Linen-Blend Drawstring Pant', 'bottom', 49, NUMERIC, 'Relaxed through the leg; true to size.', '#c9b99a'),
  product('prod-denim-jacket', 'Classic Denim Jacket', 'outerwear', 75, NUMERIC, 'Cropped at the waist; true to size.', '#5b7fa3'),
  // Casual (letter sizes)
  product('prod-cotton-tee', 'Everyday Cotton Tee', 'top', 18, LETTER, 'Soft and slightly fitted; true to size.', '#d8d3cb'),
  product('prod-knit-henley', 'Waffle Knit Henley', 'top', 32, LETTER, 'Relaxed fit; true to size.', '#b7a58d'),
  product('prod-jogger', 'Terry Jogger', 'bottom', 38, LETTER, 'Tapered leg with elastic cuffs; true to size.', '#6c6f73'),
  product('prod-fleece-jacket', 'Zip Fleece Jacket', 'outerwear', 62, LETTER, 'Roomy through the body; size down for a closer fit.', '#7d8f7b'),
  product('prod-lounge-dress', 'Jersey Lounge Dress', 'dress', 44, LETTER, 'Loose swing shape; true to size.', '#9a8aa6'),
];

/**
 * Which occasions each product suits. Kept beside the catalog (not on `Product`) so the shared
 * Product contract stays exactly as agreed. A product with no entry suits no occasion.
 */
export const PRODUCT_OCCASIONS: Record<string, string[]> = {
  'prod-silk-blouse': ['work', 'casual'],
  'prod-oxford-shirt': ['work', 'casual'],
  'prod-shell-top': ['work'],
  'prod-ponte-trouser': ['work'],
  'prod-wide-leg-trouser': ['work', 'evening'],
  'prod-pencil-skirt': ['work', 'evening'],
  'prod-tailored-blazer': ['work'],
  'prod-longline-cardigan': ['work', 'casual'],
  'prod-sheath-dress': ['work', 'evening'],
  'prod-wrap-dress': ['work', 'casual', 'wedding-guest'],
  'prod-satin-slip-dress': ['evening', 'wedding-guest'],
  'prod-velvet-dress': ['evening'],
  'prod-sequin-top': ['evening'],
  'prod-satin-skirt': ['evening'],
  'prod-evening-wrap': ['evening', 'wedding-guest'],
  'prod-floral-midi': ['wedding-guest', 'casual'],
  'prod-chiffon-dress': ['wedding-guest', 'evening'],
  'prod-lace-shrug': ['wedding-guest', 'evening'],
  'prod-boxy-tee': ['casual'],
  'prod-knit-sweater': ['casual', 'work'],
  'prod-denim-jean': ['casual'],
  'prod-linen-pant': ['casual'],
  'prod-denim-jacket': ['casual'],
  'prod-cotton-tee': ['casual'],
  'prod-knit-henley': ['casual'],
  'prod-jogger': ['casual'],
  'prod-fleece-jacket': ['casual'],
  'prod-lounge-dress': ['casual'],
};

// ---------------------------------------------------------------------------
// Inventory: deterministic sample records (same output on every load).
// A store/product/size with NO record means "not carried" and is treated as unavailable.
// ---------------------------------------------------------------------------

/** Per-store layout: where each category lives. Entirely fictional. */
const STORE_LAYOUT: Record<string, Record<string, { floor: number; department: string }>> = {
  'store-downtown': {
    top: { floor: 2, department: "Women's Tops" },
    bottom: { floor: 2, department: "Women's Bottoms" },
    dress: { floor: 3, department: 'Dresses' },
    outerwear: { floor: 3, department: 'Jackets & Layers' },
  },
  'store-lakeside': {
    top: { floor: 1, department: "Women's Shop" },
    bottom: { floor: 1, department: "Women's Shop" },
    dress: { floor: 2, department: 'Dress Gallery' },
    outerwear: { floor: 1, department: 'Outerwear' },
  },
  'store-westgate': {
    top: { floor: 1, department: 'Everyday Tops' },
    bottom: { floor: 1, department: 'Everyday Bottoms' },
    dress: { floor: 1, department: 'Dresses' },
    outerwear: { floor: 1, department: 'Jackets' },
  },
};

/** Share of sizes out of stock / low in stock, per store (percent). Larger = thinner stock. */
const STOCK_PROFILE: Record<string, { out: number; low: number }> = {
  'store-downtown': { out: 8, low: 14 },
  'store-lakeside': { out: 22, low: 16 },
  'store-westgate': { out: 40, low: 16 },
};

/** Westgate is a smaller store: it does not carry these products at all. */
const NOT_CARRIED: Record<string, string[]> = {
  'store-westgate': [
    'prod-satin-slip-dress',
    'prod-velvet-dress',
    'prod-sequin-top',
    'prod-satin-skirt',
    'prod-evening-wrap',
    'prod-chiffon-dress',
    'prod-lace-shrug',
    'prod-tailored-blazer',
  ],
};

/** Hand-set rows so key demo/failure scenarios are guaranteed. [productId, storeId, size, status] */
const STOCK_OVERRIDES: Array<[string, string, string, StockStatus]> = [
  // Downtown, size 16, work: a healthy spread including one low-stock piece.
  ['prod-silk-blouse', 'store-downtown', '16', 'in_stock'],
  ['prod-shell-top', 'store-downtown', '16', 'in_stock'],
  ['prod-ponte-trouser', 'store-downtown', '16', 'in_stock'],
  ['prod-wide-leg-trouser', 'store-downtown', '16', 'low_stock'],
  ['prod-longline-cardigan', 'store-downtown', '16', 'in_stock'],
  ['prod-tailored-blazer', 'store-downtown', '16', 'in_stock'],
  ['prod-sheath-dress', 'store-downtown', '16', 'in_stock'],
  ['prod-wrap-dress', 'store-downtown', '16', 'in_stock'],
  // Downtown is out of the blazer in size 18 and the sheath dress in size 14.
  ['prod-tailored-blazer', 'store-downtown', '18', 'out_of_stock'],
  ['prod-sheath-dress', 'store-downtown', '14', 'out_of_stock'],
];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildInventory(): InventoryRecord[] {
  const overrides = new Map(STOCK_OVERRIDES.map(([p, s, z, st]) => [`${p}|${s}|${z}`, st]));
  const records: InventoryRecord[] = [];
  for (const store of STORES) {
    const profile = STOCK_PROFILE[store.id];
    const skipped = new Set(NOT_CARRIED[store.id] ?? []);
    for (const prod of PRODUCTS) {
      if (skipped.has(prod.id)) continue;
      const place = STORE_LAYOUT[store.id][prod.category];
      for (const size of prod.availableSizes) {
        const key = `${prod.id}|${store.id}|${size}`;
        const roll = hash(key) % 100;
        const computed: StockStatus =
          roll < profile.out ? 'out_of_stock' : roll < profile.out + profile.low ? 'low_stock' : 'in_stock';
        records.push({
          productId: prod.id,
          storeId: store.id,
          size,
          stockStatus: overrides.get(key) ?? computed,
          floor: place.floor,
          department: place.department,
        });
      }
    }
  }
  return records;
}

export const INVENTORY: InventoryRecord[] = buildInventory();

// ---------------------------------------------------------------------------
// Small lookup helpers (pure; safe for every feature to use).
// ---------------------------------------------------------------------------

export function getProduct(id: string, products: Product[] = PRODUCTS): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getStore(id: string | null, stores: Store[] = STORES): Store | undefined {
  return id === null ? undefined : stores.find((s) => s.id === id);
}

export function getInventoryRecord(
  productId: string,
  storeId: string,
  size: string,
  inventory: InventoryRecord[] = INVENTORY,
): InventoryRecord | undefined {
  return inventory.find((r) => r.productId === productId && r.storeId === storeId && r.size === size);
}
