import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { MissedDemandEvent, Product } from '../../shared/types';
import type { SessionFeatureProps } from '../../shared/featureProps';
import { PRODUCT_COLORS, PRODUCT_FIT, getProduct } from '../../shared/sampleData';
import { formatPrice } from '../../shared/money';
import { fitMap, recommend, sizeDelta, type FitPreference, type Height, type Shopper } from './fitEngine';
import { GARMENT, LAYER_ORDER, garmentDataUri, garmentStyleFor, isWaistAnchored, type GarmentStyle } from './garments';
import { AVATAR_SHAPES, SKIN_TONES, STAGE_H, STAGE_W, drawAvatar, type Anchor, type AvatarShape } from './avatar';
import { coverCanvas, wipeCanvas } from './photoMemory';
import './tryon.css';

const RES = 1.5;
const DEFAULT_PLACEMENT = { cx: 300, shoulderY: 300, shoulderSpan: 240 };

type Mode = 'avatar' | 'photo';

/**
 * Component 3 — Virtual try-on and fit. A clearly labeled MOCK SIMULATION: garments are simple 2D
 * overlays on an avatar or on the shopper's photo. It does not predict real fit.
 * The photo stays in this component's memory only and is wiped on delete, unmount and page hide.
 */
export function VirtualTryOn({ session, extras, onExtrasChange }: SessionFeatureProps) {
  const uid = useId();
  const outfit = session.shortlistedOutfits.find((o) => o.id === session.selectedOutfitId);
  const products = useMemo(
    () => (outfit?.productIds ?? []).map((id) => getProduct(id)).filter((p): p is Product => p !== undefined),
    [outfit],
  );

  const [mode, setMode] = useState<Mode>('avatar');
  const [consent, setConsent] = useState(false);
  const [consentTicked, setConsentTicked] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [avatarShape, setAvatarShape] = useState<AvatarShape>('average');
  const [skin, setSkin] = useState(2);
  const [fitPreference, setFitPreference] = useState<FitPreference>('regular');
  const [height, setHeight] = useState<Height>('regular');
  const [placement, setPlacement] = useState(DEFAULT_PLACEMENT);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [imgTick, setImgTick] = useState(0);

  const photoRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLCanvasElement | null>(null);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const drag = useRef<{ x: number; y: number } | null>(null);

  const usualSize = session.shopperRequest.size ?? products[0]?.availableSizes[0] ?? '';
  const shopper: Shopper = { usualSize, fitPreference, height };

  const recs = useMemo(
    () => products.map((p) => ({ product: p, rec: recommend(p, PRODUCT_FIT[p.id], { usualSize, fitPreference, height }) })),
    [products, usualSize, fitPreference, height],
  );
  const sizes: Record<string, string> = {};
  for (const { product, rec } of recs) sizes[product.id] = chosen[product.id] ?? rec.size;

  // ---- Report chosen sizes and unmet needs to the shell (no photo data, ever) ----
  const sizesKey = JSON.stringify(sizes);
  useEffect(() => {
    const patch: Partial<typeof extras> = {};
    if (JSON.stringify(extras.tryOnSizes) !== sizesKey) patch.tryOnSizes = sizes;
    const events: MissedDemandEvent[] = recs
      .filter(({ rec, product }) => rec.outOfRange && !extras.missedDemand.some((e) => e.source === 'try-on' && e.productId === product.id))
      .map(({ product }) => ({
        at: new Date().toISOString(),
        storeId: session.shopperRequest.storeId,
        productId: product.id,
        size: null,
        reason: 'item-not-carried' as const,
        source: 'try-on' as const,
      }));
    if (events.length) patch.missedDemand = [...extras.missedDemand, ...events];
    if (Object.keys(patch).length) onExtrasChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizesKey, recs, extras.tryOnSizes, extras.missedDemand]);

  // ---- Photo privacy: wipe on unmount and when the page is hidden/closed ----
  useEffect(() => {
    const wipe = () => {
      wipeCanvas(photoRef.current);
      photoRef.current = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };
    window.addEventListener('pagehide', wipe);
    return () => {
      window.removeEventListener('pagehide', wipe);
      wipe();
    };
  }, []);

  function deletePhoto() {
    wipeCanvas(photoRef.current);
    photoRef.current = null;
    setHasPhoto(false);
    setMode('avatar');
    setPlacement(DEFAULT_PLACEMENT);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !consent) return; // never read a file without consent
    setPhotoError(null);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
      const canvas = coverCanvas(img, img.naturalWidth, img.naturalHeight, STAGE_W * RES, STAGE_H * RES);
      img.src = '';
      if (!canvas) {
        setPhotoError("Your browser couldn't prepare that photo. Please use an avatar instead.");
        return;
      }
      wipeCanvas(photoRef.current);
      photoRef.current = canvas;
      setHasPhoto(true);
      setMode('photo');
      setPlacement(DEFAULT_PLACEMENT);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
      setPhotoError("That file couldn't be read as an image. Try another photo or use an avatar.");
    };
    img.src = url;
  }

  // ---- Draw the stage ----
  function garmentImage(style: GarmentStyle, color: string): HTMLImageElement {
    const key = `${style}:${color}`;
    let img = imageCache.current.get(key);
    if (!img) {
      img = new Image();
      img.onload = () => setImgTick((t) => t + 1);
      img.src = garmentDataUri(style, color);
      imageCache.current.set(key, img);
    }
    return img;
  }

  const sizesSig = sizesKey;
  useEffect(() => {
    const canvas = stageRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return; // e.g. non-canvas environments
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);

    let anchor: Anchor;
    if (mode === 'photo' && photoRef.current && photoRef.current.width > 0) {
      ctx.drawImage(photoRef.current, 0, 0, STAGE_W, STAGE_H);
      anchor = { ...placement, waistY: placement.shoulderY + placement.shoulderSpan };
    } else {
      anchor = drawAvatar(ctx, { shape: avatarShape, skin, height });
    }

    const layers = products
      .map((p) => ({ p, style: garmentStyleFor(p.id, p.category) }))
      .sort((a, b) => LAYER_ORDER[a.style] - LAYER_ORDER[b.style]);
    for (const { p, style } of layers) {
      const img = garmentImage(style, PRODUCT_COLORS[p.id] ?? '#888888');
      if (!img.complete || !img.naturalWidth) continue;
      const delta = sizeDelta(p, PRODUCT_FIT[p.id], shopper, sizes[p.id] ?? usualSize);
      const base = anchor.shoulderSpan / GARMENT.shoulderSpan;
      const sx = base * (1 + 0.06 * delta);
      const sy = base * (1 + 0.02 * delta);
      ctx.save();
      if (isWaistAnchored(style)) {
        ctx.translate(anchor.cx, anchor.waistY);
        ctx.scale(sx, sy);
        ctx.drawImage(img, -GARMENT.width / 2, 0);
      } else {
        ctx.translate(anchor.cx, anchor.shoulderY);
        ctx.scale(sx, sy);
        ctx.globalAlpha = 0.96;
        ctx.drawImage(img, -GARMENT.width / 2, -GARMENT.shoulderY);
      }
      ctx.restore();
    }

    // The label is drawn into the pixels so it travels with anything showing this canvas.
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, STAGE_H - 40, STAGE_W, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '600 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MOCK SIMULATION · Not an accurate picture of fit', STAGE_W / 2, STAGE_H - 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hasPhoto, placement, avatarShape, skin, height, fitPreference, products, sizesSig, imgTick]);

  // ---- Photo placement by drag (sliders below are the keyboard/touch alternative) ----
  function stagePoint(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * STAGE_W) / rect.width, y: ((e.clientY - rect.top) * STAGE_H) / rect.height };
  }
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  if (!outfit || products.length === 0) {
    return <p className="mc-muted">Choose an outfit above to preview it.</p>;
  }

  const showConsent = mode === 'photo' && !consent;
  const photoActive = mode === 'photo' && hasPhoto;

  return (
    <div className="tryon">
      <p className="tryon-banner" role="note">
        <span className="mc-sim-badge">Mock simulation</span>
        <span>
          A simple garment overlay, not an AI try-on and not a fit prediction. Fit notes use <strong>sample</strong> product data.
        </span>
      </p>

      <div className="tryon-layout">
        <div className="tryon-stage-col">
          <canvas
            ref={stageRef}
            className={`tryon-stage${photoActive ? ' tryon-stage--drag' : ''}`}
            width={STAGE_W * RES}
            height={STAGE_H * RES}
            role="img"
            aria-label={`Mock simulation: ${products.map((p) => p.name).join(', ')} shown on ${photoActive ? 'your photo' : 'an avatar'}. Not an accurate picture of fit.`}
            onPointerDown={(e) => {
              if (!photoActive) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = stagePoint(e);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const pt = stagePoint(e);
              const prev = drag.current;
              drag.current = pt;
              setPlacement((pl) => ({ ...pl, cx: clamp(pl.cx + pt.x - prev.x, 0, STAGE_W), shoulderY: clamp(pl.shoulderY + pt.y - prev.y, 0, STAGE_H) }));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          />
          <p className="mc-muted">MOCK SIMULATION — not an accurate picture of fit.</p>
        </div>

        <div className="tryon-controls">
          <fieldset className="tryon-fieldset">
            <legend>Show it on</legend>
            <label className="tryon-radio">
              <input type="radio" name={`${uid}-mode`} checked={mode === 'avatar'} onChange={() => setMode('avatar')} />
              An avatar (default)
            </label>
            <label className="tryon-radio">
              <input
                type="radio"
                name={`${uid}-mode`}
                checked={mode === 'photo'}
                onChange={() => {
                  setMode('photo');
                  setConsentTicked(false);
                }}
              />
              My photo (optional)
            </label>
          </fieldset>

          {showConsent && (
            <div className="mc-alert mc-alert--sim tryon-consent" role="group" aria-labelledby={`${uid}-consent-title`}>
              <h3 id={`${uid}-consent-title`}>Before you add a photo</h3>
              <p>
                Your photo stays <strong>on this device only</strong>. It is never uploaded or saved, and it is deleted when you
                delete it, finish, or end the session.
              </p>
              <label className="tryon-radio">
                <input type="checkbox" checked={consentTicked} onChange={(e) => setConsentTicked(e.target.checked)} />I agree to
                use my photo this way
              </label>
              <div className="tryon-row">
                <button type="button" className="mc-btn mc-btn--primary mc-btn--small" disabled={!consentTicked} onClick={() => setConsent(true)}>
                  Continue
                </button>
                <button
                  type="button"
                  className="mc-btn mc-btn--small"
                  onClick={() => {
                    setMode('avatar');
                    setConsentTicked(false);
                  }}
                >
                  Use an avatar instead
                </button>
              </div>
            </div>
          )}

          {mode === 'photo' && consent && (
            <div className="tryon-photo">
              <label htmlFor={`${uid}-file`}>{hasPhoto ? 'Choose a different photo' : 'Choose a photo'}</label>
              <input id={`${uid}-file`} type="file" accept="image/*" onChange={onFile} />
              {photoError && (
                <p className="mc-alert mc-alert--error" role="alert">
                  {photoError}
                </p>
              )}
              {hasPhoto && (
                <>
                  <p className="mc-muted">Held in this page's memory only. Not uploaded, not saved.</p>
                  <div className="tryon-sliders">
                    <label>
                      Move left / right
                      <input type="range" min={0} max={STAGE_W} value={placement.cx} onChange={(e) => setPlacement((p) => ({ ...p, cx: Number(e.target.value) }))} />
                    </label>
                    <label>
                      Move up / down
                      <input type="range" min={0} max={STAGE_H} value={placement.shoulderY} onChange={(e) => setPlacement((p) => ({ ...p, shoulderY: Number(e.target.value) }))} />
                    </label>
                    <label>
                      Garment width
                      <input type="range" min={120} max={420} value={placement.shoulderSpan} onChange={(e) => setPlacement((p) => ({ ...p, shoulderSpan: Number(e.target.value) }))} />
                    </label>
                  </div>
                  <div className="tryon-row">
                    <button type="button" className="mc-btn mc-btn--small" onClick={() => setPlacement(DEFAULT_PLACEMENT)}>
                      Reset position
                    </button>
                    <button type="button" className="mc-btn mc-btn--small" onClick={deletePhoto}>
                      Delete photo now
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {!photoActive && !showConsent && (
            <fieldset className="tryon-fieldset">
              <legend>Avatar</legend>
              <div className="tryon-chips">
                {(Object.keys(AVATAR_SHAPES) as AvatarShape[]).map((s) => (
                  <label key={s} className="tryon-chip">
                    <input type="radio" name={`${uid}-shape`} checked={avatarShape === s} onChange={() => setAvatarShape(s)} />
                    <span>{AVATAR_SHAPES[s].label}</span>
                  </label>
                ))}
              </div>
              <div className="tryon-chips" role="radiogroup" aria-label="Skin tone">
                {SKIN_TONES.map((hex, i) => (
                  <label key={hex} className="tryon-swatch" style={{ background: hex }}>
                    <input type="radio" name={`${uid}-skin`} checked={skin === i} onChange={() => setSkin(i)} aria-label={`Skin tone ${i + 1}`} />
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="tryon-fieldset">
            <legend>Fit preference</legend>
            <div className="tryon-chips">
              {(['fitted', 'regular', 'relaxed'] as FitPreference[]).map((f) => (
                <label key={f} className="tryon-chip">
                  <input type="radio" name={`${uid}-pref`} checked={fitPreference === f} onChange={() => setFitPreference(f)} />
                  <span style={{ textTransform: 'capitalize' }}>{f}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="tryon-fieldset">
            <legend>Height</legend>
            <div className="tryon-chips">
              {([['petite', 'Petite'], ['regular', 'Average'], ['tall', 'Tall']] as Array<[Height, string]>).map(([v, label]) => (
                <label key={v} className="tryon-chip">
                  <input type="radio" name={`${uid}-height`} checked={height === v} onChange={() => setHeight(v)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <h3 className="tryon-subhead">
        Size and fit notes <span className="sample-badge">Sample data</span>
      </h3>
      <ul className="tryon-pieces">
        {recs.map(({ product, rec }) => {
          const size = sizes[product.id];
          const map = fitMap(product, PRODUCT_FIT[product.id], shopper, size);
          const groupName = `${uid}-size-${product.id}`;
          return (
            <li key={product.id} className="mc-card tryon-piece">
              <div className="tryon-piece-head">
                <img src={product.imageUrl} width={48} height={62} alt="" />
                <div>
                  <strong>{product.name}</strong>
                  <div className="mc-muted">{formatPrice(product.price)}</div>
                </div>
              </div>
              <p className="tryon-headline" data-direction={rec.direction}>
                {rec.headline} — we suggest <strong>{rec.size}</strong>
              </p>
              <p>{rec.advice}</p>
              <p className="mc-muted">{product.fitNote}</p>
              {rec.evidence && <p className="mc-muted">{rec.evidence}</p>}
              {rec.notes.map((n) => (
                <p key={n} className="mc-muted">{n}</p>
              ))}
              <p className="mc-muted">Confidence: {rec.confidence} (sample data guidance, not a measurement)</p>
              <fieldset className="tryon-fieldset">
                <legend>Preview size</legend>
                <div className="tryon-chips">
                  {product.availableSizes.map((s) => (
                    <label key={s} className="tryon-chip">
                      <input type="radio" name={groupName} checked={size === s} onChange={() => setChosen((c) => ({ ...c, [product.id]: s }))} />
                      <span>{s}{s === rec.size ? ' ★' : ''}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <ul className="tryon-fitmap" aria-label={`Fit by area in size ${size} (simulated)`}>
                {map.map(({ area, label }) => (
                  <li key={area}>
                    <span>{area}</span>
                    <strong>{label}</strong>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <p className="mc-muted">★ = suggested size. The size you preview here is carried to the stock and price steps.</p>
    </div>
  );
}
