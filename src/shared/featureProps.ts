import type { FulfillmentMethod, Hold, MissedDemandEvent, ShoppingSession } from './types';

/**
 * Extra shell-owned state used by Components 3-5. Lives in the shell next to `ShoppingSession`
 * (the six contract types stay untouched). Reset by the shell whenever the request or the selected
 * outfit changes, and when the session ends.
 */
export interface SessionExtras {
  /** SIMULATED holds placed in step 4 / 5. */
  holds: Hold[];
  /** Needs the store could not meet (merchant view). */
  missedDemand: MissedDemandEvent[];
  /** Sizes chosen in the try-on step: productId -> size. */
  tryOnSizes: Record<string, string>;
  /** Sizes picked in the stock step: productId -> size (wins over try-on). */
  sizeOverrides: Record<string, string>;
}

export const EMPTY_EXTRAS: SessionExtras = { holds: [], missedDemand: [], tryOnSizes: {}, sizeOverrides: {} };

/**
 * Props the shell passes to every teammate component (try-on, stock & hold, price & handoff).
 * Session state lives ONLY in the shell: read `session` / `extras`, change them only via callbacks.
 */
export interface SessionFeatureProps {
  session: ShoppingSession;
  extras: SessionExtras;
  /** Choose (or clear) the selected outfit. */
  onSelectOutfit: (outfitId: string | null) => void;
  /** Record how the shopper wants to receive the outfit. */
  onFulfillmentChange: (method: FulfillmentMethod | null) => void;
  /** Merge changes into the shell's extras (holds, missed demand, chosen sizes). */
  onExtrasChange: (patch: Partial<SessionExtras>) => void;
  /** The shopper finished the whole flow. */
  onFinish: () => void;
}
