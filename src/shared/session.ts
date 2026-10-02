import type { CompleteShopperRequest, ShopperRequest, ShoppingSession } from './types';
import { OCCASIONS, STORES } from './sampleData';

export const EMPTY_REQUEST: ShopperRequest = {
  timeMinutes: null,
  occasion: null,
  size: null,
  budget: null,
  storeId: null,
};

/** Fresh session. The shell preselects a store; every other field starts unknown. */
export function createInitialSession(defaultStoreId: string | null = STORES[0]?.id ?? null): ShoppingSession {
  return {
    shopperRequest: { ...EMPTY_REQUEST, storeId: defaultStoreId },
    shortlistedOutfits: [],
    selectedOutfitId: null,
    fulfillmentMethod: null,
  };
}

export type EssentialField = keyof ShopperRequest;

/** Essentials in the order we ask for them. */
export const ESSENTIAL_FIELDS: EssentialField[] = ['occasion', 'size', 'budget', 'timeMinutes', 'storeId'];

/** Which essentials are missing or invalid? Empty array means the request is complete. */
export function missingFields(r: ShopperRequest): EssentialField[] {
  return ESSENTIAL_FIELDS.filter((f) => {
    switch (f) {
      case 'timeMinutes':
        return !(r.timeMinutes !== null && Number.isFinite(r.timeMinutes) && r.timeMinutes > 0);
      case 'budget':
        return !(r.budget !== null && Number.isFinite(r.budget) && r.budget > 0);
      case 'size':
        return !(r.size !== null && r.size.trim() !== '');
      case 'occasion':
        return !(r.occasion !== null && OCCASIONS.some((o) => o.id === r.occasion));
      case 'storeId':
        return !(r.storeId !== null && STORES.some((s) => s.id === r.storeId));
    }
  });
}

export function isRequestComplete(r: ShopperRequest): r is CompleteShopperRequest {
  return missingFields(r).length === 0;
}

export function requestsEqual(a: ShopperRequest, b: ShopperRequest): boolean {
  return (
    a.timeMinutes === b.timeMinutes &&
    a.occasion === b.occasion &&
    a.size === b.size &&
    a.budget === b.budget &&
    a.storeId === b.storeId
  );
}
