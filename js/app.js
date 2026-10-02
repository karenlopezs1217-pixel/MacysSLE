/*
 * Fit Studio kiosk app: screen flow, consent gate, capture, try-on stage and
 * session erasure. The photo only ever lives in an in-memory canvas.
 */
(function () {
  'use strict';

  const { PRODUCTS, GARMENT, garmentDataUri } = window.Catalog;
  const { SKIN_TONES, SHAPES, drawAvatar } = window.Avatar;
  const FitEngine = window.FitEngine;

  const STAGE_W = 600;
  const STAGE_H = 800;
  const STAGE_RES = 1.5;
  const IDLE_MS = 60 * 1000;
  const IDLE_WARNING_S = 15;
  const ERASED_RETURN_MS = 8000;
  const DEFAULT_PHOTO_PLACEMENT = { cx: 300, shoulderY: 300, shoulderSpan: 240 };

  const STEP_OF = { item: 1, fit: 2, mode: 3, consent: 3, capture: 3, avatar: 3, result: 4 };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function freshState() {
    return {
      screen: 'attract',
      product: null,
      colorIdx: 0,
      shopper: { usualSize: null, fitPreference: 'regular', height: 'regular' },
      mode: null,
      consent: false,
      photo: null,
      avatar: { shape: 'average', skin: 2 },
      placement: null,
      chosenSize: null,
      rec: null,
    };
  }

  let state = freshState();
  let stream = null;
  let countdownTimer = null;
  const garmentCache = new Map();

  /* ---------- Screens ---------- */

  function show(name) {
    if (state.screen === 'capture' && name !== 'capture') stopCamera();
    state.screen = name;
    $$('.screen').forEach((el) => { el.hidden = el.dataset.screen !== name; });

    const step = STEP_OF[name];
    const progress = $('#progress');
    progress.hidden = !step;
    progress.querySelectorAll('li').forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle('done', n < step);
      li.classList.toggle('current', n === step);
    });
    $('#end-session').hidden = name === 'attract' || name === 'erased';

    if (name === 'fit') renderFitQuestions();
    if (name === 'avatar') renderAvatarBuilder();
    if (name === 'capture') resetCaptureUi();
    if (name === 'result') renderResult();
    if (name === 'erased') scheduleReturnToAttract();

    const heading = document.querySelector(`[data-screen="${name}"] [tabindex="-1"]`);
    if (heading) heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    resetIdle();
  }

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go && !go.disabled) show(go.dataset.go);
  });

  /* ---------- Chips helper ---------- */

  function renderChips(container, options, selected, onPick) {
    container.innerHTML = '';
    options.forEach((opt) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(opt.value === selected));
      b.innerHTML = opt.sub ? `${opt.label}<small>${opt.sub}</small>` : opt.label;
      if (opt.disabled) b.classList.add('chip-muted');
      b.addEventListener('click', () => onPick(opt.value));
      container.appendChild(b);
    });
  }

  /* ---------- 1. Item ---------- */

  function renderProducts() {
    const grid = $('#product-grid');
    grid.innerHTML = '';
    PRODUCTS.forEach((p) => {
      const card = document.createElement('button');
      card.className = 'product-card';
      card.type = 'button';
      const img = document.createElement('img');
      img.src = garmentDataUri(p, p.colors[0].hex);
      img.alt = '';
      const info = document.createElement('div');
      info.className = 'product-info';
      info.innerHTML = `<span class="eyebrow"></span><strong></strong><span class="price"></span>`;
      info.children[0].textContent = p.brand;
      info.children[1].textContent = p.name;
      info.children[2].textContent = `$${p.price.toFixed(2)}`;
      card.append(img, info);
      card.addEventListener('click', () => pickProduct(p));
      grid.appendChild(card);
    });
  }

  function pickProduct(p) {
    state.product = p;
    state.colorIdx = 0;
    state.chosenSize = null;
    // A returning shopper (via "Try another item") already answered the fit questions.
    show(state.shopper.usualSize && state.mode ? nextAfterFit() : 'fit');
  }

  /* ---------- 2. Fit questions ---------- */

  function renderFitQuestions() {
    const s = state.shopper;
    renderChips($('[data-field="usualSize"]'),
      FitEngine.SIZE_ORDER.map((v) => ({ value: v, label: v })),
      s.usualSize, (v) => { s.usualSize = v; renderFitQuestions(); });
    renderChips($('[data-field="fitPreference"]'), [
      { value: 'fitted', label: 'Fitted' },
      { value: 'regular', label: 'Regular' },
      { value: 'relaxed', label: 'Relaxed' },
    ], s.fitPreference, (v) => { s.fitPreference = v; renderFitQuestions(); });
    renderChips($('[data-field="height"]'), [
      { value: 'petite', label: 'Petite', sub: 'under 5′4″' },
      { value: 'regular', label: 'Average', sub: '5′4″–5′8″' },
      { value: 'tall', label: 'Tall', sub: 'over 5′8″' },
    ], s.height, (v) => { s.height = v; renderFitQuestions(); });
    $('#fit-continue').disabled = !s.usualSize;
  }

  function nextAfterFit() {
    if (state.mode === 'photo' && state.photo) return 'result';
    if (state.mode === 'avatar') return 'result';
    return 'mode';
  }

  /* ---------- 3. Mode + consent ---------- */

  $('#choose-photo').addEventListener('click', () => {
    state.mode = 'photo';
    show(state.consent ? 'capture' : 'consent');
  });
  $('#choose-avatar').addEventListener('click', () => {
    state.mode = 'avatar';
    show('avatar');
  });

  const consentBox = $('#consent-box');
  consentBox.addEventListener('change', () => {
    $('#consent-accept').disabled = !consentBox.checked;
  });
  $('#consent-accept').addEventListener('click', () => {
    if (!consentBox.checked) return;
    state.consent = true;
    show('capture');
  });
  $('#consent-decline').addEventListener('click', () => {
    consentBox.checked = false;
    state.consent = false;
    state.mode = 'avatar';
    show('avatar');
  });

  /* ---------- 3b. Capture ---------- */

  const video = $('#camera');
  const fileInput = $('#photo-file');

  function resetCaptureUi() {
    $('#camera-idle').hidden = false;
    $('#camera-msg').textContent = '';
    $('#countdown').textContent = '';
    $('#snap').disabled = true;
  }

  function requireConsent() {
    if (state.consent) return true;
    show('consent');
    return false;
  }

  $('#start-camera').addEventListener('click', async () => {
    if (!requireConsent()) return;
    const msg = $('#camera-msg');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      msg.textContent = 'Camera isn’t available here. Upload a photo or use an avatar instead.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (state.screen !== 'capture') { stopCamera(); return; }
      video.srcObject = stream;
      $('#camera-idle').hidden = true;
      $('#snap').disabled = false;
    } catch (err) {
      msg.textContent = 'We couldn’t turn on the camera. Upload a photo or use an avatar instead.';
    }
  });

  $('#snap').addEventListener('click', () => {
    if (!requireConsent() || !stream) return;
    $('#snap').disabled = true;
    let n = 3;
    const cd = $('#countdown');
    cd.textContent = n;
    countdownTimer = setInterval(() => {
      n -= 1;
      if (n > 0) { cd.textContent = n; return; }
      clearInterval(countdownTimer);
      countdownTimer = null;
      cd.textContent = '';
      captureFrame();
    }, 1000);
  });

  function captureFrame() {
    if (!video.videoWidth) return;
    // Mirror so the shopper sees themselves as in the live preview.
    const frame = coverCanvas(video, video.videoWidth, video.videoHeight, true);
    stopCamera();
    acceptPhoto(frame);
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file || !requireConsent()) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      acceptPhoto(coverCanvas(img, img.naturalWidth, img.naturalHeight, false));
      img.src = '';
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      $('#camera-msg').textContent = 'That file couldn’t be read. Try another photo.';
    };
    img.src = url;
  });

  // Crop-to-fill into an in-memory canvas at stage resolution.
  function coverCanvas(source, sw, sh, mirror) {
    const c = document.createElement('canvas');
    c.width = STAGE_W * STAGE_RES;
    c.height = STAGE_H * STAGE_RES;
    const ctx = c.getContext('2d');
    const scale = Math.max(c.width / sw, c.height / sh);
    const w = sw * scale;
    const h = sh * scale;
    if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, (c.width - w) / 2, (c.height - h) / 2, w, h);
    return c;
  }

  function acceptPhoto(canvas) {
    wipePhoto();
    state.photo = canvas;
    state.mode = 'photo';
    state.placement = { ...DEFAULT_PHOTO_PLACEMENT };
    show('result');
  }

  function stopCamera() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  /* ---------- 3c. Avatar ---------- */

  function renderAvatarBuilder() {
    const a = state.avatar;
    renderChips($('[data-field="shape"]'),
      Object.entries(SHAPES).map(([value, s]) => ({ value, label: s.label })),
      a.shape, (v) => { a.shape = v; renderAvatarBuilder(); });

    const sw = $('#skin-swatches');
    sw.innerHTML = '';
    SKIN_TONES.forEach((hex, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(i === a.skin));
      b.setAttribute('aria-label', `Skin tone ${i + 1}`);
      b.style.background = hex;
      b.addEventListener('click', () => { a.skin = i; renderAvatarBuilder(); });
      sw.appendChild(b);
    });

    const c = $('#avatar-preview');
    const ctx = c.getContext('2d');
    ctx.setTransform(c.width / STAGE_W, 0, 0, c.height / STAGE_H, 0, 0);
    drawAvatar(ctx, { ...a, height: state.shopper.height });
  }

  $('#avatar-done').addEventListener('click', () => {
    state.mode = 'avatar';
    show('result');
  });

  /* ---------- 4. Result ---------- */

  const stage = $('#stage');
  stage.width = STAGE_W * STAGE_RES;
  stage.height = STAGE_H * STAGE_RES;
  const sctx = stage.getContext('2d');

  function garmentImage(product, hex) {
    const key = `${product.id}:${hex}`;
    if (!garmentCache.has(key)) {
      const img = new Image();
      img.onload = () => { if (state.screen === 'result') drawStage(); };
      img.src = garmentDataUri(product, hex);
      garmentCache.set(key, img);
    }
    return garmentCache.get(key);
  }

  function drawStage() {
    const p = state.product;
    if (!p) return;
    sctx.setTransform(STAGE_RES, 0, 0, STAGE_RES, 0, 0);
    sctx.clearRect(0, 0, STAGE_W, STAGE_H);

    let anchor;
    if (state.mode === 'photo' && state.photo) {
      sctx.drawImage(state.photo, 0, 0, STAGE_W, STAGE_H);
      anchor = state.placement;
    } else {
      anchor = drawAvatar(sctx, { ...state.avatar, height: state.shopper.height });
    }

    const img = garmentImage(p, p.colors[state.colorIdx].hex);
    if (img.complete && img.naturalWidth) {
      // Bigger sizes read wider (and slightly longer) than the matched size.
      const delta = FitEngine.sizeDelta(p, state.shopper, state.chosenSize);
      const base = anchor.shoulderSpan / GARMENT.shoulderSpan;
      const sx = base * (1 + 0.06 * delta);
      const sy = base * (1 + 0.02 * delta);
      sctx.save();
      sctx.translate(anchor.cx, anchor.shoulderY);
      sctx.scale(sx, sy);
      sctx.globalAlpha = 0.96;
      sctx.drawImage(img, -GARMENT.width / 2, -GARMENT.shoulderY);
      sctx.restore();
    }

    // The simulation label is drawn into the image itself, not only the page,
    // so it is present on anything that shows this canvas.
    sctx.fillStyle = 'rgba(0,0,0,0.6)';
    sctx.fillRect(0, STAGE_H - 40, STAGE_W, 40);
    sctx.fillStyle = '#fff';
    sctx.font = '600 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText('SIMULATION · Not an exact representation of fit', STAGE_W / 2, STAGE_H - 20);
  }

  function renderResult() {
    const p = state.product;
    const s = state.shopper;
    state.rec = FitEngine.recommend(p, s);
    if (!state.chosenSize) state.chosenSize = state.rec.size;
    if (state.mode === 'photo' && !state.placement) state.placement = { ...DEFAULT_PHOTO_PLACEMENT };

    $('#r-brand').textContent = p.brand;
    $('#r-name').textContent = `${p.name} · $${p.price.toFixed(2)}`;

    const colors = $('#r-colors');
    colors.innerHTML = '';
    p.colors.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(i === state.colorIdx));
      b.setAttribute('aria-label', c.name);
      b.title = c.name;
      b.style.background = c.hex;
      b.addEventListener('click', () => { state.colorIdx = i; renderResult(); });
      colors.appendChild(b);
    });

    const r = state.rec;
    $('#r-size').textContent = r.size;
    $('#r-headline').textContent = r.headline;
    $('#r-headline').dataset.direction = r.direction;
    $('#r-advice').textContent = r.advice;
    $('#r-evidence').textContent = r.evidence || '';
    const notes = $('#r-notes');
    notes.innerHTML = '';
    r.notes.forEach((n) => {
      const li = document.createElement('li');
      li.textContent = n;
      notes.appendChild(li);
    });
    $('#r-confidence').textContent = `Confidence: ${r.confidence}`;
    $('#r-confidence').dataset.level = r.confidence;

    renderChips($('#r-sizes'), p.sizes.map((size) => {
      const n = p.stock[size] || 0;
      return {
        value: size,
        label: size,
        sub: n ? `${n} on floor` : 'Online only',
        disabled: !n,
      };
    }), state.chosenSize, (v) => { state.chosenSize = v; renderResult(); });

    $('#r-chosen').textContent = state.chosenSize === r.size
      ? `${state.chosenSize} (recommended)` : state.chosenSize;
    const map = $('#r-fitmap');
    map.innerHTML = '';
    FitEngine.fitMap(p, s, state.chosenSize).forEach(({ area, label }) => {
      const li = document.createElement('li');
      li.innerHTML = '<span></span><strong></strong>';
      li.children[0].textContent = area;
      li.children[1].textContent = label;
      li.dataset.fit = label.toLowerCase().replace(/\s+/g, '-');
      map.appendChild(li);
    });

    const inStock = (p.stock[state.chosenSize] || 0) > 0;
    const send = $('#send-fitting');
    send.textContent = inStock
      ? `Send ${state.chosenSize} to a fitting room` : `Order ${state.chosenSize} for free pickup`;

    const isPhoto = state.mode === 'photo' && state.photo;
    $('#stage-tools').hidden = !isPhoto;
    $('#p-photo').textContent = isPhoto
      ? 'Held in this kiosk’s memory only' : 'None — you’re using an avatar';
    if (isPhoto) $('#shoulder-range').value = state.placement.shoulderSpan;

    drawStage();
  }

  $('#send-fitting').addEventListener('click', () => {
    const p = state.product;
    const size = state.chosenSize;
    const color = p.colors[state.colorIdx].name;
    if ((p.stock[size] || 0) > 0) {
      toast(`Request sent. A stylist will bring ${p.name} in ${color}, size ${size}, to Fitting Room 3.`);
    } else {
      toast(`Size ${size} in ${color} will be ready for pickup at Customer Service tomorrow.`);
    }
  });

  $('#try-another').addEventListener('click', () => {
    state.chosenSize = null;
    show('item');
  });

  /* ---------- Photo placement: drag, pinch, slider ---------- */

  const pointers = new Map();
  let pinchStart = null;

  function toStage(e) {
    const rect = stage.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * STAGE_W) / rect.width,
      y: ((e.clientY - rect.top) * STAGE_H) / rect.height,
    };
  }

  function pinchDistance() {
    const [a, b] = Array.from(pointers.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  stage.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'photo' || !state.photo) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, toStage(e));
    if (pointers.size === 2) pinchStart = { dist: pinchDistance(), span: state.placement.shoulderSpan };
  });

  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const pt = toStage(e);
    pointers.set(e.pointerId, pt);
    const pl = state.placement;
    if (pointers.size === 1) {
      pl.cx = clamp(pl.cx + pt.x - prev.x, 0, STAGE_W);
      pl.shoulderY = clamp(pl.shoulderY + pt.y - prev.y, 0, STAGE_H);
    } else if (pointers.size === 2 && pinchStart) {
      pl.shoulderSpan = clamp(pinchStart.span * (pinchDistance() / pinchStart.dist), 120, 420);
      $('#shoulder-range').value = pl.shoulderSpan;
    }
    drawStage();
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  $('#shoulder-range').addEventListener('input', (e) => {
    if (!state.placement) return;
    state.placement.shoulderSpan = Number(e.target.value);
    drawStage();
  });

  $('#reset-placement').addEventListener('click', () => {
    state.placement = { ...DEFAULT_PHOTO_PLACEMENT };
    $('#shoulder-range').value = state.placement.shoulderSpan;
    drawStage();
  });

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  /* ---------- Session erasure ---------- */

  function wipePhoto() {
    if (!state.photo) return;
    const ctx = state.photo.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, state.photo.width, state.photo.height);
    state.photo.width = 0;
    state.photo.height = 0;
    state.photo = null;
  }

  function eraseSession() {
    const hadPhoto = Boolean(state.photo);
    stopCamera();
    wipePhoto();
    fileInput.value = '';
    consentBox.checked = false;
    $('#consent-accept').disabled = true;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, stage.width, stage.height);
    pointers.clear();
    pinchStart = null;
    hideIdleWarning();
    state = freshState();
    return hadPhoto;
  }

  function endSession(reason) {
    const hadPhoto = eraseSession();
    $('#erased-title').textContent = reason === 'idle'
      ? 'Session erased for your privacy' : 'All done — your session is erased';
    $('#erased-detail').textContent = hadPhoto
      ? 'Your photo has been permanently erased from this kiosk. Nothing was saved or uploaded.'
      : 'Nothing was saved on this kiosk.';
    show('erased');
  }

  $('#end-session').addEventListener('click', () => endSession('done'));

  // If the page is closed or hidden mid-session, erase immediately.
  window.addEventListener('pagehide', eraseSession);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen !== 'attract') endSession('idle');
  });

  let returnTimer = null;
  function scheduleReturnToAttract() {
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => { if (state.screen === 'erased') show('attract'); }, ERASED_RETURN_MS);
  }

  /* ---------- Idle timeout ---------- */

  let idleTimer = null;
  let warnTimer = null;

  function resetIdle() {
    clearTimeout(idleTimer);
    if (state.screen === 'attract' || state.screen === 'erased') return;
    if (!$('#idle-modal').hidden) return;
    idleTimer = setTimeout(showIdleWarning, IDLE_MS);
  }

  function showIdleWarning() {
    let left = IDLE_WARNING_S;
    $('#idle-seconds').textContent = left;
    $('#idle-modal').hidden = false;
    $('#idle-stay').focus();
    warnTimer = setInterval(() => {
      left -= 1;
      $('#idle-seconds').textContent = left;
      if (left <= 0) endSession('idle');
    }, 1000);
  }

  function hideIdleWarning() {
    clearInterval(warnTimer);
    clearTimeout(idleTimer);
    warnTimer = null;
    $('#idle-modal').hidden = true;
  }

  $('#idle-stay').addEventListener('click', () => { hideIdleWarning(); resetIdle(); });
  ['pointerdown', 'keydown', 'input'].forEach((evt) => {
    document.addEventListener(evt, () => { if ($('#idle-modal').hidden) resetIdle(); }, { passive: true });
  });

  /* ---------- Toast ---------- */

  let toastTimer = null;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
  }

  // Test hook for timing-dependent checks; harmless in production.
  window.__fitStudio = { getState: () => state, endSession, showIdleWarning };

  renderProducts();
  show('attract');
})();
