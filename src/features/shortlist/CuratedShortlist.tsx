import { useState } from 'react';
import type { CompleteShopperRequest, Outfit, Product } from '../../shared/types';
import { formatPrice } from '../../shared/money';
import {
  SAMPLE_CATALOG,
  bestPickLine,
  getSwapCandidates,
  summarizeShortlist,
  swapPiece,
  type Catalog,
} from './buildShortlist';
import './shortlist.css';

export interface CuratedShortlistProps {
  /** A COMPLETE request (the shell only renders this once intake is complete). */
  request: CompleteShopperRequest;
  /** Shortlist held in the shell's session state. */
  outfits: Outfit[];
  selectedOutfitId: string | null;
  /** Called with the full replacement list after a successful "Swap this piece". */
  onOutfitsChange: (outfits: Outfit[]) => void;
  /** Called when the shopper chooses an option. */
  onSelectOutfit: (outfitId: string) => void;
  /** Defaults to the shared sample catalog. */
  catalog?: Catalog;
}

const STOCK_LABEL = { in_stock: 'In stock', low_stock: 'Low stock' } as const;

function PieceImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="sl-img sl-img--placeholder" role="img" aria-label={`${product.name} (image unavailable)`}>
        {product.category}
      </div>
    );
  }
  return (
    <img
      className="sl-img"
      src={product.imageUrl}
      alt={product.name}
      width={64}
      height={82}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function CuratedShortlist({
  request,
  outfits,
  selectedOutfitId,
  onOutfitsChange,
  onSelectOutfit,
  catalog = SAMPLE_CATALOG,
}: CuratedShortlistProps) {
  const [announcement, setAnnouncement] = useState('');
  const [swapErrors, setSwapErrors] = useState<Record<string, string>>({});
  const summary = summarizeShortlist(request, catalog);
  const storeName = catalog.stores.find((s) => s.id === request.storeId)?.name ?? request.storeId;
  const occasionLabel = catalog.occasions.find((o) => o.id === request.occasion)?.label ?? request.occasion;

  function handleSwap(outfit: Outfit, productId: string) {
    const result = swapPiece(outfits, outfit.id, productId, request, catalog);
    if (!result.ok) {
      setSwapErrors((e) => ({ ...e, [outfit.id]: result.message }));
      setAnnouncement(result.message);
      return;
    }
    setSwapErrors((e) => {
      const { [outfit.id]: _removed, ...rest } = e;
      return rest;
    });
    const updated = result.outfits.find((o) => o.id === outfit.id)!;
    setAnnouncement(
      `Swapped ${result.from.name} for ${result.to.name}. New total ${formatPrice(updated.totalPrice)}.`,
    );
    onOutfitsChange(result.outfits);
  }

  return (
    <div className="sl">
      <p className="sl-criteria">
        Showing sample-data options for <strong>{occasionLabel}</strong> · size <strong>{request.size}</strong> ·{' '}
        <strong>{storeName}</strong> · total under or at <strong>{formatPrice(request.budget)}</strong>
      </p>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      {summary.message && (
        <p className={`sl-notice${outfits.length === 0 ? ' sl-notice--empty' : ''}`} role="status">
          {summary.message}
        </p>
      )}

      {outfits.length === 0 ? (
        <p className="sl-empty-hint">
          No options to show. Nothing has been substituted or loosened — your size, store, occasion and budget are
          exactly as entered.
        </p>
      ) : (
        <>
          {outfits.length < 3 && (
            <p className="sl-count">
              Only {outfits.length} {outfits.length === 1 ? 'option qualifies' : 'options qualify'}.
            </p>
          )}
          <ol className="sl-list">
            {outfits.map((outfit, index) => {
              const products = outfit.productIds
                .map((id) => catalog.products.find((p) => p.id === id))
                .filter((p): p is Product => p !== undefined);
              const selected = outfit.id === selectedOutfitId;
              const titleId = `sl-title-${outfit.id}`;
              return (
                <li
                  key={outfit.id}
                  className={`sl-card${outfit.isBestPick ? ' sl-card--best' : ''}${selected ? ' sl-card--selected' : ''}`}
                  aria-labelledby={titleId}
                >
                  <header className="sl-card-head">
                    <h3 id={titleId} className="sl-card-title">
                      {summary.mode === 'items' ? 'Item' : 'Option'} {index + 1}
                    </h3>
                    {outfit.isBestPick && <span className="sl-badge">Best pick</span>}
                    {selected && <span className="sl-badge sl-badge--selected">Selected</span>}
                  </header>

                  {outfit.isBestPick && <p className="sl-best-line">{bestPickLine(outfit, request, catalog)}</p>}

                  <ul className="sl-pieces">
                    {products.map((product) => {
                      const record = catalog.inventory.find(
                        (r) => r.productId === product.id && r.storeId === request.storeId && r.size === request.size,
                      );
                      const canSwap = getSwapCandidates(outfit, product.id, request, catalog).length > 0;
                      return (
                        <li key={product.id} className="sl-piece">
                          <PieceImage product={product} />
                          <div className="sl-piece-body">
                            <span className="sl-piece-name">{product.name}</span>
                            <span className="sl-piece-meta">
                              Size {request.size} · {formatPrice(product.price)}
                              {record && record.stockStatus !== 'out_of_stock' && (
                                <span className={`sl-stock sl-stock--${record.stockStatus}`}>
                                  {STOCK_LABEL[record.stockStatus]}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              className="btn btn--link"
                              onClick={() => handleSwap(outfit, product.id)}
                              disabled={!canSwap}
                              aria-label={`Swap this piece: ${product.name}${canSwap ? '' : ' (no alternatives available)'}`}
                            >
                              {canSwap ? 'Swap this piece' : 'No swap available'}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <p className="sl-total">
                    <span>{products.length > 1 ? 'Outfit total' : 'Total'}</span>
                    <strong>{formatPrice(outfit.totalPrice)}</strong>
                  </p>
                  <p className="sl-reason">{outfit.reason}</p>
                  {swapErrors[outfit.id] && (
                    <p className="sl-notice" role="alert">
                      {swapErrors[outfit.id]}
                    </p>
                  )}

                  <button
                    type="button"
                    className={`btn ${selected ? 'btn--secondary' : 'btn--primary'}`}
                    aria-pressed={selected}
                    onClick={() => onSelectOutfit(outfit.id)}
                  >
                    {selected ? 'Selected' : 'Choose this one'}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
