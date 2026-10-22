import { describe, it, expect } from 'vitest';
import { money, miles, featState, featCount, yn, safeHref } from './format';
import type { Car, FeatureKey } from '../types';

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------
function car(overrides: Partial<Car> = {}): Car {
  return {
    id: 'x',
    status: 'New',
    year: 2022,
    make: 'Toyota',
    model: 'RAV4',
    trim: 'SE',
    price: 30000,
    mileage: 48000,
    sellerType: 'Dealer',
    dealership: '',
    location: '',
    ownerCount: 1,
    accidents: 0,
    titleStatus: 'Clean',
    drivetrain: 'AWD',
    fuelType: 'Hybrid',
    engine: '',
    extColor: '',
    intColor: '',
    vin: 'V',
    warranty: '',
    feat: {},
    features: [],
    serviceRecords: null,
    serviceCount: null,
    daysOnMarket: null,
    dateSeen: '',
    marketAvg: null,
    transferFee: null,
    feesEstimate: null,
    tco5yr: null,
    expertRating: 0,
    rating: 0,
    notes: '',
    image: '',
    sourceUrl: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// money()
// ---------------------------------------------------------------------------
describe('money', () => {
  it('formats a typical price with commas', () => {
    expect(money(35999)).toBe('$35,999');
  });

  it('0 renders as "$0" (not em-dash)', () => {
    expect(money(0)).toBe('$0');
  });

  it('null returns em-dash "—"', () => {
    expect(money(null)).toBe('—');
  });

  it('undefined returns em-dash "—"', () => {
    expect(money(undefined)).toBe('—');
  });

  it('round number with no fractional cents', () => {
    expect(money(1000)).toBe('$1,000');
  });

  it('large price formats correctly', () => {
    expect(money(100000)).toBe('$100,000');
  });

  it('small price under 1000 has no comma', () => {
    expect(money(500)).toBe('$500');
  });
});

// ---------------------------------------------------------------------------
// miles()
// ---------------------------------------------------------------------------
describe('miles', () => {
  it('formats mileage with "mi" suffix and comma', () => {
    expect(miles(48280)).toBe('48,280 mi');
  });

  it('null returns em-dash "—"', () => {
    expect(miles(null)).toBe('—');
  });

  it('undefined returns em-dash "—"', () => {
    expect(miles(undefined)).toBe('—');
  });

  it('0 renders as "0 mi"', () => {
    expect(miles(0)).toBe('0 mi');
  });

  it('small mileage no comma', () => {
    expect(miles(999)).toBe('999 mi');
  });
});

// ---------------------------------------------------------------------------
// featState() — tri-state, must never collapse unknown to 'no'
// ---------------------------------------------------------------------------
describe('featState', () => {
  it("true → 'yes'", () => {
    const c = car({ feat: { moonroof: true } });
    expect(featState(c, 'moonroof')).toBe('yes');
  });

  it("false → 'no'", () => {
    const c = car({ feat: { moonroof: false } });
    expect(featState(c, 'moonroof')).toBe('no');
  });

  it("null → 'unk' (must NOT collapse to 'no')", () => {
    const c = car({ feat: { moonroof: null } });
    expect(featState(c, 'moonroof')).toBe('unk');
  });

  it("absent key → 'unk' (must NOT collapse to 'no')", () => {
    const c = car({ feat: {} });
    expect(featState(c, 'heatedSeats')).toBe('unk');
  });

  it("undefined value in feat → 'unk'", () => {
    const c = car({ feat: { heatedWheel: undefined } });
    expect(featState(c, 'heatedWheel')).toBe('unk');
  });

  it("empty feat object: all 9 keys → 'unk'", () => {
    const c = car({ feat: {} });
    const keys: FeatureKey[] = [
      'moonroof', 'heatedSeats', 'heatedWheel', 'powerSeats',
      'premiumAudio', 'keyless', 'bluetooth', 'powerLiftgate', 'immobilizer',
    ];
    for (const k of keys) {
      expect(featState(c, k)).toBe('unk');
    }
  });

  it("car with no feat object at all → 'unk' (graceful null guard)", () => {
    // The implementation does `(c.feat || {})[k]` which handles undefined feat.
    const c = car({ feat: undefined as never });
    expect(featState(c, 'moonroof')).toBe('unk');
  });
});

// ---------------------------------------------------------------------------
// featState() — panoramic roof ⟹ sunroof/moonroof (one-way feature subsumption)
// ---------------------------------------------------------------------------
describe('featState — panoramic roof implication', () => {
  it("panoramicRoof:true → 'yes' for panoramicRoof", () => {
    expect(featState(car({ feat: { panoramicRoof: true } }), 'panoramicRoof')).toBe('yes');
  });

  it("panoramicRoof:true implies moonroof 'yes' even when moonroof is unset", () => {
    expect(featState(car({ feat: { panoramicRoof: true } }), 'moonroof')).toBe('yes');
  });

  it("panoramicRoof:true overrides an explicit moonroof:false (the stronger feature wins)", () => {
    expect(featState(car({ feat: { panoramicRoof: true, moonroof: false } }), 'moonroof')).toBe('yes');
  });

  it("a plain sunroof does NOT imply a panoramic roof (one-way)", () => {
    expect(featState(car({ feat: { moonroof: true } }), 'panoramicRoof')).toBe('unk');
  });

  it("panoramicRoof:false → 'no', and leaves moonroof untouched", () => {
    const c = car({ feat: { panoramicRoof: false, moonroof: true } });
    expect(featState(c, 'panoramicRoof')).toBe('no');
    expect(featState(c, 'moonroof')).toBe('yes');
  });

  it('a panoramic car counts BOTH roof features in featCount', () => {
    // panoramic present (moonroof unset) → moonroof implied yes → 2 toward the count.
    expect(featCount(car({ feat: { panoramicRoof: true } }))).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// featCount() — counts only 'yes', not 'unk' or 'no'
// ---------------------------------------------------------------------------
describe('featCount', () => {
  it('counts 0 when all features are unknown/absent', () => {
    expect(featCount(car({ feat: {} }))).toBe(0);
  });

  it('counts only true (yes) features', () => {
    const c = car({
      feat: {
        moonroof: true,
        heatedSeats: true,
        heatedWheel: false,
        powerSeats: null,
        premiumAudio: true,
      },
    });
    expect(featCount(c)).toBe(3);
  });

  it('does not count false features', () => {
    const c = car({
      feat: {
        moonroof: false,
        heatedSeats: false,
        bluetooth: false,
      },
    });
    expect(featCount(c)).toBe(0);
  });

  it('does not count null features (unk stays distinct from yes)', () => {
    const c = car({
      feat: {
        moonroof: null,
        heatedSeats: null,
        heatedWheel: null,
      },
    });
    expect(featCount(c)).toBe(0);
  });

  it('counts all 9 when all are true', () => {
    const c = car({
      feat: {
        moonroof: true,
        heatedSeats: true,
        heatedWheel: true,
        powerSeats: true,
        premiumAudio: true,
        keyless: true,
        bluetooth: true,
        powerLiftgate: true,
        immobilizer: true,
      },
    });
    expect(featCount(c)).toBe(9);
  });

  it('mixed tri-state: true=3, false=3, null=3 → count = 3', () => {
    const c = car({
      feat: {
        moonroof: true,
        heatedSeats: true,
        heatedWheel: true,
        powerSeats: false,
        premiumAudio: false,
        keyless: false,
        bluetooth: null,
        powerLiftgate: null,
        immobilizer: null,
      },
    });
    expect(featCount(c)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// yn() — export/spreadsheet cell rendering
// ---------------------------------------------------------------------------
describe('yn', () => {
  it("'yes' → 'Yes'", () => {
    expect(yn('yes')).toBe('Yes');
  });

  it("'no' → 'No'", () => {
    expect(yn('no')).toBe('No');
  });

  it("'unk' → '?'", () => {
    expect(yn('unk')).toBe('?');
  });
});

// ---------------------------------------------------------------------------
// safeHref() — XSS guard for listing links (ported from apartment-shopping, review M1)
// ---------------------------------------------------------------------------
describe('safeHref — only http(s) pass (XSS guard)', () => {
  it('passes https', () => expect(safeHref('https://x.com/a')).toBe('https://x.com/a'));
  it('passes http', () => expect(safeHref('http://x.com')).toBe('http://x.com'));
  it('blocks mailto (a listing link is never an email)', () => expect(safeHref('mailto:a@b.com')).toBeUndefined());
  it('blocks javascript:', () => expect(safeHref('javascript:alert(1)')).toBeUndefined());
  it('blocks javascript: in mixed case with leading space', () => expect(safeHref('  JavaScript:alert(1)')).toBeUndefined());
  it('blocks data: html', () => expect(safeHref('data:text/html,<script>')).toBeUndefined());
  it('blocks relative/garbage', () => expect(safeHref('/foo')).toBeUndefined());
  it('trims then validates', () => expect(safeHref('  https://x.com  ')).toBe('https://x.com'));
  it('null/empty → undefined', () => {
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref('')).toBeUndefined();
  });
});
