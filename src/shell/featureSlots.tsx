/**
 * FEATURE SLOTS — the one file where feature components plug into the shell.
 *
 * Each slot maps a step to its component. To replace a component, build it under
 * src/features/<name>/ taking `SessionFeatureProps` and change the matching line here.
 *
 * The shell only renders slots once an outfit is selected. Slots 4 and 5 remount when the selected
 * outfit changes; all slots remount when the session ends (so the try-on photo is discarded).
 */
import type { SessionFeatureProps } from '../shared/featureProps';
import { VirtualTryOn } from '../features/tryon/VirtualTryOn';
import { PriceHandoffSection, StockHoldSection } from '../features/stock-price-handoff';

export const VirtualTryOnSlot = (props: SessionFeatureProps) => <VirtualTryOn {...props} />;
export const StoreStockSlot = (props: SessionFeatureProps) => <StockHoldSection {...props} />;
export const PriceHandoffSlot = (props: SessionFeatureProps) => <PriceHandoffSection {...props} />;
