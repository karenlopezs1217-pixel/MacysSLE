// Feature "stock-price-handoff" = Component 4 (store stock, location, hold)
//                                + Component 5 (price and handoff).
// Default export is the FeatureProps entry the app shell mounts. StockHold and PriceHandoff are also
// exported for reuse. All state lives in the shell's session; only the shopper's size picks are local.
import { useEffect, useMemo, useState } from "react";
import { CONTRACT_VERSION, type FeatureProps } from "../../shared/types";
import StockHold from "./StockHold";
import PriceHandoff from "./PriceHandoff";
import DevScenarioSwitcher from "./DevScenarioSwitcher";
import { computePrice, resolveLines, resolveStore } from "./logic";
import "./styles.css";

export { default as StockHold, type StockHoldProps } from "./StockHold";
export { default as PriceHandoff, type PriceHandoffProps } from "./PriceHandoff";
export * as stockPriceLogic from "./logic";

export default function StockPriceHandoff({ session, data, onUpdate, onNavigate }: FeatureProps) {
  const [sizeOverrides, setSizeOverrides] = useState<Record<string, string>>({});
  const { lines, unknownIds } = useMemo(() => resolveLines(session, data, sizeOverrides), [session, data, sizeOverrides]);
  const { store, wasDefaulted } = useMemo(() => resolveStore(session, data), [session, data]);
  const price = useMemo(() => computePrice(lines.map((l) => l.product), data.getOffers(), data.now()), [lines, data]);

  // Mirror the computed price into the shared session so the shell / other features can read it.
  const priceKey = JSON.stringify(price);
  useEffect(() => {
    if (JSON.stringify(session.price) !== priceKey) onUpdate({ price });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey]);

  const onSizeChange = (productId: string, size: string) => {
    setSizeOverrides((o) => ({ ...o, [productId]: size }));
    // A hold or checkout for the old size no longer matches what the shopper wants.
    onUpdate({ holds: session.holds.filter((h) => h.productId !== productId || h.size === size), fulfillment: null });
  };

  return (
    <div className="stock-price-handoff">
      <header className="stock-price-handoff__header">
        <p className="mc-wordmark">Macy's Shopping Copilot</p>
        <h1 className="stock-price-handoff__title">Hold, price &amp; checkout</h1>
      </header>

      {session.contractVersion !== CONTRACT_VERSION && (
        <p className="mc-alert mc-alert--error" role="alert">
          This session uses contract {session.contractVersion}, but this feature expects {CONTRACT_VERSION}. Results may be wrong.
        </p>
      )}
      {wasDefaulted && (
        <p className="mc-alert" role="note">No store was selected, so we're showing {store.name}.</p>
      )}
      {unknownIds.length > 0 && (
        <p className="mc-alert mc-alert--error" role="alert">
          {unknownIds.length} selected item(s) are not in the sample catalog and were left out: {unknownIds.join(", ")}.
        </p>
      )}

      {lines.length === 0 ? (
        <div className="mc-card stock-price-handoff__empty">
          <h2 className="mc-section-title">Your bag is empty</h2>
          <p>Choose an outfit first, then come back to check stock and price.</p>
          <button type="button" className="mc-btn mc-btn--primary" onClick={() => onNavigate("intake-shortlist")}>Back to options</button>
        </div>
      ) : (
        <>
          <StockHold session={session} data={data} lines={lines} store={store} onUpdate={onUpdate} onSizeChange={onSizeChange} />
          <PriceHandoff session={session} data={data} lines={lines} store={store} price={price} onUpdate={onUpdate} onNavigate={onNavigate} />
        </>
      )}

      <nav className="stock-price-handoff__nav" aria-label="Previous steps">
        <button type="button" className="mc-btn mc-btn--ghost mc-btn--small" onClick={() => onNavigate("try-on")}>Back to fit preview</button>
        <button type="button" className="mc-btn mc-btn--ghost mc-btn--small" onClick={() => onNavigate("intake-shortlist")}>Back to options</button>
      </nav>

      <DevScenarioSwitcher onUpdate={onUpdate} />
    </div>
  );
}
