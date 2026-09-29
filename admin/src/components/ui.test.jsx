import { describe, expect, it } from 'vitest';
import { formatPrice } from './ui.jsx';

describe('formatPrice', () => {
  it('formats a numeric string as US dollars', () => {
    expect(formatPrice('8.25')).toBe('$8.25');
  });

  it('keeps two decimal places for whole numbers', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('treats null and undefined as zero rather than NaN', () => {
    expect(formatPrice(null)).toBe('$0.00');
    expect(formatPrice(undefined)).toBe('$0.00');
  });

  it('falls back to zero for a value that is not a number', () => {
    expect(formatPrice('')).toBe('$0.00');
  });

  it('preserves decimal precision coming from the API as a string', () => {
    expect(formatPrice('4200.10')).toBe('$4,200.10');
  });
});
