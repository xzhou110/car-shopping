import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { Car, Settings } from '../types';
import { FEATURES } from '../data/features';
import { carName, featCount, featState, miles, money, safeHref } from '../lib/format';
import { effectiveTco, otd, tcoPerMile, tcoPerYear } from '../lib/derive';
import { getFlags } from '../lib/flags';
import { assetUrl, STATUS_BADGE } from './helpers';
import { IconCar, IconClose, IconExt } from './icons';

interface Props {
  cars: Car[]; // only those in the compare set, in stable order
  settings: Settings;
  onToggleCompare: (id: string) => void;
  onGoToGrid: () => void;
}

/** A row's best/worst highlighting rule. dir picks the best end; colorByValue paints per-cell by value. */
interface RowOpts {
  num?: (c: Car) => number | null;
  dir?: 'min' | 'max';
  colorByValue?: boolean;
  cellClass?: (c: Car) => string;
  label?: string;
}
type Row = [string, (c: Car) => ReactNode, RowOpts];

// ---- cell renderers (ported from titleCell/accidentCell/ratingMini/compareFlagsCell) ----
function titleCell(c: Car): ReactNode {
  if (c.titleStatus === 'Clean') return <b style={{ color: 'var(--good)' }}>Clean</b>;
  if (!c.titleStatus || c.titleStatus === 'Unknown') return <span style={{ color: 'var(--warn)' }}>Unknown</span>;
  return <b style={{ color: 'var(--risk)' }}>{c.titleStatus}</b>;
}
function accidentCell(c: Car): ReactNode {
  if (c.accidents === 0) return <b style={{ color: 'var(--good)' }}>None</b>;
  if (c.accidents != null && c.accidents >= 1) return <b style={{ color: 'var(--risk)' }}>{c.accidents}</b>;
  return <span style={{ color: 'var(--warn)' }}>Unknown</span>;
}
function ratingMini(v: number): ReactNode {
  if (!v) return '—';
  return (
    <>
      {'★'.repeat(v)}
      <span style={{ color: 'var(--line-2)' }}>{'★'.repeat(5 - v)}</span>
    </>
  );
}
function serviceCell(c: Car): ReactNode {
  if (c.serviceCount != null) return <b style={{ color: 'var(--good)' }}>{c.serviceCount} on file</b>;
  if (c.serviceRecords === true) return <b style={{ color: 'var(--good)' }}>Yes</b>;
  if (c.serviceRecords === false) return <b style={{ color: 'var(--risk)' }}>No</b>;
  return '—';
}
function featYn(c: Car, k: (typeof FEATURES)[number][0]): ReactNode {
  const st = featState(c, k);
  if (st === 'yes') return <b style={{ color: 'var(--good)' }}>Yes</b>;
  if (st === 'no') return <span style={{ color: 'var(--ink-3)' }}>No</span>;
  return <span style={{ color: 'var(--warn)' }}>?</span>;
}
function flagsCell(c: Car): ReactNode {
  const f = getFlags(c).filter((x) => x.lvl === 'risk' || x.lvl === 'warn');
  if (!f.length) return <span style={{ color: 'var(--good)' }}>No flags</span>;
  return (
    <div className="cmp-flags-cell">
      {f.map((x, i) => (
        <span key={i} style={{ color: `var(--${x.lvl})`, fontSize: 12 }}>
          • {x.t}
        </span>
      ))}
    </div>
  );
}

function buildRows(settings: Settings): Row[] {
  const featureRows: Row[] = FEATURES.map(([k, , long]) => [
    long,
    (c: Car) => featYn(c, k),
    { cellClass: (c: Car) => (featState(c, k) === 'yes' ? 'best' : '') },
  ]);

  return [
    ['Price', (c) => money(c.price), { num: (c) => c.price, dir: 'min' }],
    ['Mileage', (c) => miles(c.mileage), { num: (c) => c.mileage, dir: 'min' }],
    ['Year', (c) => c.year || '—', { num: (c) => c.year, dir: 'max' }],
    ['Title', (c) => titleCell(c), {}],
    ['Accidents', (c) => accidentCell(c), { num: (c) => c.accidents, dir: 'min', colorByValue: true }],
    ['Owners', (c) => c.ownerCount ?? '—', { num: (c) => c.ownerCount, dir: 'min' }],
    ['Owner type', (c) => c.ownerType || '—', {}],
    ['Seller', (c) => c.sellerType || '—', {}],
    ['Drivetrain', (c) => c.drivetrain || '—', {}],
    ['Fuel type', (c) => c.fuelType || '—', {}],
    ['Engine', (c) => c.engine || '—', {}],
    ['Warranty', (c) => c.warranty || '—', {}],
    ['Service records', (c) => serviceCell(c), {}],
    ['Days on market', (c) => c.daysOnMarket ?? '—', { num: (c) => c.daysOnMarket, dir: 'max', label: 'leverage' }],
    ['Market avg', (c) => money(c.marketAvg), {}],
    ['Transfer fee', (c) => money(c.transferFee), { num: (c) => c.transferFee || 0, dir: 'min' }],
    ['Doc/other fees', (c) => money(c.feesEstimate), { num: (c) => c.feesEstimate || 0, dir: 'min' }],
    ['Out-the-door*', (c) => (otd(c) != null ? money(otd(c)) : '—'), { num: (c) => otd(c), dir: 'min' }],
    [
      `Est. TCO (${settings.years}yr)`,
      (c) => {
        const t = effectiveTco(c, settings);
        return t ? money(t) : <span style={{ color: 'var(--ink-3)' }}>—</span>;
      },
      { num: (c) => effectiveTco(c, settings), dir: 'min', label: 'total cost' },
    ],
    ['TCO / year', (c) => (tcoPerYear(c, settings) ? money(tcoPerYear(c, settings)) : '—'), { num: (c) => tcoPerYear(c, settings), dir: 'min' }],
    ['TCO / mile', (c) => (tcoPerMile(c, settings) ? '$' + tcoPerMile(c, settings) : '—'), { num: (c) => tcoPerMile(c, settings), dir: 'min' }],
    [
      'Key features',
      (c) => (
        <>
          <b className="num">{featCount(c)}</b> <span style={{ color: 'var(--ink-3)' }}>/ {FEATURES.length}</span>
        </>
      ),
      { num: (c) => featCount(c), dir: 'max' },
    ],
    ...featureRows,
    ['Other notable', (c) => (c.features || []).join(', ') || '—', {}],
    ['Expert rating', (c) => ratingMini(c.expertRating), { num: (c) => c.expertRating, dir: 'max' }],
    ['My rating', (c) => ratingMini(c.rating), { num: (c) => c.rating, dir: 'max' }],
    [
      'Status',
      (c) => <span className={`badge ${STATUS_BADGE[c.status] || 'b-neutral'}`}>{c.status || 'New'}</span>,
      {},
    ],
    ['Flags', (c) => flagsCell(c), {}],
    ['Notes', (c) => c.notes || '—', {}],
    [
      'Listing',
      (c) => {
        const href = safeHref(c.sourceUrl);
        return href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            Open <IconExt />
          </a>
        ) : (
          '—'
        );
      },
      {},
    ],
  ];
}

