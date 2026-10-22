import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGarage } from './useGarage';
import { CARS } from '../data/cars';

// The same key useGarage autosaves under (kept from the Garage name so old saves load).
const STORE_KEY = 'garage.v1';

/** A base64 JSON #hash in the exact shape the removed import used to accept. */
function hashOf(state: unknown): string {
  return '#' + btoa(JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Initial load ignores the URL #hash (ported from apartment-shopping, review M2)
// ---------------------------------------------------------------------------
describe('useGarage initial load — a URL #hash never changes the loaded state', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });
  afterEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('a crafted hash cannot plant a sheetUrl, add cars or remove seed cars', () => {
    window.location.hash = hashOf({
      cars: [{ id: 'evil1', year: 2020, make: 'Evil', model: 'Car' }],
      settings: { sheetUrl: 'https://attacker.example/exec', miles: 1, years: 1 },
      removed: [CARS[0].id],
    });
    const { result } = renderHook(() => useGarage());
    expect(result.current.settings.sheetUrl).toBe('');
    expect(result.current.settings.years).toBe(5);
    expect(result.current.cars.map((c) => c.id)).toEqual(CARS.map((c) => c.id));
  });

  it('the mount autosave does not make a hash permanent', () => {
    window.location.hash = hashOf({
      cars: [],
      settings: { sheetUrl: 'https://attacker.example/exec' },
      removed: [CARS[0].id],
    });
    renderHook(() => useGarage());
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    expect(saved.settings.sheetUrl).toBe('');
    expect(saved.removed).toEqual([]);
  });

  it('the saved state still loads, untouched, when a hash is present', () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        cars: [],
        settings: { sheetUrl: 'https://example.com/my-sheet', miles: 10000, years: 3 },
        removed: [CARS[0].id],
      }),
    );
    window.location.hash = hashOf({ cars: [], settings: { sheetUrl: 'https://attacker.example/exec' }, removed: [] });
    const { result } = renderHook(() => useGarage());
    expect(result.current.settings.sheetUrl).toBe('https://example.com/my-sheet');
    expect(result.current.settings.years).toBe(3);
    expect(result.current.cars.some((c) => c.id === CARS[0].id)).toBe(false);
  });
});
