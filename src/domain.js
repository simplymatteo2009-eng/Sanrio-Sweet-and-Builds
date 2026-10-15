export const DEFAULT_PRICE_TEXT = [
  'Plate — $300 BBC per plate',
  'Portion — $150 BBC per plate',
  'QM (Quick Meals) — $175 BBC',
  'Drink — $100 BBC per drink',
  'Seasonal Food & Drinks — Chef’s Own Price',
].join('\n');

export function validateDateRange(startDate, endDate) {
  const isDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  };

  if (!isDate(startDate) || !isDate(endDate)) {
    throw new RangeError('Enter both dates in YYYY-MM-DD format.');
  }
  if (startDate > endDate) {
    throw new RangeError('The end date must be on or after the start date.');
  }

  return {
    startDate,
    endDate,
    expiresAt: Date.parse(`${endDate}T00:00:00.000Z`) + 86_400_000,
  };
}