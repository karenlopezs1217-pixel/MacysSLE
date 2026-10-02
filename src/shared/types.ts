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

export type FulfillmentMethod = 'fitting-room' | 'store-pickup' | 'ship-to-home';

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
