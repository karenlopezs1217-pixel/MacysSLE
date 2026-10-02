/**
 * SHARED CONTRACT — do not fork or redefine these types in feature folders.
 * Import from `../../shared/types`. Changes need agreement from the whole team.
 */

/** What the shopper told us. Fields are `null` until known — never guessed. */
export interface ShopperRequest {
  /** Minutes the shopper has to shop. */
  timeMinutes: number | null;
  /** An `Occasion['id']` from the sample data (e.g. "work"). */
  occasion: string | null;
  /** Apparel size exactly as listed in `Product.availableSizes` (e.g. "16", "M"). */
  size: string | null;
  /** TOTAL budget in dollars for the whole outfit. */
  budget: number | null;
  /** A `Store['id']`. This is also the "selected store" chosen in the shell. */
  storeId: string | null;
}

/** A ShopperRequest where every essential field is known and valid. */
export type CompleteShopperRequest = {
  [K in keyof ShopperRequest]: NonNullable<ShopperRequest[K]>;
};

export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  availableSizes: string[];
  /** Price in dollars. */
  price: number;
  /** Catalog category, e.g. "top" | "bottom" | "dress" | "outerwear". */
  category: string;
  /** Sample fit guidance shown in try-on. */
  fitNote: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface InventoryRecord {
  productId: string;
  storeId: string;
  size: string;
  stockStatus: StockStatus;
  floor: number;
  department: string;
}

export interface Outfit {
  /** Stable for the lifetime of a shortlist (survives piece swaps). */
  id: string;
  productIds: string[];
  /** Sum of the piece prices in dollars, rounded to cents. */
  totalPrice: number;
  /** Short, data-derived reason this option qualifies. */
  reason: string;
  isBestPick: boolean;
}

/** `pay-in-store` = pay here and take it now. `fitting-room` is a hold type (Component 4) that a shell may also record. */
export type FulfillmentMethod = 'fitting-room' | 'store-pickup' | 'ship-to-home' | 'pay-in-store';

export interface ShoppingSession {
  shopperRequest: ShopperRequest;
  shortlistedOutfits: Outfit[];
  selectedOutfitId: string | null;
  fulfillmentMethod: FulfillmentMethod | null;
}

/** Occasion definition shared by sample data, intake and shortlist. */
export interface Occasion {
  id: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Additive types for Components 3-5. The six contract types above are unchanged.
// ---------------------------------------------------------------------------

/** Sample fit signals per product (see PRODUCT_FIT in sampleData.ts). */
export interface ProductFit {
  runs: 'small' | 'true' | 'large';
  cut: 'slim' | 'regular' | 'relaxed';
  stretch: 'none' | 'some' | 'high';
  lengthSensitive: boolean;
  /** Invented sample review votes. */
  reviews: { runsSmall: number; trueToSize: number; runsLarge: number };
}

/** An offer defined in the sample data. Nothing else may ever be applied as a discount. */
export interface Offer {
  id: string;
  label: string;
  type: 'percent' | 'amount';
  value: number;
  minSpend?: number;
  /** Product categories the offer applies to; all categories when omitted. */
  categories?: string[];
  /** Inclusive ISO dates (YYYY-MM-DD). */
  validFrom: string;
  validTo: string;
  requiresLogin: boolean;
  stackable: boolean;
}

/** A SIMULATED hold. Never a real reservation. */
export interface Hold {
  holdId: string;
  productId: string;
  size: string;
  storeId: string;
  type: 'fitting-room' | 'pickup';
  expiresAt: string;
}

export interface PriceBreakdown {
  subtotal: number;
  appliedOffer: Offer | null;
  discount: number;
  youPay: number;
  notes: string[];
}

/** A shopper need the store could not meet: feeds the merchant "missed demand" view. */
export interface MissedDemandEvent {
  at: string;
  storeId: string | null;
  productId: string | null;
  size: string | null;
  reason: 'size-out-of-stock' | 'item-not-carried' | 'over-budget' | 'no-match';
  source: 'intake-shortlist' | 'try-on' | 'stock-price-handoff';
}
