import { describe, expect, it } from 'vitest';
import { HttpStatusError, isTransientSaveError, retryDelay } from './saveRetry';

describe('retryDelay', () => {
  it('dubblas från 2 s och stannar vid 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(retryDelay)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

describe('isTransientSaveError', () => {
  it('nätfel och 5xx kan gå över', () => {
    expect(isTransientSaveError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTransientSaveError(new HttpStatusError('Kunde inte spara.', 500))).toBe(true);
    expect(isTransientSaveError(new HttpStatusError('Kunde inte spara.', 503))).toBe(true);
    expect(isTransientSaveError(null)).toBe(true);
  });

  it('svar under 500 går inte över', () => {
    expect(isTransientSaveError(new HttpStatusError('För lång titel.', 400))).toBe(false);
    expect(isTransientSaveError(new HttpStatusError('Finns inte.', 404))).toBe(false);
    expect(isTransientSaveError(Object.assign(new Error('Krock.'), { status: 409 }))).toBe(false);
  });
});
