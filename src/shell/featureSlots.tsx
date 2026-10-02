/**
 * FEATURE SLOTS — the only file teammates edit to plug their component into the shell.
 *
 * Each slot currently renders a placeholder. To integrate, create your component under
 * src/features/<your-feature>/ and replace the body of your slot with it, e.g.
 *
 *   import { VirtualTryOn } from '../features/tryon/VirtualTryOn';
 *   export const VirtualTryOnSlot = (props: SessionFeatureProps) => <VirtualTryOn {...props} />;
 *
 * The shell only renders slots once an outfit is selected, and remounts them (new `key`) when the
 * session ends — so local state such as uploaded photos is discarded.
 */
import type { SessionFeatureProps } from '../shared/featureProps';
import { getProduct } from '../shared/sampleData';

function SlotPlaceholder({ title, owner, session }: SessionFeatureProps & { title: string; owner: string }) {
  const outfit = session.shortlistedOutfits.find((o) => o.id === session.selectedOutfitId);
  const names = outfit?.productIds.map((id) => getProduct(id)?.name ?? id).join(' + ');
  return (
    <div className="slot-placeholder">
      <strong>{title}</strong>
      <span>Placeholder — {owner} plugs their component in here (src/shell/featureSlots.tsx).</span>
      {names && (
        <span>
          Shell state received: selected outfit “{names}”, fulfillment: {session.fulfillmentMethod ?? 'not chosen'}.
        </span>
      )}
    </div>
  );
}

export const VirtualTryOnSlot = (props: SessionFeatureProps) => (
  <SlotPlaceholder {...props} title="Virtual try-on and fit" owner="Component 3" />
);

export const StoreStockSlot = (props: SessionFeatureProps) => (
  <SlotPlaceholder {...props} title="Store stock, location and hold" owner="Component 4" />
);

export const PriceHandoffSlot = (props: SessionFeatureProps) => (
  <SlotPlaceholder {...props} title="Price and handoff" owner="Component 5" />
);
