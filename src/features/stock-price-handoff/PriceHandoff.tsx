// COMPONENT 5 — One clear price and fast handoff (SIMULATED payment, pickup and delivery).
// Reads the selected items and the price (computed from SAMPLE offers only); reports the chosen
// fulfillment method (and pickup holds) to the shell, then calls onFinish.
import { useId, useState } from "react";
import type { FulfillmentMethod, Hold, PriceBreakdown, Store } from "../../shared/types";
import type { DataProvider } from "../../shared/dataProvider";
import {
  createHold, formatDay, formatTime, formatUSD, getStock, isAvailable, mockConfirmationCode, pickupReadyBy,
  pickupStoresForAll, shipEta, type CartLine,
} from "./logic";

export interface PriceHandoffProps {
  data: DataProvider;
  lines: CartLine[];
  store: Store;
  price: PriceBreakdown;                                       // from computePrice()
  holds: Hold[];                                               // shell state
  onHoldsChange: (holds: Hold[]) => void;                      // callback: pickup holds on confirmation
  onFulfillmentChange: (method: FulfillmentMethod | null) => void; // callback: choice confirmed / cleared
  onFinish: () => void;                                        // callback: after confirmation
}

type Method = "pay-in-store" | "pickup" | "ship";
type Stage = "choose" | "terminal" | "confirmed";
/** What was confirmed. Mock details live here; only the method is shared with the shell. */
type Confirmation =
  | { type: "pay-in-store" }
  | { type: "pickup"; storeId: string; readyBy: string }
  | { type: "ship"; etaDate: string };

const TO_SHARED: Record<Method, FulfillmentMethod> = { "pay-in-store": "pay-in-store", pickup: "store-pickup", ship: "ship-to-home" };

