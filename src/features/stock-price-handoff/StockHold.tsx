// COMPONENT 4 — Store stock, location and hold (SIMULATED holds, SAMPLE inventory).
// Reads shared product IDs, sizes and the selected store; reports holds and missed demand to the shell.
import { useEffect } from "react";
import type { Hold, MissedDemandEvent, Store } from "../../shared/types";
import type { DataProvider } from "../../shared/dataProvider";
import {
  FITTING_ROOM_LABEL, adjacentSizeInStock, createHold, findFallbackStore, formatDay, formatTime, formatUSD,
  formatWhen, getStock, isAvailable, missedDemandFor, pickupReadyBy, type CartLine, type StockInfo,
} from "./logic";

export interface StockHoldProps {
  data: DataProvider;
  lines: CartLine[];
  store: Store;                                             // the shopper's selected store
  holds: Hold[];                                            // shell state
  onHoldsChange: (holds: Hold[]) => void;                   // callback: hold / cancel
  missedDemand: MissedDemandEvent[];                        // shell state
  onMissedDemandChange: (events: MissedDemandEvent[]) => void; // callback: once per out-of-stock size
  onSizeChange: (productId: string, size: string) => void;  // callback: shopper picks / switches a size
}

const SIZE_SOURCE_TEXT: Record<CartLine["sizeSource"], string> = {
  "try-on": "from your fit preview",
  request: "from your request",
  shopper: "you chose",
  none: "",
};

function StatusLine({ stock, size }: { stock: StockInfo; size: string }) {
  if (stock.level === "in-stock") return <span className="mc-status mc-status--ok">In stock here</span>;
  if (stock.level === "low-stock") return <span className="mc-status mc-status--low">Low stock here</span>;
  return <span className="mc-status mc-status--out">Not in this store in size {size}</span>;
}

