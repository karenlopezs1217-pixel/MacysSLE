// THE SHARED CONTRACT. Do not edit from a feature account.
// Propose changes in docs/CONTRACT_CHANGES.md instead.
import type { FC } from "react";

export const CONTRACT_VERSION = "1.0.0";

export type FeatureId = "intake-shortlist" | "try-on" | "stock-price-handoff";
export type NavTarget = FeatureId | "done";

export type Occasion = "work" | "casual" | "event" | "interview" | "wedding-guest" | "date-night";
export type Category = "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory";

// ---------- Catalog and store data (always SAMPLE DATA in the prototype) ----------

export interface Product {
  id: string;
  name: string;
  brand: string;                 // invented sample label, never a real brand
  category: Category;
  occasions: Occasion[];
  colors: string[];
  sizes: string[];               // e.g. "8", "16", "M", "9" (shoes)
  price: number;                 // regular price in USD
  fit: { runs: "small" | "true" | "large"; note: string };
  swatchHex: string;             // used to draw the placeholder SVG
  isSampleData: true;
}

export interface Store {
  id: string;
  name: string;                  // e.g. "Sample Store A (Downtown)"
  city: string;
  distanceMiles: number;         // distance from the shopper's selected store, 0 for itself
  isSampleData: true;
}

export interface InventoryRecord {
  storeId: string;
  productId: string;
  size: string;
  qty: number;                   // 0 = out of stock
  floor: string;                 // e.g. "2"
  department: string;            // e.g. "Women's Career"
}

export interface Offer {
  id: string;
  label: string;                 // shopper-facing text
  type: "percent" | "amount";
  value: number;                 // 20 = 20% or $20
  minSpend?: number;
  categories?: Category[];       // if set, applies only to these categories
  validFrom: string;             // ISO date
  validTo: string;               // ISO date, inclusive
  requiresLogin: boolean;        // anonymous shoppers are NOT eligible
  stackable: boolean;
  isSampleData: true;
}

export interface DataProvider {
  getProducts(): Product[];
  getProduct(id: string): Product | undefined;
  getStores(): Store[];
  getStore(id: string): Store | undefined;
  getInventory(storeId: string, productId: string): InventoryRecord[]; // one record per size
  getOffers(): Offer[];
  now(): Date;                   // use this instead of new Date() so demos are repeatable
}

// ---------- Session: the only thing features share ----------

export interface ShopperRequest {
  rawText: string;
  timeMinutes: number | null;
  occasion: Occasion | null;
  size: string | null;
  budgetMax: number | null;      // total budget for the outfit, USD
  storeId: string | null;
  clarifyingQuestion: string | null; // at most one, shown once
}

export interface OutfitOption {
  id: string;
  productIds: string[];          // 1+ products that make up the outfit or single item
  totalPrice: number;            // sum of regular prices, before offers
  reason: string;                // one line, shown to shopper
  isBestPick: boolean;           // exactly one option in a shortlist is true
}

export interface TryOnResult {
  productId: string;
  recommendedSize: string;
  fitNote: string;               // e.g. "Runs small, size up"
  isSimulation: true;
}

export interface Hold {
  holdId: string;
  productId: string;
  size: string;
  storeId: string;
  type: "fitting-room" | "pickup";
  expiresAt: string;             // ISO datetime
}

export interface PriceBreakdown {
  subtotal: number;
  appliedOffer: Offer | null;
  discount: number;
  youPay: number;
  notes: string[];               // e.g. "Rewards offer requires sign-in, not applied"
}

export type Fulfillment =
  | { type: "pay-in-store" }
  | { type: "pickup"; storeId: string; readyBy: string }
  | { type: "ship"; etaDate: string; confidence: "firm" };

export interface MissedDemandEvent {
  at: string;                    // ISO datetime
  storeId: string | null;
  productId: string | null;
  size: string | null;
  reason: "size-out-of-stock" | "item-not-carried" | "over-budget" | "no-match";
  source: FeatureId;
}

export interface ShopperSession {
  contractVersion: string;
  sessionId: string;
  request: ShopperRequest | null;
  shortlist: OutfitOption[];
  selectedOptionId: string | null;
  selectedProductIds: string[];  // products the shopper wants to move forward with
  tryOn: { consentGiven: boolean; results: TryOnResult[] } | null; // NEVER put the photo here
  holds: Hold[];
  price: PriceBreakdown | null;
  fulfillment: Fulfillment | null;
  missedDemand: MissedDemandEvent[];
}

export interface FeatureProps {
  session: ShopperSession;
  data: DataProvider;
  onUpdate: (patch: Partial<ShopperSession>) => void;
  onNavigate: (to: NavTarget) => void;
}

export type FeatureComponent = FC<FeatureProps>;
