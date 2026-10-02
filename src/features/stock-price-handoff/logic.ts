// Pure, deterministic logic for Components 4 (stock/hold) and 5 (price/handoff).
// No React, no globals: everything comes from the DataProvider and the session,
// so it can be checked with logic.check.ts and swapped to real data later.
import type {
  Category, DataProvider, Hold, MissedDemandEvent, Offer, PriceBreakdown, Product, ShopperSession, Store,
} from "../../shared/types";

export const DEFAULT_STORE_ID = "S-A"; // the kiosk's store when the request has none (Feature A spec)
export const FITTING_ROOM_LABEL = "Fitting Room 3"; // SAMPLE: fixed mock room
const FITTING_ROOM_HOLD_MINUTES = 30;
const SHIP_BUSINESS_DAYS = 3; // SAMPLE rule from docs/feature-C spec

// ---------- Cart lines ----------

export type SizeSource = "try-on" | "request" | "shopper" | "none";

export interface CartLine {
  product: Product;
  size: string | null;
  sizeSource: SizeSource;
}

/** Size per product: shopper override > try-on recommendation > requested size > none. */
export function resolveLines(
  session: ShopperSession, data: DataProvider, overrides: Record<string, string>,
): { lines: CartLine[]; unknownIds: string[] } {
  const lines: CartLine[] = [];
  const unknownIds: string[] = [];
  for (const id of session.selectedProductIds) {
    const product = data.getProduct(id);
    if (!product) { unknownIds.push(id); continue; }
    const tryOnSize = session.tryOn?.results.find((r) => r.productId === id)?.recommendedSize;
    const requested = session.request?.size ?? null;
    if (overrides[id]) lines.push({ product, size: overrides[id], sizeSource: "shopper" });
    else if (tryOnSize && product.sizes.includes(tryOnSize)) lines.push({ product, size: tryOnSize, sizeSource: "try-on" });
    else if (requested && product.sizes.includes(requested)) lines.push({ product, size: requested, sizeSource: "request" });
    else lines.push({ product, size: null, sizeSource: "none" });
  }
  return { lines, unknownIds };
}

export function resolveStore(session: ShopperSession, data: DataProvider): { store: Store; wasDefaulted: boolean } {
  const wanted = session.request?.storeId ?? null;
  const found = wanted ? data.getStore(wanted) : undefined;
  if (found) return { store: found, wasDefaulted: false };
  return { store: data.getStore(DEFAULT_STORE_ID) ?? data.getStores()[0], wasDefaulted: true };
}

// ---------- Component 4: stock + location ----------

export type StockLevel = "in-stock" | "last-one" | "out" | "not-made";

export interface StockInfo {
  level: StockLevel;
  qty: number;
  floor: string | null;
  department: string | null;
}

export function getStock(data: DataProvider, storeId: string, productId: string, size: string): StockInfo {
  const rec = data.getInventory(storeId, productId).find((r) => r.size === size);
  if (!rec) return { level: "not-made", qty: 0, floor: null, department: null };
  const level: StockLevel = rec.qty >= 2 ? "in-stock" : rec.qty === 1 ? "last-one" : "out";
  return { level, qty: rec.qty, floor: rec.floor, department: rec.department };
}

export const isAvailable = (s: StockInfo) => s.level === "in-stock" || s.level === "last-one";

/** Nearest OTHER sample store with qty > 0 in this size, by distanceMiles. */
export function findFallbackStore(
  data: DataProvider, currentStoreId: string, productId: string, size: string,
): { store: Store; stock: StockInfo } | null {
  const candidates = data.getStores()
    .filter((s) => s.id !== currentStoreId)
    .map((store) => ({ store, stock: getStock(data, store.id, productId, size) }))
    .filter((c) => isAvailable(c.stock))
    .sort((a, b) => a.store.distanceMiles - b.store.distanceMiles);
  return candidates[0] ?? null;
}

/** If the fit runs small/large, the adjacent size in that direction, when it is in stock here. */
export function adjacentSizeInStock(
  data: DataProvider, storeId: string, product: Product, size: string,
): string | null {
  if (product.fit.runs === "true") return null;
  const i = product.sizes.indexOf(size);
  const j = product.fit.runs === "small" ? i + 1 : i - 1;
  if (i < 0 || j < 0 || j >= product.sizes.length) return null;
  const next = product.sizes[j];
  return isAvailable(getStock(data, storeId, product.id, next)) ? next : null;
}

/** Missed-demand events for every requested size that is out of stock at the selected store. */
export function missedDemandFor(
  lines: CartLine[], data: DataProvider, storeId: string, existing: MissedDemandEvent[],
): MissedDemandEvent[] {
  const key = (e: Pick<MissedDemandEvent, "storeId" | "productId" | "size" | "reason" | "source">) =>
    `${e.storeId}|${e.productId}|${e.size}|${e.reason}|${e.source}`;
  const seen = new Set(existing.map(key));
  const out: MissedDemandEvent[] = [];
  for (const l of lines) {
    if (!l.size) continue;
    if (isAvailable(getStock(data, storeId, l.product.id, l.size))) continue;
    const ev: MissedDemandEvent = {
      at: data.now().toISOString(), storeId, productId: l.product.id, size: l.size,
      reason: "size-out-of-stock", source: "stock-price-handoff",
    };
    if (!seen.has(key(ev))) { seen.add(key(ev)); out.push(ev); }
  }
  return out;
}

// ---------- Holds (SIMULATED) ----------

function endOfNextDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0);
}
function noonNextDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0);
}

let holdCounter = 0;
export function makeHoldId(): string {
  holdCounter = (holdCounter + 1) % 10000;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `H-${String((rand + holdCounter) % 10000).padStart(4, "0")}`;
}

