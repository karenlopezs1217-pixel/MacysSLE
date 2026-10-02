import type {
  CompleteShopperRequest,
  InventoryRecord,
  Occasion,
  Outfit,
  Product,
  Store,
} from '../../shared/types';
import {
  INVENTORY,
  OCCASIONS,
  PRODUCTS,
  PRODUCT_OCCASIONS,
  STORES,
} from '../../shared/sampleData';
import { formatPrice, sumPrices, toCents } from '../../shared/money';

/** Everything the shortlist reads. Defaults to the one shared sample catalog. */
export interface Catalog {
  products: Product[];
  inventory: InventoryRecord[];
  productOccasions: Record<string, string[]>;
  stores: Store[];
  occasions: Occasion[];
}

export const SAMPLE_CATALOG: Catalog = {
  products: PRODUCTS,
  inventory: INVENTORY,
  productOccasions: PRODUCT_OCCASIONS,
  stores: STORES,
  occasions: OCCASIONS,
};

export const MAX_OPTIONS = 3;

/**
 * Complete looks, as category lists. First category is the "anchor" — no two shortlisted
 * outfits share an anchor, so the options feel different.
 */
const RECIPES: string[][] = [
  ['top', 'bottom', 'outerwear'],
  ['dress', 'outerwear'],
  ['top', 'bottom'],
  ['dress'],
];

interface Qualifying {
  product: Product;
  record: InventoryRecord;
}

const indexCache = new WeakMap<InventoryRecord[], Map<string, InventoryRecord>>();
function inventoryIndex(inventory: InventoryRecord[]): Map<string, InventoryRecord> {
  let index = indexCache.get(inventory);
  if (!index) {
    index = new Map(inventory.map((r) => [`${r.productId}|${r.storeId}|${r.size}`, r]));
    indexCache.set(inventory, index);
  }
  return index;
}

function stockedAt(request: CompleteShopperRequest, catalog: Catalog): Qualifying[] {
  const index = inventoryIndex(catalog.inventory);
  const result: Qualifying[] = [];
  for (const product of catalog.products) {
    if (!product.availableSizes.includes(request.size)) continue;
    const record = index.get(`${product.id}|${request.storeId}|${request.size}`);
    if (!record || record.stockStatus === 'out_of_stock') continue;
    result.push({ product, record });
  }
  return result;
}

/**
 * Pieces that satisfy size + selected-store sample availability + occasion.
 * (Budget applies to the outfit total, so it is checked when outfits are assembled.)
 */
export function qualifyingPieces(request: CompleteShopperRequest, catalog: Catalog = SAMPLE_CATALOG): Qualifying[] {
  return stockedAt(request, catalog).filter(({ product }) =>
    (catalog.productOccasions[product.id] ?? []).includes(request.occasion),
  );
}

interface Candidate {
  pieces: Qualifying[];
  totalCents: number;
  lowStock: number;
}

function cartesian(lists: Qualifying[][]): Qualifying[][] {
  return lists.reduce<Qualifying[][]>((acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])), [[]]);
}

function candidateOutfits(pieces: Qualifying[]): Candidate[] {
  const byCategory = new Map<string, Qualifying[]>();
  for (const q of pieces) {
    byCategory.set(q.product.category, [...(byCategory.get(q.product.category) ?? []), q]);
  }
  const out: Candidate[] = [];
  for (const recipe of RECIPES) {
    const lists = recipe.map((c) => byCategory.get(c) ?? []);
    if (lists.some((l) => l.length === 0)) continue;
    for (const combo of cartesian(lists)) {
      out.push({
        pieces: combo,
        totalCents: combo.reduce((acc, q) => acc + toCents(q.product.price), 0),
        lowStock: combo.filter((q) => q.record.stockStatus === 'low_stock').length,
      });
    }
  }
  return out;
}

const idKey = (c: Candidate) => c.pieces.map((q) => q.product.id).join('+');

/** More complete first, then fewer low-stock pieces, then lower price, then id (stable). */
function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    b.pieces.length - a.pieces.length ||
    a.lowStock - b.lowStock ||
    a.totalCents - b.totalCents ||
    idKey(a).localeCompare(idKey(b))
  );
}

export function isCompleteLook(categories: string[]): boolean {
  const sorted = [...categories].sort().join(',');
  return RECIPES.some((r) => [...r].sort().join(',') === sorted);
}

// ---------------------------------------------------------------------------
// Reasons and wording (all derived from the data — nothing invented)
// ---------------------------------------------------------------------------

function lookup(catalog: Catalog, request: CompleteShopperRequest) {
  return {
    store: catalog.stores.find((s) => s.id === request.storeId)?.name ?? request.storeId,
    occasion: catalog.occasions.find((o) => o.id === request.occasion)?.label ?? request.occasion,
  };
}

function lowStockCount(productIds: string[], request: CompleteShopperRequest, catalog: Catalog): number {
  const index = inventoryIndex(catalog.inventory);
  return productIds.filter(
    (id) => index.get(`${id}|${request.storeId}|${request.size}`)?.stockStatus === 'low_stock',
  ).length;
}

