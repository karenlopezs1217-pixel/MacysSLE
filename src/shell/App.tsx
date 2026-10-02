import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  CompleteShopperRequest,
  FulfillmentMethod,
  MissedDemandEvent,
  Outfit,
  ShopperRequest,
  ShoppingSession,
} from '../shared/types';
import { createInitialSession, isRequestComplete, requestsEqual } from '../shared/session';
import { DEMO_NOW, OCCASIONS, STORES, getProduct, getStore } from '../shared/sampleData';
import { EMPTY_EXTRAS, type SessionExtras, type SessionFeatureProps } from '../shared/featureProps';
import { formatPrice } from '../shared/money';
import { TimeAndNeedIntake } from '../features/intake/TimeAndNeedIntake';
import { CuratedShortlist } from '../features/shortlist/CuratedShortlist';
import { buildShortlist, summarizeShortlist } from '../features/shortlist/buildShortlist';
import { useCart } from '../features/stock-price-handoff';
import { PriceHandoffSlot, StoreStockSlot, VirtualTryOnSlot } from './featureSlots';
import './shell.css';

type StepNumber = 1 | 2 | 3 | 4 | 5;
type StepState = StepNumber | 'done';

const STEPS: Array<{ n: StepNumber; label: string; title: string; lead: string }> = [
  { n: 1, label: 'Need', title: 'What do you need today?', lead: 'Tell us in your own words — type or speak. You can edit anything we understand.' },
  { n: 2, label: 'Options', title: 'Your top picks', lead: 'Every piece is in your size, in stock at your store (sample data), and within your total budget.' },
  { n: 3, label: 'Fit', title: 'See the fit', lead: 'A quick mock preview and size guidance before you walk to the fitting room.' },
  { n: 4, label: 'Stock', title: 'Find it in store', lead: 'Where each piece is, and a simulated hold so it is waiting for you.' },
  { n: 5, label: 'Price', title: 'Your price and checkout', lead: 'One clear total, then pick how you want to get it.' },
];

const METHOD_LABEL: Record<FulfillmentMethod, string> = {
  'pay-in-store': 'Pay in store and take it now',
  'store-pickup': 'Pick up in store',
  'ship-to-home': 'Ship to home',
  'fitting-room': 'Fitting room',
};

/** Missed-demand events the shortlist should log when it cannot fully satisfy a request. */
function shortlistMissedDemand(req: CompleteShopperRequest): MissedDemandEvent[] {
  const { mode, reason } = summarizeShortlist(req);
  if (mode === 'outfits' || !reason) return [];
  const mapped: Record<string, MissedDemandEvent['reason']> = {
    'no-stock': 'size-out-of-stock',
    'no-occasion': 'no-match',
    'over-budget': 'over-budget',
    'no-complete-outfit': 'no-match',
  };
  return [{ at: DEMO_NOW.toISOString(), storeId: req.storeId, productId: null, size: req.size, reason: mapped[reason], source: 'intake-shortlist' }];
}

const mergeEvents = (existing: MissedDemandEvent[], added: MissedDemandEvent[]) => {
  const key = (e: MissedDemandEvent) => `${e.source}|${e.reason}|${e.storeId}|${e.productId}|${e.size}`;
  const seen = new Set(existing.map(key));
  return [...existing, ...added.filter((e) => !seen.has(key(e)) && seen.add(key(e)))];
};

function StepFooter({
  backLabel,
  onBack,
  nextLabel,
  onNext,
  nextDisabled,
  hint,
}: {
  backLabel: string;
  onBack: () => void;
  nextLabel?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="step-footer">
      {hint && <p className="step-footer-hint">{hint}</p>}
      <div className="step-footer-row">
        <button type="button" className="mc-btn" onClick={onBack}>
          ← {backLabel}
        </button>
        {nextLabel && onNext && (
          <button type="button" className="mc-btn mc-btn--primary step-footer-next" onClick={onNext} disabled={nextDisabled}>
            {nextLabel} →
          </button>
        )}
      </div>
    </div>
  );
}

