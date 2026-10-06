import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Car, FeatureKey, Settings, Status } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { CARS } from '../data/cars';

export type View = 'grid' | 'compare';
export type SortKey =
  | 'added'
  | 'price-asc'
  | 'price-desc'
  | 'otd-asc'
  | 'miles-asc'
  | 'year-desc'
  | 'feat-desc'
  | 'tco-asc'
  | 'expert-desc'
  | 'you-desc'
  | 'dom-desc';

export type SellerFilter = 'all' | 'Dealer' | 'CPO' | 'Private';

export interface Filters {
  search: string;
  sort: SortKey;
  seller: SellerFilter;
  cleanOnly: boolean;
  noAccident: boolean;
  hideRejected: boolean;
  showSold: boolean;
  maxPrice: number | null;
  maxMileage: number | null;
  minExpert: number;
  minYou: number;
  reqFeatures: FeatureKey[];
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  sort: 'year-desc',
  seller: 'all',
  cleanOnly: false,
  noAccident: false,
  hideRejected: false,
  showSold: false,
  maxPrice: null,
  maxMileage: null,
  minExpert: 0,
  minYou: 0,
  reqFeatures: [],
};

// Keep the original keys across the Car Shopping rename so existing browser saves still load.
const STORE_KEY = 'garage.v1';
const THEME_KEY = 'garage.theme';

/**
 * A complete default Car used as the hydrate-merge base: every saved/shared car is
 * spread OVER this so older saves that lack newly added fields can never crash a render.
 */
const DEFAULT_CAR: Car = {
  id: '',
  status: 'New',
  year: 0,
  make: '',
  model: '',
  trim: '',
  price: 0,
  mileage: 0,
  sellerType: 'Dealer',
  dealership: '',
  location: '',
  ownerCount: null,
  accidents: null,
  titleStatus: 'Unknown',
  drivetrain: 'FWD',
  fuelType: 'Gas',
  engine: '',
  extColor: '',
  intColor: '',
  vin: '',
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
};

/** Spread a saved/shared partial car over the full default so missing fields are filled, never undefined. */
function hydrateCar(saved: Partial<Car>): Car {
  return {
    ...DEFAULT_CAR,
    ...saved,
    feat: { ...(saved.feat || {}) },
    features: Array.isArray(saved.features) ? [...saved.features] : [],
  };
}

interface PersistShape {
  cars: Car[];
  settings: Settings;
  removed: string[]; // ids the user deleted (so deleted seed cars don't reappear from the seed)
}

interface RawPersist {
  cars: Partial<Car>[];
  settings: Settings;
  removed: string[];
}

/**
 * The seed (data/cars.ts) is authoritative for the CAR SET + DATA — so cars I add or update there
 * (from your screenshots) always show up. localStorage only overlays YOUR in-app state (rating + status,
 * incl. "Sold"), keeps cars you added in-app, and remembers deletions. Net: my data edits flow through,
 * your ratings/statuses stick. (Editing a seed car's other fields in the form isn't persisted — tell me
 * and I'll update the data file, which is the source of truth.)
 */
function mergeWithSeed(saved: Partial<Car>[], removed: string[]): Car[] {
  const removedSet = new Set(removed);
  const savedById = new Map(saved.filter((c) => c.id).map((c) => [c.id as string, c]));
  const seedIds = new Set(CARS.map((c) => c.id));
  const out: Car[] = [];
  for (const seed of CARS) {
    if (removedSet.has(seed.id)) continue;
    const base = hydrateCar(seed);
    const s = savedById.get(seed.id);
    out.push(s ? { ...base, rating: s.rating ?? base.rating, status: s.status ?? base.status } : base);
  }
  for (const s of saved) {
    if (s.id && !seedIds.has(s.id) && !removedSet.has(s.id)) out.push(hydrateCar(s));
  }
  return out;
}

