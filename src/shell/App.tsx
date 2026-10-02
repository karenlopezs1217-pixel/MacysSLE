import { useCallback, useState, type ReactNode } from 'react';
import type { CompleteShopperRequest, FulfillmentMethod, Outfit, ShopperRequest, ShoppingSession } from '../shared/types';
import { createInitialSession, isRequestComplete, requestsEqual } from '../shared/session';
import { SAMPLE_DATA_LABEL, STORES } from '../shared/sampleData';
import type { SessionFeatureProps } from '../shared/featureProps';
import { TimeAndNeedIntake } from '../features/intake/TimeAndNeedIntake';
import { CuratedShortlist } from '../features/shortlist/CuratedShortlist';
import { buildShortlist } from '../features/shortlist/buildShortlist';
import { PriceHandoffSlot, StoreStockSlot, VirtualTryOnSlot } from './featureSlots';
import './shell.css';

function Step({
  n,
  title,
  owner,
  locked,
  lockedMessage,
  children,
}: {
  n: number;
  title: string;
  owner?: string;
  locked?: boolean;
  lockedMessage?: string;
  children: ReactNode;
}) {
  const headingId = `step-${n}-title`;
  return (
    <section className={`step${locked ? ' step--locked' : ''}`} aria-labelledby={headingId}>
      <div className="step-head">
        <span className="step-num" aria-hidden="true">
          {n}
        </span>
        <h2 id={headingId} className="step-title">
          {title}
        </h2>
        {owner && <span className="step-owner">{owner}</span>}
      </div>
      {locked ? <p className="step-locked-msg">{lockedMessage}</p> : children}
    </section>
  );
}

/** The application shell: owns ALL session state and passes it down with update callbacks. */
export function App() {
  const [session, setSession] = useState<ShoppingSession>(() => createInitialSession());
  /** Set once the shopper presses "Find outfits"; cleared whenever the request changes. */
  const [shortlistRequested, setShortlistRequested] = useState(false);
  /** Bumped when the session ends so feature components remount and drop local state (e.g. photos). */
  const [sessionId, setSessionId] = useState(0);

  const request = session.shopperRequest;

  const handleRequestChange = useCallback((next: ShopperRequest) => {
    setSession((s) => {
      if (requestsEqual(next, s.shopperRequest)) return s;
      // Any change invalidates the shortlist: never show options built for different constraints.
      return { ...s, shopperRequest: next, shortlistedOutfits: [], selectedOutfitId: null, fulfillmentMethod: null };
    });
    setShortlistRequested(false);
  }, []);

  const handleFindOutfits = useCallback((req: CompleteShopperRequest) => {
    setSession((s) => ({
      ...s,
      shortlistedOutfits: buildShortlist(req),
      selectedOutfitId: null,
      fulfillmentMethod: null,
    }));
    setShortlistRequested(true);
  }, []);

  const handleOutfitsChange = useCallback((outfits: Outfit[]) => {
    setSession((s) => ({ ...s, shortlistedOutfits: outfits }));
  }, []);

  const handleSelectOutfit = useCallback((outfitId: string | null) => {
    setSession((s) => ({ ...s, selectedOutfitId: outfitId, fulfillmentMethod: null }));
  }, []);

  const handleFulfillmentChange = useCallback((method: FulfillmentMethod | null) => {
    setSession((s) => ({ ...s, fulfillmentMethod: method }));
  }, []);

  const endSession = useCallback(() => {
    setSession(createInitialSession());
    setShortlistRequested(false);
    setSessionId((n) => n + 1);
  }, []);

  const featureProps: SessionFeatureProps = {
    session,
    onSelectOutfit: handleSelectOutfit,
    onFulfillmentChange: handleFulfillmentChange,
  };
  const hasSelection = session.shortlistedOutfits.some((o) => o.id === session.selectedOutfitId);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <h1 className="app-title">Shopping Copilot</h1>
        <p className="app-tagline">Tell us your time and need; we'll curate up to three options in your size.</p>
        <p className="app-banner" role="note">
          <span className="sample-tag">Prototype</span>
          <span>
            {SAMPLE_DATA_LABEL}. Every store, product, price and stock level is fictional, and all actions are
            simulated.
          </span>
        </p>
        <div className="app-toolbar">
          <label>
            Shopping at (sample store)
            <select
              value={request.storeId ?? ''}
              onChange={(e) => handleRequestChange({ ...request, storeId: e.target.value || null })}
            >
              <option value="">No store selected</option>
              {STORES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--secondary" onClick={endSession}>
            End session
          </button>
        </div>
      </header>

      <main id="main">
        <Step n={1} title="Time and need" owner="Component 1">
          <TimeAndNeedIntake request={request} onRequestChange={handleRequestChange} onSubmit={handleFindOutfits} />
        </Step>

        <Step
          n={2}
          title="Curated shortlist"
          owner="Component 2"
          locked={!(shortlistRequested && isRequestComplete(request))}
          lockedMessage="Complete step 1 and press “Find outfits” to see your options."
        >
          {isRequestComplete(request) && (
            <CuratedShortlist
              request={request}
              outfits={session.shortlistedOutfits}
              selectedOutfitId={session.selectedOutfitId}
              onOutfitsChange={handleOutfitsChange}
              onSelectOutfit={handleSelectOutfit}
            />
          )}
        </Step>

        <Step n={3} title="Virtual try-on and fit" owner="Component 3" locked={!hasSelection} lockedMessage="Choose an outfit in step 2 first.">
          <VirtualTryOnSlot key={`tryon-${sessionId}`} {...featureProps} />
        </Step>
        <Step n={4} title="Store stock, location and hold" owner="Component 4" locked={!hasSelection} lockedMessage="Choose an outfit in step 2 first.">
          <StoreStockSlot key={`stock-${sessionId}`} {...featureProps} />
        </Step>
        <Step n={5} title="Price and handoff" owner="Component 5" locked={!hasSelection} lockedMessage="Choose an outfit in step 2 first.">
          <PriceHandoffSlot key={`price-${sessionId}`} {...featureProps} />
        </Step>
      </main>
    </div>
  );
}