/** Compute best/worst car ids for a numeric row. Ties (all-equal) → no highlight. */
function bestWorst(cars: Car[], opts: RowOpts): { bestId: string | null; worstId: string | null } {
  if (!opts.num || opts.colorByValue) return { bestId: null, worstId: null };
  const vals = cars
    .map((c) => ({ id: c.id, v: opts.num!(c) }))
    .filter((x): x is { id: string; v: number } => x.v != null && !isNaN(x.v));
  if (vals.length < 2) return { bestId: null, worstId: null };
  const sorted = [...vals].sort((a, b) => a.v - b.v);
  if (sorted[0].v === sorted[sorted.length - 1].v) return { bestId: null, worstId: null }; // all tie
  if (opts.dir === 'min') return { bestId: sorted[0].id, worstId: sorted[sorted.length - 1].id };
  return { bestId: sorted[sorted.length - 1].id, worstId: sorted[0].id };
}

function CarThumb({ car }: { car: Car }): ReactElement {
  const [failed, setFailed] = useState(false);
  if (car.image && !failed) {
    return <img className="cmp-thumb" src={assetUrl(car.image)} alt={carName(car)} onError={() => setFailed(true)} />;
  }
  return (
    <div className="cmp-thumb-ph">
      <IconCar />
    </div>
  );
}

export function CompareTable({ cars, settings, onToggleCompare, onGoToGrid }: Props): ReactElement {
  if (cars.length < 2) {
    return (
      <div className="empty">
        <IconCar />
        <h3>Pick cars to compare</h3>
        <p>
          Tick the “Compare” box on at least two cards in Grid view. Best and worst values get highlighted
          automatically.
        </p>
        <button className="btn btn-accent" style={{ margin: '0 auto' }} onClick={onGoToGrid}>
          Go to grid
        </button>
      </div>
    );
  }

  const rows = buildRows(settings);

  return (
    <div className="cmp-wrap">
      <table className="cmp">
        <thead className="cmp-head">
          <tr>
            <th className="cmp-attr">Attribute</th>
            {cars.map((c) => (
              <th key={c.id} className="cmp-carhead">
                <CarThumb car={c} />
                <div className="cmp-carname">{carName(c)}</div>
                <div className="cmp-cartrim">{c.trim || ''}</div>
                <button className="cmp-rm" onClick={() => onToggleCompare(c.id)}>
                  <IconClose />
                  Remove
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, get, opts], ri) => {
            const { bestId, worstId } = bestWorst(cars, opts);
            return (
              <tr key={ri}>
                <td className="cmp-attr">
                  {label}
                  {opts.label ? (
                    <span style={{ fontWeight: 500, textTransform: 'none', color: 'var(--ink-3)' }}>
                      {' '}
                      ({opts.label})
                    </span>
                  ) : null}
                </td>
                {cars.map((c) => {
                  let cls = '';
                  if (opts.cellClass) {
                    cls = opts.cellClass(c) || '';
                  } else if (opts.colorByValue && opts.num) {
                    const v = opts.num(c);
                    if (v === 0) cls = 'best';
                    else if (v != null && v >= 1) cls = 'worst';
                  } else {
                    if (c.id === bestId) cls = 'best';
                    else if (c.id === worstId) cls = 'worst';
                  }
                  const showDot = c.id === bestId && !opts.colorByValue;
                  return (
                    <td key={c.id} className={`${cls} cmp-val`}>
                      {get(c)}
                      {showDot ? <span className="best-dot">{opts.label ? '▲' : 'BEST'}</span> : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