function parsePersist(raw: string | null): RawPersist | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { cars?: Partial<Car>[]; settings?: Partial<Settings>; removed?: string[] };
    if (!data || !Array.isArray(data.cars)) return null;
    return {
      cars: data.cars,
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
      removed: Array.isArray(data.removed) ? data.removed : [],
    };
  } catch {
    return null;
  }
}

/** Hash wins over localStorage (explicit share); both are overlaid on the authoritative seed. */
function loadInitial(): PersistShape {
  let fromHash: RawPersist | null = null;
  const h = location.hash.replace(/^#/, '');
  if (h) {
    try {
      fromHash = parsePersist(decodeURIComponent(escape(atob(h))));
    } catch {
      fromHash = null;
    }
  }
  const persisted = fromHash || parsePersist(localStorage.getItem(STORE_KEY));
  const removed = persisted?.removed ?? [];
  return {
    cars: mergeWithSeed(persisted?.cars ?? [], removed),
    settings: persisted?.settings ?? { ...DEFAULT_SETTINGS },
    removed,
  };
}

function initialTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch {
    /* ignore */
  }
  return 'light';
}

export function useGarage() {
  const initial = useRef<PersistShape>(loadInitial());
  const [cars, setCars] = useState<Car[]>(initial.current.cars);
  const [settings, setSettingsState] = useState<Settings>(initial.current.settings);
  const [removed, setRemoved] = useState<string[]>(initial.current.removed);
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const [compareSet, setCompareSet] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<View>('grid');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => initialTheme());

  // Autosave cars + settings under garage.v1 (filters/compare/view are session-only, per prototype).
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ cars, settings, removed }));
    } catch {
      /* quota / private mode — non-fatal */
    }
  }, [cars, settings, removed]);

  // Keep <html data-theme> + persisted theme in sync.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // ---- car CRUD ----
  const addCar = useCallback((car: Car) => {
    setCars((prev) => [car, ...prev]);
  }, []);

  const updateCar = useCallback((id: string, patch: Partial<Car>) => {
    setCars((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const deleteCar = useCallback((id: string) => {
    setCars((prev) => prev.filter((c) => c.id !== id));
    setRemoved((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setCompareSet((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const setRating = useCallback((id: string, which: 'expert' | 'you', n: number) => {
    const key = which === 'expert' ? 'expertRating' : 'rating';
    setCars((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: n } : c)));
  }, []);

  const setStatus = useCallback((id: string, status: Status) => {
    setCars((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }, []);

  // ---- compare ----
  const toggleCompare = useCallback((id: string) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearCompare = useCallback(() => setCompareSet(new Set()), []);

  // ---- settings / filters ----
  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setFilters = useCallback((patch: Partial<Filters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    // Clears only the panel fields (price/mileage/ratings/required features), mirroring the prototype's
    // "Clear all filters" — search, sort and quick chips stay put.
    setFiltersState((prev) => ({
      ...prev,
      maxPrice: null,
      maxMileage: null,
      minExpert: 0,
      minYou: 0,
      reqFeatures: [],
    }));
  }, []);

  const toggleReqFeature = useCallback((k: FeatureKey) => {
    setFiltersState((prev) => {
      const has = prev.reqFeatures.includes(k);
      return {
        ...prev,
        reqFeatures: has ? prev.reqFeatures.filter((x) => x !== k) : [...prev.reqFeatures, k],
      };
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  // Number of active *panel* filters (drives the badge), matching the prototype's activeFilterCount.
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.maxPrice != null) n++;
    if (filters.maxMileage != null) n++;
    if (filters.minExpert) n++;
    if (filters.minYou) n++;
    n += filters.reqFeatures.length;
    return n;
  }, [filters]);

  return {
    cars,
    settings,
    filters,
    compareSet,
    view,
    theme,
    activeFilterCount,
    // actions
    addCar,
    updateCar,
    deleteCar,
    setRating,
    setStatus,
    toggleCompare,
    clearCompare,
    setSettings,
    setFilters,
    resetFilters,
    toggleReqFeature,
    setView,
    toggleTheme,
  };
}

export type Garage = ReturnType<typeof useGarage>;