export default function PriceHandoff({
  data, lines, store, price, holds, onHoldsChange, onFulfillmentChange, onFinish,
}: PriceHandoffProps) {
  const uid = useId();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [stage, setStage] = useState<Stage>("choose");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = data.now();
  const missingSize = lines.filter((l) => !l.size);
  const allHere = missingSize.length === 0 && lines.every((l) => isAvailable(getStock(data, store.id, l.product.id, l.size!)));
  const pickupStores = pickupStoresForAll(data, lines, store.id);
  const [pickupStoreId, setPickupStoreId] = useState<string | null>(null);
  const chosenPickup = pickupStores.find((s) => s.id === pickupStoreId) ?? pickupStores[0] ?? null;
  const eta = shipEta(now);
  const canShip = missingSize.length === 0 && lines.length > 0;

  const options: { id: Method; title: string; detail: string; enabled: boolean; blocked: string }[] = [
    {
      id: "pay-in-store", title: "Pay here and take it now",
      detail: `Pay at a ${store.name} register or terminal.`,
      enabled: allHere, blocked: missingSize.length ? "Choose a size for every item first." : `Not every item is in stock at ${store.name} in your size.`,
    },
    {
      id: "pickup", title: "Pick up in store",
      detail: chosenPickup ? `${chosenPickup.name}: ${chosenPickup.id === store.id ? "ready now" : `ready by ${formatDay(pickupReadyBy(data, chosenPickup.id, store.id))}, ${formatTime(pickupReadyBy(data, chosenPickup.id, store.id))}`}.` : "",
      enabled: pickupStores.length > 0, blocked: missingSize.length ? "Choose a size for every item first." : "No sample store has every item in your size.",
    },
    {
      id: "ship", title: "Ship to home",
      detail: `Sample estimate: arrives ${formatDay(eta)}.`,
      enabled: canShip, blocked: "Choose a size for every item first.",
    },
  ];
  const selected = options.find((o) => o.id === method && o.enabled) ?? null;

  const confirm = () => {
    setError(null);
    if (!selected) return;
    let result: Confirmation;
    let nextHolds = holds;
    if (selected.id === "pay-in-store") {
      result = { type: "pay-in-store" };
    } else if (selected.id === "pickup") {
      if (!chosenPickup) return;
      const newHolds = lines.map((l) => createHold(data, "pickup", l.product.id, l.size!, chosenPickup.id, store.id));
      if (newHolds.some((h) => h === null)) { setError("One item is no longer available at that store."); return; }
      const ids = new Set(lines.map((l) => l.product.id));
      nextHolds = [...holds.filter((h) => !ids.has(h.productId)), ...(newHolds as NonNullable<typeof newHolds[number]>[])];
      result = { type: "pickup", storeId: chosenPickup.id, readyBy: pickupReadyBy(data, chosenPickup.id, store.id).toISOString() };
    } else {
      result = { type: "ship", etaDate: eta.toISOString() };
    }
    if (nextHolds !== holds) onHoldsChange(nextHolds);
    onFulfillmentChange(TO_SHARED[selected.id]);
    setConfirmation(result);
    setCode(mockConfirmationCode(selected.id === "pay-in-store" ? "PAY" : selected.id === "pickup" ? "PU" : "SHIP"));
    setStage("confirmed");
  };

  const restartChoice = () => { onFulfillmentChange(null); setStage("choose"); setCode(null); setConfirmation(null); };
  const breakdownId = `${uid}-breakdown`;
  const f = confirmation;

  return (
    <section className="stock-price-handoff__section" aria-labelledby="sph-price-title">
      <div className="stock-price-handoff__section-head">
        <h3 id="sph-price-title" className="mc-section-title">Your price</h3>
        <span className="sample-badge">Sample prices &amp; offers</span>
      </div>

      <div className="mc-card stock-price-handoff__price-card">
        <p className="stock-price-handoff__you-pay-label">You pay</p>
        <p className="stock-price-handoff__you-pay" aria-live="polite">{formatUSD(price.youPay)}</p>
        <p className="mc-muted">
          {price.appliedOffer ? <>Includes {formatUSD(price.discount)} off with a sample offer. </> : <>No discount applied. </>}
          Before tax.
        </p>
        <button
          type="button" className="mc-btn mc-btn--ghost mc-btn--small" aria-expanded={showBreakdown} aria-controls={breakdownId}
          onClick={() => setShowBreakdown((v) => !v)}
        >
          {showBreakdown ? "Hide price breakdown" : "See price breakdown"}
        </button>

        <div id={breakdownId} hidden={!showBreakdown} className="stock-price-handoff__breakdown">
          <table className="stock-price-handoff__table">
            <caption className="mc-visually-hidden">Price breakdown (sample data)</caption>
            <tbody>
              {lines.map((l) => (
                <tr key={l.product.id}>
                  <th scope="row">{l.product.name}{l.size ? `, size ${l.size}` : ""}</th>
                  <td className="mc-price">{formatUSD(l.product.price)}</td>
                </tr>
              ))}
              <tr className="stock-price-handoff__row-sub">
                <th scope="row">Subtotal</th><td className="mc-price">{formatUSD(price.subtotal)}</td>
              </tr>
              <tr>
                <th scope="row">{price.appliedOffer ? price.appliedOffer.label : "Offer: none applied"}</th>
                <td className="mc-price">{price.discount > 0 ? `−${formatUSD(price.discount)}` : formatUSD(0)}</td>
              </tr>
              <tr className="stock-price-handoff__row-total">
                <th scope="row">You pay (before tax)</th><td className="mc-price">{formatUSD(price.youPay)}</td>
              </tr>
            </tbody>
          </table>
          {price.notes.length > 0 && (
            <>
              <h4 className="stock-price-handoff__sub">Other sample offers</h4>
              <ul className="stock-price-handoff__notes">{price.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </>
          )}
          <h4 className="stock-price-handoff__sub">Assumptions</h4>
          <ul className="stock-price-handoff__notes">
            <li><strong>Tax:</strong> not included. It is calculated at payment; this prototype uses no tax rate.</li>
            <li><strong>Delivery:</strong> no shipping fee is modeled. A real fee would be shown at checkout.</li>
            <li>Only offers defined in the sample data are used; one offer per order.</li>
          </ul>
        </div>
      </div>

      <div className="stock-price-handoff__section-head stock-price-handoff__handoff-head">
        <h3 className="mc-section-title" id="sph-handoff-title">Checkout</h3>
        <span className="mc-sim-badge">Simulation</span>
      </div>

      {stage === "choose" && (
        <fieldset className="stock-price-handoff__fieldset" aria-describedby="sph-handoff-note">
          <legend className="stock-price-handoff__legend">How do you want to get it?</legend>
          {options.map((o) => (
            <label key={o.id} className="mc-choice stock-price-handoff__choice" aria-disabled={!o.enabled}
              data-checked={method === o.id && o.enabled}>
              <input
                type="radio" name={`${uid}-method`} value={o.id} disabled={!o.enabled}
                checked={method === o.id && o.enabled} onChange={() => setMethod(o.id)}
              />
              <span>
                <strong>{o.title}</strong><br />
                <span className="mc-muted">{o.enabled ? o.detail : o.blocked}</span>
              </span>
            </label>
          ))}

          {selected?.id === "pickup" && pickupStores.length > 1 && (
            <div className="stock-price-handoff__pickup-stores">
              <label htmlFor={`${uid}-store`}>Pickup store</label>
              <select id={`${uid}-store`} className="stock-price-handoff__select" value={chosenPickup?.id}
                onChange={(e) => setPickupStoreId(e.target.value)}>
                {pickupStores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.id === store.id ? " (this store)" : ` (${data.distanceMiles(store.id, s.id)} mi)`}</option>
                ))}
              </select>
            </div>
          )}
          {selected?.id === "ship" && (
            <p className="mc-muted">Address entered at checkout (not collected in this prototype).</p>
          )}

          <p id="sph-handoff-note" className="mc-muted">No real payment, reservation or order is made.</p>
          {error && <p className="mc-alert mc-alert--error" role="alert">{error}</p>}
          <button type="button" className="mc-btn mc-btn--primary mc-btn--block" disabled={!selected}
            onClick={() => (selected?.id === "pay-in-store" ? setStage("terminal") : confirm())}>
            {selected?.id === "pay-in-store" ? `Pay ${formatUSD(price.youPay)} at terminal (simulated)`
              : selected?.id === "pickup" ? "Hold for pickup (simulated)"
              : selected?.id === "ship" ? "Place sample shipping order (simulated)"
              : "Choose an option"}
          </button>
        </fieldset>
      )}

      {stage === "terminal" && (
        <div className="mc-alert mc-alert--sim stock-price-handoff__terminal" role="region" aria-label="Simulated payment terminal">
          <p><span className="mc-sim-badge">Simulation</span></p>
          <p className="stock-price-handoff__terminal-amount">{formatUSD(price.youPay)} + tax</p>
          <p>Tap your card on the terminal.</p>
          <p className="mc-muted">This mock terminal collects no card data.</p>
          <div className="stock-price-handoff__actions">
            <button type="button" className="mc-btn mc-btn--primary" onClick={confirm}>Simulate card tap</button>
            <button type="button" className="mc-btn" onClick={() => setStage("choose")}>Back</button>
          </div>
        </div>
      )}

      {stage === "confirmed" && f && (
        <div className="mc-alert mc-alert--sim stock-price-handoff__confirm" role="status">
          <p className="stock-price-handoff__hold-head">
            <span className="mc-sim-badge">Simulation</span> Mock confirmation{code ? <> <strong>{code}</strong></> : null}
          </p>
          {f.type === "pay-in-store" && (
            <p><strong>Simulated payment approved.</strong> No card data was collected and no payment was processed.</p>
          )}
          {f.type === "pickup" && (
            <p>
              <strong>Simulated pickup hold</strong> at {data.getStore(f.storeId)?.name}.{" "}
              {f.storeId === store.id ? "Ready now" : `Ready by ${formatDay(new Date(f.readyBy))}, ${formatTime(new Date(f.readyBy))}`} (sample estimate).
              Pay at pickup. Not a real reservation.
            </p>
          )}
          {f.type === "ship" && (
            <p>
              <strong>Simulated ship-to-home order.</strong> Sample estimate: arrives {formatDay(new Date(f.etaDate))}
              {" "}(3 business days, sample rule). No order was placed.
            </p>
          )}
          <p className="mc-muted">You pay {formatUSD(price.youPay)} before tax (sample prices).</p>
          <div className="stock-price-handoff__actions">
            <button type="button" className="mc-btn mc-btn--primary" onClick={onFinish}>Finish</button>
            <button type="button" className="mc-btn" onClick={restartChoice}>Change how I get it</button>
          </div>
        </div>
      )}
    </section>
  );
}