/** Returns null when the hold is not allowed (no stock at that store). */
export function createHold(
  data: DataProvider, type: Hold["type"], productId: string, size: string, storeId: string, selectedStoreId: string,
): Hold | null {
  if (!isAvailable(getStock(data, storeId, productId, size))) return null;
  if (type === "fitting-room" && storeId !== selectedStoreId) return null; // fitting rooms only where you are
  const now = data.now();
  const expires = type === "fitting-room"
    ? new Date(now.getTime() + FITTING_ROOM_HOLD_MINUTES * 60_000)
    : endOfNextDay(now);
  return { holdId: makeHoldId(), productId, size, storeId, type, expiresAt: expires.toISOString() };
}

/** Pickup readiness: selected store = ready now; any other store = 12:00 PM next day (SAMPLE rule). */
export function pickupReadyBy(data: DataProvider, storeId: string, selectedStoreId: string): Date {
  const now = data.now();
  return storeId === selectedStoreId ? now : noonNextDay(now);
}

/** Sample stores where every line (with a size) can be picked up, nearest first. */
export function pickupStoresForAll(data: DataProvider, lines: CartLine[], selectedStoreId: string): Store[] {
  if (lines.length === 0 || lines.some((l) => !l.size)) return [];
  return data.getStores()
    .filter((s) => lines.every((l) => isAvailable(getStock(data, s.id, l.product.id, l.size!))))
    .sort((a, b) => (a.id === selectedStoreId ? -1 : b.id === selectedStoreId ? 1 : a.distanceMiles - b.distanceMiles));
}

// ---------- Component 5: price ----------

const CATEGORY_LABEL: Record<Category, string> = {
  top: "tops", bottom: "bottoms", dress: "dresses", outerwear: "outerwear", shoes: "shoes", accessory: "accessories",
};

const toCents = (usd: number) => Math.round(usd * 100);
const fromCents = (c: number) => c / 100;

/** Local calendar date as YYYY-MM-DD, for inclusive offer date comparisons. */
export function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface OfferEvaluation {
  offer: Offer;
  valid: boolean;
  discountCents: number;
  /** Shopper-facing reason it was not applied; null when valid or irrelevant to this bag. */
  note: string | null;
}

export function evaluateOffer(offer: Offer, products: Product[], today: string): OfferEvaluation {
  const eligible = offer.categories ? products.filter((p) => offer.categories!.includes(p.category)) : products;
  const eligibleCents = eligible.reduce((s, p) => s + toCents(p.price), 0);
  const active = offer.validFrom <= today && today <= offer.validTo;
  const fail = (note: string | null): OfferEvaluation => ({ offer, valid: false, discountCents: 0, note });

  if (offer.requiresLogin) return fail("Requires sign-in (this prototype is anonymous)");
  if (eligible.length === 0) {
    // Only explain a category mismatch for offers running today; skip unrelated inactive offers.
    if (!active) return fail(null);
    const bagCats = [...new Set(products.map((p) => CATEGORY_LABEL[p.category]))].join(" or ");
    return fail(`Not valid on ${bagCats || "these items"}`);
  }
  if (today > offer.validTo) return fail(`Expired ${shortDate(offer.validTo)}`);
  if (today < offer.validFrom) return fail(`Starts ${shortDate(offer.validFrom)}`);
  if (offer.minSpend !== undefined && eligibleCents < toCents(offer.minSpend)) {
    return fail(`Minimum spend $${offer.minSpend.toFixed(0)} not met`);
  }
  // Round the discount DOWN to the cent: never round in the shopper's favor.
  const raw = offer.type === "percent" ? Math.floor((eligibleCents * offer.value) / 100) : toCents(offer.value);
  return { offer, valid: true, discountCents: Math.min(raw, eligibleCents), note: null };
}

/**
 * Applies the single best valid sample offer (largest discount). Offers are never invented:
 * only data.getOffers() is used. Stackable offers in the sample data all require sign-in, so none stack.
 */
export function computePrice(products: Product[], offers: Offer[], now: Date): PriceBreakdown {
  const subtotalCents = products.reduce((s, p) => s + toCents(p.price), 0);
  const today = isoDay(now);
  const evals = offers.map((o) => evaluateOffer(o, products, today));
  const valid = evals.filter((e) => e.valid && e.discountCents > 0)
    .sort((a, b) => b.discountCents - a.discountCents || a.offer.id.localeCompare(b.offer.id));
  const best = valid[0] ?? null;

  const notes: string[] = [];
  for (const e of evals) {
    if (best && e.offer.id === best.offer.id) continue;
    if (e.valid) notes.push(`${e.offer.label}: not combined; a larger offer was applied`);
    else if (e.note) notes.push(`${e.offer.label}: ${e.note}`);
  }
  if (!best && products.length > 0) notes.unshift("No sample offer applies to this bag, so no discount is applied.");

  const discountCents = best?.discountCents ?? 0;
  return {
    subtotal: fromCents(subtotalCents),
    appliedOffer: best?.offer ?? null,
    discount: fromCents(discountCents),
    youPay: fromCents(subtotalCents - discountCents),
    notes,
  };
}

export const formatUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

// ---------- Handoff ----------

/** SAMPLE rule: ship-to-home arrives 3 business days (Mon-Fri) after data.now(). */
export function shipEta(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let added = 0;
  while (added < SHIP_BUSINESS_DAYS) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

export const formatDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
export const formatTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const formatWhen = (iso: string, now: Date) => {
  const d = new Date(iso);
  return isoDay(d) === isoDay(now) ? `today at ${formatTime(d)}` : `${formatDay(d)} at ${formatTime(d)}`;
};

export function mockConfirmationCode(prefix: string): string {
  return `${prefix}-SIM-${Math.floor(Math.random() * 900000 + 100000)}`;
}