export function describeOutfit(
  productIds: string[],
  totalPrice: number,
  request: CompleteShopperRequest,
  catalog: Catalog = SAMPLE_CATALOG,
): string {
  const { store, occasion } = lookup(catalog, request);
  const categories = productIds.map((id) => catalog.products.find((p) => p.id === id)?.category ?? '');
  const low = lowStockCount(productIds, request, catalog);
  const stock = low === 0 ? 'all in stock' : `${low} low-stock ${low === 1 ? 'piece' : 'pieces'}`;
  const headroom = toCents(request.budget) - toCents(totalPrice);
  const budget = headroom === 0 ? 'exactly on budget' : `${formatPrice(headroom / 100)} under budget`;
  const noun = !isCompleteLook(categories) ? 'Single piece' : productIds.length === 1 ? 'Standalone piece' : 'Complete look';
  const tail = isCompleteLook(categories) ? budget : 'within budget';
  return `${noun} for ${occasion.toLowerCase()}: size ${request.size} at ${store} — ${stock}, ${tail}.`;
}

/** The one-line recommendation shown on the "Best pick". */
export function bestPickLine(outfit: Outfit, request: CompleteShopperRequest, catalog: Catalog = SAMPLE_CATALOG): string {
  const names = outfit.productIds.map((id) => catalog.products.find((p) => p.id === id)?.name ?? id);
  const low = lowStockCount(outfit.productIds, request, catalog);
  const stock = low === 0 ? 'everything is in stock in your size' : 'it fits your size, though some pieces are low in stock';
  return `Our pick: ${names.join(' + ')} — ${stock}, ${formatPrice(outfit.totalPrice)} total.`;
}