export default function StockHold({
  data, lines, store, holds, onHoldsChange, missedDemand, onMissedDemandChange, onSizeChange,
}: StockHoldProps) {
  // Log missed demand once per out-of-stock store/product/size (dedupe lives in missedDemandFor).
  const linesKey = lines.map((l) => `${l.product.id}:${l.size}`).join(",");
  useEffect(() => {
    const events = missedDemandFor(lines, data, store.id, missedDemand);
    if (events.length) onMissedDemandChange([...missedDemand, ...events]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, store.id]);

  const placeHold = (type: Hold["type"], productId: string, size: string, storeId: string) => {
    const hold = createHold(data, type, productId, size, storeId, store.id);
    if (!hold) return; // UI never offers this, but the rule is enforced here too
    onHoldsChange([...holds.filter((h) => h.productId !== productId), hold]);
  };
  const cancelHold = (holdId: string) => onHoldsChange(holds.filter((h) => h.holdId !== holdId));
  const now = data.now();

  return (
    <section className="stock-price-handoff__section" aria-labelledby="sph-stock-title">
      <div className="stock-price-handoff__section-head">
        <h3 id="sph-stock-title" className="mc-section-title">Stock by item</h3>
        <span className="sample-badge">Sample data</span>
      </div>
      <p className="mc-muted stock-price-handoff__lede">
        Stock at <strong>{store.name}</strong>. Sample inventory, not verified live stock.
      </p>

      <ul className="stock-price-handoff__list">
        {lines.map((line) => {
          const { product, size } = line;
          const hold = holds.find((h) => h.productId === product.id);
          const holdStore = hold ? data.getStore(hold.storeId) : undefined;
          const stock = size ? getStock(data, store.id, product.id, size) : null;
          const here = stock ? isAvailable(stock) : false;
          const fallback = size && !here ? findFallbackStore(data, store.id, product.id, size) : null;
          const altSize = size && !here ? adjacentSizeInStock(data, store.id, product, size) : null;
          const sizeSelectId = `sph-size-${product.id}`;

          return (
            <li key={product.id} className="mc-card stock-price-handoff__item">
              <img
                className="stock-price-handoff__img" src={product.imageUrl} width={88} height={101}
                alt={`${product.name} (sample image)`}
              />
              <div className="stock-price-handoff__item-body">
                <h4 className="stock-price-handoff__item-name">{product.name}</h4>
                <p className="mc-muted stock-price-handoff__meta">
                  <span className="mc-price">{formatUSD(product.price)}</span>
                </p>

                <div className="stock-price-handoff__size-row">
                  <label htmlFor={sizeSelectId}>Size</label>
                  <select
                    id={sizeSelectId} className="stock-price-handoff__select" value={size ?? ""}
                    onChange={(e) => onSizeChange(product.id, e.target.value)}
                  >
                    {!size && <option value="" disabled>Choose a size</option>}
                    {product.availableSizes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {size && line.sizeSource !== "none" && <span className="mc-muted">{SIZE_SOURCE_TEXT[line.sizeSource]}</span>}
                </div>

                {!size || !stock ? (
                  <p className="stock-price-handoff__need">No size yet. Choose one to check stock.</p>
                ) : (
                  <>
                    <p className="stock-price-handoff__status"><StatusLine stock={stock} size={size} /></p>
                    {here && (
                      <p className="stock-price-handoff__loc">
                        <strong>Floor {stock.floor}</strong> · {stock.department}
                      </p>
                    )}

                    {!here && (
                      <div className="mc-panel stock-price-handoff__fallback">
                        {fallback ? (
                          <p>
                            In stock at <strong>{fallback.store.name}</strong> ({data.distanceMiles(store.id, fallback.store.id)} mi) ·
                            Floor {fallback.stock.floor}, {fallback.stock.department}.
                          </p>
                        ) : (
                          <p>Not in stock in size {size} at any sample store.</p>
                        )}
                        <p className="mc-muted">
                          Or have it shipped: choose <strong>Ship to home</strong> below. (Sample assumption: the
                          online warehouse can ship every catalog item.)
                        </p>
                        {altSize && (
                          <p>
                            {data.getFit(product.id)?.runs === "small" ? "Runs small" : "Runs large"}; size {altSize} is in stock here.{" "}
                            <button type="button" className="mc-btn mc-btn--small" onClick={() => onSizeChange(product.id, altSize)}>
                              Switch to size {altSize}
                            </button>
                          </p>
                        )}
                      </div>
                    )}

                    {hold ? (
                      <div className="mc-alert mc-alert--sim stock-price-handoff__hold" role="status">
                        <p className="stock-price-handoff__hold-head">
                          <span className="mc-sim-badge">Simulation</span> Mock hold <strong>{hold.holdId}</strong>
                        </p>
                        <p>
                          {hold.type === "fitting-room"
                            ? <>Held in <strong>{FITTING_ROOM_LABEL}</strong> at {holdStore?.name}, size {hold.size}. An associate would bring it to you.</>
                            : <>Held for pickup at <strong>{holdStore?.name}</strong>, size {hold.size}. Ready {hold.storeId === store.id ? "now" : `by ${formatDay(pickupReadyBy(data, hold.storeId, store.id))} at ${formatTime(pickupReadyBy(data, hold.storeId, store.id))}`}.</>}
                        </p>
                        <p className="mc-muted">Held until {formatWhen(hold.expiresAt, now)}. Not a real reservation.</p>
                        <button type="button" className="mc-btn mc-btn--small" onClick={() => cancelHold(hold.holdId)}>
                          Cancel hold
                        </button>
                      </div>
                    ) : (
                      <div className="stock-price-handoff__actions">
                        {here && (
                          <>
                            <button type="button" className="mc-btn mc-btn--primary mc-btn--small" onClick={() => placeHold("fitting-room", product.id, size, store.id)}>
                              Hold in fitting room
                            </button>
                            <button type="button" className="mc-btn mc-btn--small" onClick={() => placeHold("pickup", product.id, size, store.id)}>
                              Hold for pickup
                            </button>
                          </>
                        )}
                        {!here && fallback && (
                          <button type="button" className="mc-btn mc-btn--primary mc-btn--small" onClick={() => placeHold("pickup", product.id, size, fallback.store.id)}>
                            Hold for pickup at {fallback.store.name}
                          </button>
                        )}
                        <span className="mc-muted stock-price-handoff__sim-note">Holds are simulated.</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
