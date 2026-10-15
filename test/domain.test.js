import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRICE_TEXT, validateDateRange } from '../src/domain.js';
import { getPrices, setPrices } from '../src/storage.js';

test('default menu contains the requested chef order prices', () => {
  assert.match(DEFAULT_PRICE_TEXT, /Plate — \$300 BBC per plate/);
  assert.match(DEFAULT_PRICE_TEXT, /Portion — \$150 BBC per plate/);
  assert.match(DEFAULT_PRICE_TEXT, /QM \(Quick Meals\) — \$175 BBC/);
  assert.match(DEFAULT_PRICE_TEXT, /Drink — \$100 BBC per drink/);
  assert.match(DEFAULT_PRICE_TEXT, /Seasonal Food & Drinks — Chef’s Own Price/);
  assert.equal(getPrices(), DEFAULT_PRICE_TEXT);
});

test('date range accepts real ISO dates and expires after the end date', () => {
  const range = validateDateRange('2026-10-20', '2026-10-27');
  assert.equal(range.expiresAt, Date.parse('2026-10-28T00:00:00.000Z'));
});

test('date range rejects impossible dates and reversed ranges', () => {
  assert.throws(() => validateDateRange('2026-02-30', '2026-03-01'), RangeError);
  assert.throws(() => validateDateRange('2026-10-28', '2026-10-27'), RangeError);
});

test('price updates are persisted for future menu reads', () => {
  const original = getPrices();
  try {
    setPrices('Test menu\nNew price');
    assert.equal(getPrices(), 'Test menu\nNew price');
  } finally {
    setPrices(original);
  }
});