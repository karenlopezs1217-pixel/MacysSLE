import type { FulfillmentMethod, ShoppingSession } from './types';

/**
 * Props the shell passes to every teammate component (try-on, stock & hold, price & handoff).
 * Session state lives ONLY in the shell: read `session`, change it only through the callbacks.
 */
export interface SessionFeatureProps {
  session: ShoppingSession;
  /** Choose (or clear) the selected outfit. */
  onSelectOutfit: (outfitId: string | null) => void;
  /** Record how the shopper wants to receive the outfit. */
  onFulfillmentChange: (method: FulfillmentMethod | null) => void;
}
