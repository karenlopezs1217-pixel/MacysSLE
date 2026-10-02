// Components 4 (store stock, location, hold) and 5 (price and handoff).
// Exports one section component per step; both derive the same cart from shell state via `useCart`,
// so nothing is duplicated and nothing is stored here except the shopper's in-progress UI choices.
import { useMemo } from "react";
import type { SessionFeatureProps } from "../../shared/featureProps";
import { sampleDataProvider as data } from "../../shared/dataProvider";
import StockHold from "./StockHold";
import PriceHandoff from "./PriceHandoff";
import { computePrice, resolveLines, resolveStore } from "./logic";
import "./styles.css";

export { default as StockHold, type StockHoldProps } from "./StockHold";
export { default as PriceHandoff, type PriceHandoffProps } from "./PriceHandoff";
export * as stockPriceLogic from "./logic";

/** The selected outfit as cart lines (shared product IDs + resolved sizes), the store and the price. */
export function useCart({ session, extras }: Pick<SessionFeatureProps, "session" | "extras">) {
  const outfit = session.shortlistedOutfits.find((o) => o.id === session.selectedOutfitId);
  const productIds = outfit?.productIds ?? [];
  const idsKey = productIds.join(",");
  const requestedSize = session.shopperRequest.size;
  const { lines, unknownIds } = useMemo(
    () => resolveLines({ productIds, requestedSize, tryOnSizes: extras.tryOnSizes, overrides: extras.sizeOverrides }, data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey, requestedSize, extras.tryOnSizes, extras.sizeOverrides],
  );
  const { store, wasDefaulted } = useMemo(() => resolveStore(session.shopperRequest.storeId, data), [session.shopperRequest.storeId]);
  const price = useMemo(() => computePrice(lines.map((l) => l.product), data.getOffers(), data.now()), [lines]);
  return { lines, unknownIds, store, wasDefaulted, price };
}

function Notices({ unknownIds }: { unknownIds: string[] }) {
  return unknownIds.length > 0 ? (
    <p className="mc-alert mc-alert--error" role="alert">
      {unknownIds.length} selected item(s) are not in the sample catalog and were left out: {unknownIds.join(", ")}.
    </p>
  ) : null;
}

/** Step 4: Component 4. */
export function StockHoldSection(props: SessionFeatureProps) {
  const { extras, onExtrasChange } = props;
  const { lines, unknownIds, store, wasDefaulted } = useCart(props);

  const onSizeChange = (productId: string, size: string) => {
    // A hold or checkout for the old size no longer matches what the shopper wants.
    onExtrasChange({
      sizeOverrides: { ...extras.sizeOverrides, [productId]: size },
      holds: extras.holds.filter((h) => h.productId !== productId || h.size === size),
    });
    props.onFulfillmentChange(null);
  };

  return (
    <div className="stock-price-handoff">
      {wasDefaulted && <p className="mc-alert" role="note">No store was selected, so we're showing {store.name}.</p>}
      <Notices unknownIds={unknownIds} />
      <StockHold
        data={data}
        lines={lines}
        store={store}
        holds={extras.holds}
        onHoldsChange={(holds) => onExtrasChange({ holds })}
        missedDemand={extras.missedDemand}
        onMissedDemandChange={(missedDemand) => onExtrasChange({ missedDemand })}
        onSizeChange={onSizeChange}
      />
    </div>
  );
}

/** Step 5: Component 5. */
export function PriceHandoffSection(props: SessionFeatureProps) {
  const { extras, onExtrasChange, onFulfillmentChange, onFinish } = props;
  const { lines, unknownIds, store, price } = useCart(props);

  return (
    <div className="stock-price-handoff">
      <Notices unknownIds={unknownIds} />
      <PriceHandoff
        key={lines.map((l) => l.size ?? "-").join(",")} // a size change invalidates any earlier choice
        data={data}
        lines={lines}
        store={store}
        price={price}
        holds={extras.holds}
        onHoldsChange={(holds) => onExtrasChange({ holds })}
        onFulfillmentChange={onFulfillmentChange}
        onFinish={onFinish}
      />
    </div>
  );
}