function Panel({ n, current, children }: { n: StepNumber; current: StepState; children: ReactNode }) {
  const meta = STEPS[n - 1];
  return (
    <section className="panel" aria-labelledby={`step-title-${n}`} hidden={current !== n}>
      <h2 id={`step-title-${n}`} className="panel-title" tabIndex={-1}>
        {meta.title}
      </h2>
      <p className="panel-lead">{meta.lead}</p>
      {children}
    </section>
  );
}

/** The application shell: owns ALL session state, drives the guided flow, and passes state + callbacks down. */
export function App() {
  const [session, setSession] = useState<ShoppingSession>(() => createInitialSession());
  const [extras, setExtras] = useState<SessionExtras>(EMPTY_EXTRAS);
  const [step, setStep] = useState<StepState>(1);
  /** Steps the shopper has opened. Panels mount on first visit (so nothing is logged for unseen steps) and stay mounted. */
  const [visited, setVisited] = useState<StepNumber[]>([1]);
  const [shortlistRequested, setShortlistRequested] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Bumped when the session ends so feature components remount and drop local state (e.g. photos). */
  const [sessionId, setSessionId] = useState(0);
  const firstRender = useRef(true);

  const request = session.shopperRequest;
  const selectedOutfit = session.shortlistedOutfits.find((o) => o.id === session.selectedOutfitId);
  const hasSelection = selectedOutfit !== undefined;
  const complete = isRequestComplete(request);

  const canGo = (n: StepNumber) => (n === 1 ? true : n === 2 ? shortlistRequested && complete : hasSelection);

  const goTo = useCallback((n: StepNumber) => {
    setStep(n);
    setVisited((v) => (v.includes(n) ? v : [...v, n]));
  }, []);

  // Move focus to the new step's heading and bring it into view (keyboard and screen-reader friendly).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    const id = step === 'done' ? 'done-title' : `step-title-${step}`;
    document.getElementById(id)?.focus({ preventScroll: true });
  }, [step]);

  /** Anything chosen downstream of the shortlist is void once the outfit or request changes. */
  const resetDownstream = (e: SessionExtras): SessionExtras => ({ ...EMPTY_EXTRAS, missedDemand: e.missedDemand });

  const handleRequestChange = useCallback(
    (next: ShopperRequest) => {
      if (requestsEqual(next, session.shopperRequest)) return;
      const hadResults = shortlistRequested;
      // Any change invalidates the shortlist: never show options built for different constraints.
      setSession((s) => ({ ...s, shopperRequest: next, shortlistedOutfits: [], selectedOutfitId: null, fulfillmentMethod: null }));
      setExtras((e) => resetDownstream(e));
      setShortlistRequested(false);
      setVisited([1]);
      if (hadResults) setNotice('Your details changed, so the old options were cleared. Review them and tap “Find outfits” again.');
      if (step !== 1) setStep(1);
    },
    [session.shopperRequest, shortlistRequested, step],
  );

  const handleFindOutfits = useCallback(
    (req: CompleteShopperRequest) => {
      setSession((s) => ({ ...s, shortlistedOutfits: buildShortlist(req), selectedOutfitId: null, fulfillmentMethod: null }));
      setExtras((e) => ({ ...resetDownstream(e), missedDemand: mergeEvents(e.missedDemand, shortlistMissedDemand(req)) }));
      setShortlistRequested(true);
      setNotice(null);
      setVisited([1, 2]);
      setStep(2);
    },
    [],
  );

  const handleOutfitsChange = useCallback(
    (outfits: Outfit[]) => {
      // Swapping a piece in the selected outfit changes what was selected: drop later choices.
      const before = session.shortlistedOutfits.find((o) => o.id === session.selectedOutfitId)?.productIds.join();
      const after = outfits.find((o) => o.id === session.selectedOutfitId)?.productIds.join();
      const changed = before !== after;
      setSession((s) => ({ ...s, shortlistedOutfits: outfits, fulfillmentMethod: changed ? null : s.fulfillmentMethod }));
      if (changed) setExtras((e) => resetDownstream(e));
    },
    [session.shortlistedOutfits, session.selectedOutfitId],
  );

  const handleSelectOutfit = useCallback((outfitId: string | null) => {
    setSession((s) => ({ ...s, selectedOutfitId: outfitId, fulfillmentMethod: null }));
    setExtras((e) => resetDownstream(e));
    if (outfitId) {
      setVisited([1, 2, 3]);
      setStep(3);
    }
  }, []);

  const handleFulfillmentChange = useCallback((method: FulfillmentMethod | null) => {
    setSession((s) => ({ ...s, fulfillmentMethod: method }));
  }, []);

  const handleExtrasChange = useCallback((patch: Partial<SessionExtras>) => {
    setExtras((e) => ({ ...e, ...patch }));
  }, []);

  const endSession = useCallback(() => {
    setSession(createInitialSession());
    setExtras(EMPTY_EXTRAS);
    setShortlistRequested(false);
    setNotice(null);
    setVisited([1]);
    setStep(1);
    setSessionId((n) => n + 1);
  }, []);

  const featureProps: SessionFeatureProps = {
    session,
    extras,
    onSelectOutfit: handleSelectOutfit,
    onFulfillmentChange: handleFulfillmentChange,
    onExtrasChange: handleExtrasChange,
    onFinish: () => setStep('done'),
  };
  const cart = useCart({ session, extras });
  // Steps 4-5 start over when the outfit's pieces change; the try-on keeps the shopper's photo until the session ends.
  const outfitKey = `${sessionId}-${selectedOutfit?.id}-${selectedOutfit?.productIds.join('+')}`;
  const occasionLabel = OCCASIONS.find((o) => o.id === request.occasion)?.label;
  const storeName = getStore(request.storeId)?.name;
  const mounted = (n: StepNumber) => visited.includes(n);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="app-header">
        <div className="app-header-row">
          <p className="mc-wordmark">Shopping Copilot</p>
          <button type="button" className="mc-btn mc-btn--small app-reset" onClick={endSession}>
            End session
          </button>
        </div>
        <p className="app-banner" role="note">
          <span className="mc-sample-badge">Prototype</span>
          <span>Sample data only — not live stock or prices. Every action is simulated.</span>
        </p>
        <label className="app-store">
          <span>Shopping at (sample store)</span>
          <select value={request.storeId ?? ''} onChange={(e) => handleRequestChange({ ...request, storeId: e.target.value || null })}>
            <option value="">No store selected</option>
            {STORES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {step !== 'done' && (
        <nav className="stepper" aria-label="Progress">
          <ol>
            {STEPS.map(({ n, label }) => {
              const current = step === n;
              const reachable = canGo(n);
              const done = reachable && n < step;
              return (
                <li key={n} className={`stepper-item${current ? ' is-current' : ''}${done ? ' is-done' : ''}`}>
                  <button
                    type="button"
                    className="stepper-btn"
                    disabled={!reachable}
                    aria-current={current ? 'step' : undefined}
                    aria-label={`Step ${n}: ${label}${done ? ' (completed)' : ''}`}
                    onClick={() => goTo(n)}
                  >
                    <span className="stepper-num" aria-hidden="true">
                      {done ? '✓' : n}
                    </span>
                    <span className="stepper-label" aria-hidden="true">
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {step !== 'done' && complete && step !== 1 && (
        <p className="context-bar" aria-label="Your request">
          <span>
            <strong>{occasionLabel}</strong> · size <strong>{request.size}</strong> · up to <strong>{formatPrice(request.budget)}</strong> ·{' '}
            {storeName}
          </span>
          {hasSelection && (
            <span className="context-total">
              Selected: <strong>{formatPrice(selectedOutfit.totalPrice)}</strong>
            </span>
          )}
          <button type="button" className="mc-btn mc-btn--ghost mc-btn--small" onClick={() => goTo(1)}>
            Edit
          </button>
        </p>
      )}

      <main id="main" className="app-main">
        <p className="visually-hidden" role="status" aria-live="polite">
          {step === 'done' ? 'All done' : `Step ${step} of 5: ${STEPS[step - 1].title}`}
        </p>

        <Panel n={1} current={step}>
          {notice && (
            <p className="mc-alert" role="status">
              {notice}
            </p>
          )}
          <TimeAndNeedIntake request={request} onRequestChange={handleRequestChange} onSubmit={handleFindOutfits} />
        </Panel>

        <Panel n={2} current={step}>
          {mounted(2) && complete && (
            <CuratedShortlist
              request={request}
              outfits={session.shortlistedOutfits}
              selectedOutfitId={session.selectedOutfitId}
              onOutfitsChange={handleOutfitsChange}
              onSelectOutfit={handleSelectOutfit}
            />
          )}
          <StepFooter
            backLabel="Edit my details"
            onBack={() => goTo(1)}
            nextLabel="Continue with selected outfit"
            onNext={() => goTo(3)}
            nextDisabled={!hasSelection}
            hint={hasSelection ? undefined : 'Tap “Choose this one” on an option to continue.'}
          />
        </Panel>

        <Panel n={3} current={step}>
          {mounted(3) && hasSelection && <VirtualTryOnSlot key={`tryon-${sessionId}`} {...featureProps} />}
          <StepFooter backLabel="Back to options" onBack={() => goTo(2)} nextLabel="Continue to stock" onNext={() => goTo(4)} />
        </Panel>

        <Panel n={4} current={step}>
          {mounted(4) && hasSelection && <StoreStockSlot key={`stock-${outfitKey}`} {...featureProps} />}
          <StepFooter backLabel="Back to fit" onBack={() => goTo(3)} nextLabel="Continue to price" onNext={() => goTo(5)} />
        </Panel>

        <Panel n={5} current={step}>
          {mounted(5) && hasSelection && <PriceHandoffSlot key={`price-${outfitKey}`} {...featureProps} />}
          <StepFooter backLabel="Back to stock" onBack={() => goTo(4)} />
        </Panel>

        {step === 'done' && (
          <section className="panel done" aria-labelledby="done-title">
            <p className="done-check" aria-hidden="true">✓</p>
            <h2 id="done-title" className="panel-title" tabIndex={-1}>
              You're all set <span className="mc-sim-badge">Simulation</span>
            </h2>
            <p className="panel-lead">Nothing was paid, reserved or shipped — this was a walkthrough with sample data.</p>
            <ul className="done-list">
              {cart.lines.map((l) => (
                <li key={l.product.id}>
                  <img src={l.product.imageUrl} alt="" width={40} height={52} />
                  <span>
                    {l.product.name}
                    {l.size ? `, size ${l.size}` : ''}
                  </span>
                  <span className="mc-price">{formatPrice(l.product.price)}</span>
                </li>
              ))}
            </ul>
            <p className="done-total">
              You pay <strong>{formatPrice(cart.price.youPay)}</strong> <span className="mc-muted">before tax (sample prices)</span>
            </p>
            {session.fulfillmentMethod && <p>{METHOD_LABEL[session.fulfillmentMethod]} at {storeName}.</p>}
            <div className="done-actions">
              <button type="button" className="mc-btn mc-btn--primary" onClick={endSession}>
                Start a new session
              </button>
              <button type="button" className="mc-btn" onClick={() => goTo(5)}>
                Back to checkout
              </button>
            </div>
          </section>
        )}

        <details className="merchant">
          <summary>Merchant view: missed demand (sample)</summary>
          {extras.missedDemand.length === 0 ? (
            <p className="mc-muted">Nothing unmet so far this session.</p>
          ) : (
            <div className="merchant-scroll">
              <table className="merchant-table">
                <caption className="visually-hidden">Needs the store could not meet</caption>
                <thead>
                  <tr>
                    <th scope="col">Reason</th>
                    <th scope="col">Store</th>
                    <th scope="col">Item</th>
                    <th scope="col">Size</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {extras.missedDemand.map((e, i) => (
                    <tr key={i}>
                      <td>{e.reason}</td>
                      <td>{getStore(e.storeId)?.name ?? '—'}</td>
                      <td>{e.productId ? getProduct(e.productId)?.name ?? e.productId : '—'}</td>
                      <td>{e.size ?? '—'}</td>
                      <td>{e.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      </main>
    </div>
  );
}
