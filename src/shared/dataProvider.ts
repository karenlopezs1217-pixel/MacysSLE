import type { InventoryRecord, Offer, Product, ProductFit, Store } from './types';
import {
  DEMO_NOW,
  INVENTORY,
  PRODUCTS,
  PRODUCT_FIT,
  SAMPLE_OFFERS,
  STORES,
  distanceMiles,
} from './sampleData';

/**
 * Read-only view of the shared sample data. Components 4-5 take this (instead of importing the
 * data files) so their logic is testable and the sample data can be swapped for real data later.
 */
export interface DataProvider {
  getProducts(): Product[];
  getProduct(id: string): Product | undefined;
  getStores(): Store[];
  getStore(id: string): Store | undefined;
  /** One record per size. */
  getInventory(storeId: string, productId: string): InventoryRecord[];
  getOffers(): Offer[];
  getFit(productId: string): ProductFit | undefined;
  distanceMiles(fromStoreId: string, toStoreId: string): number;
  /** Use this instead of `new Date()` so demos are repeatable. */
  now(): Date;
}

export function createSampleDataProvider(): DataProvider {
  return {
    getProducts: () => PRODUCTS,
    getProduct: (id) => PRODUCTS.find((p) => p.id === id),
    getStores: () => STORES,
    getStore: (id) => STORES.find((s) => s.id === id),
    getInventory: (storeId, productId) => INVENTORY.filter((r) => r.storeId === storeId && r.productId === productId),
    getOffers: () => SAMPLE_OFFERS,
    getFit: (id) => PRODUCT_FIT[id],
    distanceMiles,
    now: () => new Date(DEMO_NOW.getTime()),
  };
}

export const sampleDataProvider: DataProvider = createSampleDataProvider();
