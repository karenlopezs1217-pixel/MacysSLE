'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const FitEngine = require('../js/fit-engine.js');

global.self = global;
require('../js/catalog.js');
const { PRODUCTS } = global.Catalog;
const byId = (id) => PRODUCTS.find((p) => p.id === id);

const shopper = (over) => ({ usualSize: 'S', fitPreference: 'regular', height: 'regular', ...over });

test('runs-small item tells the shopper to size up', () => {
  const r = FitEngine.recommend(byId('wrap-dress'), shopper());
  assert.equal(r.size, 'M');
  assert.equal(r.headline, 'Runs small — size up');
  assert.equal(r.advice, 'We suggest M instead of your usual S.');
  assert.equal(r.evidence, '68% of 1,240 reviewers say it runs small.');
  assert.equal(r.confidence, 'high');
});

test('runs-large item tells the shopper to size down', () => {
  const r = FitEngine.recommend(byId('puffer'), shopper({ usualSize: 'M' }));
  assert.equal(r.size, 'S');
  assert.equal(r.headline, 'Runs large — size down');
});

test('true-to-size item keeps the usual size', () => {
  const r = FitEngine.recommend(byId('crew-sweater'), shopper({ usualSize: 'L' }));
  assert.equal(r.size, 'L');
  assert.equal(r.headline, 'True to size');
  assert.equal(r.advice, 'Stick with your usual L.');
});

test('few reviews lowers confidence', () => {
  const r = FitEngine.recommend(byId('blazer'), shopper());
  assert.equal(r.confidence, 'medium');
  const none = FitEngine.recommend({ ...byId('blazer'), reviews: { runsSmall: 1, trueToSize: 2, runsLarge: 0 } }, shopper());
  assert.equal(none.confidence, 'low');
});

test('relaxed preference on a slim cut sizes up again', () => {
  const r = FitEngine.recommend(byId('wrap-dress'), shopper({ fitPreference: 'relaxed' }));
  assert.equal(r.size, 'L');
  assert.match(r.notes.join(' '), /relaxed fit/);
});

test('fitted preference on a relaxed cut sizes down', () => {
  const r = FitEngine.recommend(byId('puffer'), shopper({ usualSize: 'L', fitPreference: 'fitted' }));
  assert.equal(r.size, 'S');
});

test('recommendation is clamped to the size run and flagged', () => {
  const r = FitEngine.recommend(byId('wrap-dress'), shopper({ usualSize: 'XL' }));
  assert.equal(r.size, 'XL');
  assert.match(r.notes.join(' '), /outside this style/);
});

test('usual size missing from the run snaps to the nearest size', () => {
  const r = FitEngine.recommend(byId('blazer'), shopper({ usualSize: 'XXL' }));
  assert.equal(r.size, 'XL');
  assert.match(r.notes.join(' '), /doesn’t come in XXL/);
});

test('length note for petite shoppers on length-sensitive items', () => {
  const r = FitEngine.recommend(byId('wrap-dress'), shopper({ height: 'petite' }));
  assert.match(r.notes.join(' '), /run long/);
  const sweater = FitEngine.recommend(byId('crew-sweater'), shopper({ height: 'petite' }));
  assert.equal(sweater.notes.length, 0);
});

test('fit map reads tighter below and roomier above the recommended size', () => {
  const p = byId('crew-sweater');
  const s = shopper({ usualSize: 'M' });
  const label = (size, area) => FitEngine.fitMap(p, s, size).find((a) => a.area === area).label;
  assert.equal(label('M', 'Chest'), 'Just right');
  assert.equal(label('S', 'Chest'), 'Tight');
  assert.equal(label('XL', 'Chest'), 'Roomy');
  assert.equal(label('M', 'Length'), 'Just right');
});

test('size delta is zero at the body-matched size', () => {
  const p = byId('wrap-dress');
  const s = shopper();
  assert.equal(FitEngine.sizeDelta(p, s, 'M'), 0);
  assert.equal(FitEngine.sizeDelta(p, s, 'S'), -1);
});