function toOutfit(
  id: string,
  pieces: Qualifying[],
  isBestPick: boolean,
  request: CompleteShopperRequest,
  catalog: Catalog,
): Outfit {
  const productIds = pieces.map((q) => q.product.id);
  const totalPrice = sumPrices(pieces.map((q) => q.product.price));
  return { id, productIds, totalPrice, reason: describeOutfit(productIds, totalPrice, request, catalog), isBestPick };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ShortlistMode = 'outfits' | 'items' | 'none';

export interface ShortlistSummary {
  mode: ShortlistMode;
  /** Explanation for `items` / `none`. Absent when full outfits were found. */
  message?: string;
}

function assemble(request: CompleteShopperRequest, catalog: Catalog): { outfits: Outfit[]; summary: ShortlistSummary } {
  const budgetCents = toCents(request.budget);
  const pieces = qualifyingPieces(request, catalog);
  const all = candidateOutfits(pieces);
  const affordable = all.filter((c) => c.totalCents <= budgetCents).sort(compareCandidates);

  // Pass 1 prefers outfits that share no piece with an earlier pick, so options look different.
  // Pass 2 tops up with outfits that at least start from a different anchor piece.
  const chosen: Candidate[] = [];
  const ids = (c: Candidate) => c.pieces.map((q) => q.product.id);
  const usedPieces = new Set<string>();
  for (const c of affordable) {
    if (chosen.length === MAX_OPTIONS) break;
    if (ids(c).some((id) => usedPieces.has(id))) continue;
    chosen.push(c);
    ids(c).forEach((id) => usedPieces.add(id));
  }
  const anchors = new Set(chosen.map((c) => c.pieces[0].product.id));
  for (const c of affordable) {
    if (chosen.length === MAX_OPTIONS) break;
    if (chosen.includes(c) || anchors.has(c.pieces[0].product.id)) continue;
    chosen.push(c);
    anchors.add(c.pieces[0].product.id);
  }

  if (chosen.length > 0) {
    return {
      outfits: chosen.map((c, i) => toOutfit(`outfit-${i + 1}`, c.pieces, i === 0, request, catalog)),
      summary: { mode: 'outfits' },
    };
  }

  const { store, occasion } = lookup(catalog, request);
  const budget = formatPrice(request.budget);

  // No stocked piece at all for this size and store.
  const stocked = stockedAt(request, catalog);
  if (stocked.length === 0) {
    return {
      outfits: [],
      summary: {
        mode: 'none',
        message: `Nothing is in stock in size ${request.size} at ${store} in the sample data. Try a different size or store.`,
      },
    };
  }
  if (pieces.length === 0) {
    return {
      outfits: [],
      summary: {
        mode: 'none',
        message: `${stocked.length} ${stocked.length === 1 ? 'piece is' : 'pieces are'} in stock in size ${request.size} at ${store}, but none are suited to ${occasion.toLowerCase()}. Try a different occasion.`,
      },
    };
  }

  // Pieces exist. Fall back to individual items that satisfy every constraint on their own.
  const singles = pieces
    .filter((q) => toCents(q.product.price) <= budgetCents)
    .sort(
      (a, b) =>
        Number(b.product.category === 'dress') - Number(a.product.category === 'dress') ||
        Number(a.record.stockStatus === 'low_stock') - Number(b.record.stockStatus === 'low_stock') ||
        toCents(a.product.price) - toCents(b.product.price) ||
        a.product.id.localeCompare(b.product.id),
    )
    .slice(0, MAX_OPTIONS);

  const cheapestOutfit = all.length ? Math.min(...all.map((c) => c.totalCents)) : null;
  const cheapestPiece = Math.min(...pieces.map((q) => toCents(q.product.price)));

  if (singles.length > 0) {
    const why =
      cheapestOutfit === null
        ? `The in-stock pieces for ${occasion.toLowerCase()} in size ${request.size} at ${store} can't be combined into a complete outfit`
        : `No complete outfit fits ${budget} (the lowest qualifying outfit total is ${formatPrice(cheapestOutfit / 100)})`;
    return {
      outfits: singles.map((q, i) => toOutfit(`outfit-${i + 1}`, [q], i === 0, request, catalog)),
      summary: { mode: 'items', message: `${why}, so these are individual pieces that qualify on their own.` },
    };
  }

  const outfitPart = cheapestOutfit === null ? '' : ` and the cheapest complete outfit is ${formatPrice(cheapestOutfit / 100)}`;
  return {
    outfits: [],
    summary: {
      mode: 'none',
      message: `Everything that qualifies costs more than your ${budget} budget: the least expensive qualifying piece is ${formatPrice(cheapestPiece / 100)}${outfitPart}. Adjust the budget to see options.`,
    },
  };
}

/** Up to three outfits (or single items) that satisfy EVERY constraint. Best pick is first. */
export function buildShortlist(request: CompleteShopperRequest, catalog: Catalog = SAMPLE_CATALOG): Outfit[] {
  return assemble(request, catalog).outfits;
}

/** What kind of shortlist `buildShortlist` produced for this request, and why it may be short. */
export function summarizeShortlist(request: CompleteShopperRequest, catalog: Catalog = SAMPLE_CATALOG): ShortlistSummary {
  return assemble(request, catalog).summary;
}

// ---------------------------------------------------------------------------
// Swap
// ---------------------------------------------------------------------------

const byPriceThenId = (a: Product, b: Product) => toCents(a.price) - toCents(b.price) || a.id.localeCompare(b.id);

/**
 * Replacement options for one piece: same category, qualifies on size/store/occasion,
 * not already in the outfit, and keeps the outfit total within budget.
 */
export function getSwapCandidates(
  outfit: Outfit,
  productId: string,
  request: CompleteShopperRequest,
  catalog: Catalog = SAMPLE_CATALOG,
): Product[] {
  const current = catalog.products.find((p) => p.id === productId);
  if (!current || !outfit.productIds.includes(productId)) return [];
  const others = outfit.productIds.filter((id) => id !== productId);
  const baseCents = others.reduce((acc, id) => acc + toCents(catalog.products.find((p) => p.id === id)?.price ?? 0), 0);
  const budgetCents = toCents(request.budget);
  return qualifyingPieces(request, catalog)
    .map((q) => q.product)
    .filter(
      (p) =>
        p.category === current.category &&
        !outfit.productIds.includes(p.id) &&
        baseCents + toCents(p.price) <= budgetCents,
    )
    .sort(byPriceThenId);
}

export type SwapResult =
  | { ok: true; outfits: Outfit[]; from: Product; to: Product }
  | { ok: false; message: string };

/**
 * Swap one piece for the next qualifying alternative (cycling by price). The outfit id and best-pick
 * flag are kept; total and reason are recalculated. Fails — without relaxing anything — if none fit.
 */
export function swapPiece(
  outfits: Outfit[],
  outfitId: string,
  productId: string,
  request: CompleteShopperRequest,
  catalog: Catalog = SAMPLE_CATALOG,
): SwapResult {
  const outfit = outfits.find((o) => o.id === outfitId);
  const from = catalog.products.find((p) => p.id === productId);
  if (!outfit || !from || !outfit.productIds.includes(productId)) {
    return { ok: false, message: 'That piece is no longer part of this option.' };
  }
  const candidates = getSwapCandidates(outfit, productId, request, catalog);
  if (candidates.length === 0) {
    return {
      ok: false,
      message: `No other ${from.category} is in stock in size ${request.size} at this store, suits your occasion, and keeps this option within budget.`,
    };
  }
  const ring = [...candidates, from].sort(byPriceThenId);
  const to = ring[(ring.indexOf(from) + 1) % ring.length];
  const productIds = outfit.productIds.map((id) => (id === productId ? to.id : id));
  const totalPrice = sumPrices(productIds.map((id) => catalog.products.find((p) => p.id === id)?.price ?? 0));
  const updated: Outfit = {
    ...outfit,
    productIds,
    totalPrice,
    reason: describeOutfit(productIds, totalPrice, request, catalog),
  };
  return { ok: true, outfits: outfits.map((o) => (o.id === outfitId ? updated : o)), from, to };
}
