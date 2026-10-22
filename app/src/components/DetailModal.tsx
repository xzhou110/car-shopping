import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';
import type { Car } from '../types';
import { FEATURES } from '../data/features';
import { carName, featState, miles, money, safeHref } from '../lib/format';
import { effectiveTco, isTcoEstimated, milesPerYr, otd, tcoBreakdown, tcoPerMile, tcoPerYear } from '../lib/derive';
import { GARAGE_TCO_NOTE, type ByCategory, type CategoryKey } from '../lib/tco';
import { getFlags } from '../lib/flags';
import type { Settings } from '../types';
import { Modal } from './Modal';
import { RatingStars } from './RatingStars';
import { assetUrl, flagIcon } from './helpers';
import { IconCar, IconClose, IconExt } from './icons';

interface Props {
  car: Car | null;
  settings: Settings;
  inCompare: boolean;
  onClose: () => void;
  onToggleCompare: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkSold: (id: string) => void;
  onSetExpert: (id: string, n: number) => void;
  onSetYou: (id: string, n: number) => void;
}

/** Cost components shown in the estimated-TCO breakdown, in display order. */
const TCO_CATS: [CategoryKey, string][] = [
  ['depreciation', 'Depreciation'],
  ['energy', 'Fuel'],
  ['insurance', 'Insurance'],
  ['maintenance', 'Maintenance'],
  ['repairs', 'Repairs'],
  ['financingInterest', 'Financing'],
  ['taxesAndFees', 'Taxes & fees'],
];

/** Compact list of the estimated TCO's cost components (skips zero/near-zero rows). */
function TcoBreakdown({ b, years }: { b: ByCategory; years: number }): ReactElement {
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
        Estimated {years}-yr cost breakdown
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {TCO_CATS.filter(([k]) => (b[k] || 0) >= 1).map(([k, label]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--ink-2)' }}>{label}</span>
            <span className="num" style={{ color: 'var(--ink)' }}>${Math.round(b[k]).toLocaleString('en-US')}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 9, lineHeight: 1.45 }}>{GARAGE_TCO_NOTE}</div>
    </div>
  );
}

/** Renders a labelled field only when the value is meaningful (mirrors the prototype's field() helper). */
function Field({ label, children }: { label: string; children: ReactNode }): ReactElement | null {
  if (children == null || children === '') return null;
  return (
    <div className="dfield">
      <span className="dfield-l">{label}</span>
      <span className="dfield-v">{children}</span>
    </div>
  );
}

function DetailImage({ car }: { car: Car }): ReactElement {
  const [failed, setFailed] = useState(false);
  if (car.image && !failed) {
    return <img className="det-img" src={assetUrl(car.image)} alt={carName(car)} onError={() => setFailed(true)} />;
  }
  return (
    <div className="det-img-ph">
      <IconCar />
      <span>{carName(car)}</span>
    </div>
  );
}

function titleNode(c: Car): ReactNode {
  if (c.titleStatus === 'Clean') return <b style={{ color: 'var(--good)' }}>Clean</b>;
  if (!c.titleStatus || c.titleStatus === 'Unknown') return <span style={{ color: 'var(--warn)' }}>Unknown</span>;
  return <b style={{ color: 'var(--risk)' }}>{c.titleStatus}</b>;
}
function accidentNode(c: Car): ReactNode {
  if (c.accidents === 0) return <b style={{ color: 'var(--good)' }}>None</b>;
  if (c.accidents != null && c.accidents >= 1) return <b style={{ color: 'var(--risk)' }}>{c.accidents}</b>;
  return <span style={{ color: 'var(--warn)' }}>Unknown</span>;
}
function serviceNode(c: Car): ReactNode {
  if (c.serviceCount != null) return <b style={{ color: 'var(--good)' }}>{c.serviceCount} on file</b>;
  if (c.serviceRecords === true) return <b style={{ color: 'var(--good)' }}>Available</b>;
  if (c.serviceRecords === false) return <b style={{ color: 'var(--risk)' }}>None</b>;
  return '';
}

export function DetailModal({
  car,
  settings,
  inCompare,
  onClose,
  onToggleCompare,
  onEdit,
  onDelete,
  onMarkSold,
  onSetExpert,
  onSetYou,
}: Props): ReactElement {
  const open = !!car;
  const mpy = car ? milesPerYr(car) : null;
  const otdVal = car ? otd(car) : null;
  const tco = car ? effectiveTco(car, settings) : null;
  const tcoEstimated = car ? isTcoEstimated(car) : true;
  const breakdown = car && tcoEstimated ? tcoBreakdown(car, settings) : null;
  const tpy = car ? tcoPerYear(car, settings) : null;
  const tpm = car ? tcoPerMile(car, settings) : null;
  const flags = car ? getFlags(car) : [];

  return (
    <Modal open={open} onClose={onClose} wide labelledBy="detail-title">
      {car && (
        <>
          <div className="modal-head">
            <div>
              <div className="modal-title" id="detail-title">
                {carName(car)}
              </div>
              <div className="modal-sub">
                {car.trim || ''}
                {car.status && car.status !== 'New' ? (
                  <>
                    {' '}
                    · <span style={{ color: 'var(--accent)' }}>{car.status}</span>
                  </>
                ) : null}
              </div>
            </div>
            <button className="x" onClick={onClose} aria-label="Close">
              <IconClose />
            </button>
          </div>

          <div className="modal-body">
            <DetailImage car={car} />

            <section className="det-section">
              <h4>Price &amp; value</h4>
              <div className="det-grid">
                <Field label="Asking price">
                  <b className="num" style={{ fontSize: 18 }}>
                    {money(car.price)}
                  </b>
                </Field>
                <Field label="Mileage">
                  <span className="num">
                    {miles(car.mileage)}{' '}
                    {mpy ? (
                      <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>· ~{mpy.toLocaleString()}/yr</span>
                    ) : null}
                  </span>
                </Field>
                <Field label="Market avg">{car.marketAvg != null ? money(car.marketAvg) : ''}</Field>
                <Field label="Transfer fee">{car.transferFee != null ? money(car.transferFee) : ''}</Field>
                <Field label="Doc/other fees">{car.feesEstimate != null ? money(car.feesEstimate) : ''}</Field>
                <Field label="Est. out-the-door*">
                  {otdVal != null ? <b className="num">{money(otdVal)}</b> : ''}
                </Field>
                <Field label={`Est. TCO (${settings.years}yr)`}>
                  {tco ? (
                    <>
                      <b className="num">{money(tco)}</b>{' '}
                      <span style={{ color: 'var(--ink-3)', fontWeight: 500, fontSize: 12 }}>
                        {tcoEstimated ? 'estimated' : 'entered'}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--ink-3)' }}>—</span>
                  )}
                </Field>
                <Field label="TCO / year">{tpy ? money(tpy) : ''}</Field>
                <Field label="TCO / mile">{tpm ? '$' + tpm : ''}</Field>
              </div>
              {breakdown && <TcoBreakdown b={breakdown} years={settings.years} />}
            </section>

            <section className="det-section">
              <h4>Ratings</h4>
              <div className="ratings">
                <RatingStars label="Expert" value={car.expertRating} variant="r-exp" onSet={(n) => onSetExpert(car.id, n)} />
                <RatingStars label="You" value={car.rating} variant="r-you" onSet={(n) => onSetYou(car.id, n)} />
              </div>
            </section>

            <section className="det-section">
              <h4>History &amp; title</h4>
              <div className="det-grid">
                <Field label="Title status">{titleNode(car)}</Field>
                <Field label="Accidents">{accidentNode(car)}</Field>
                <Field label="Prior owners">{car.ownerCount}</Field>
                <Field label="Owner type">{car.ownerType}</Field>
                <Field label="Service records">{serviceNode(car)}</Field>
                <Field label="Warranty">{car.warranty}</Field>
                <Field label="Days on market">{car.daysOnMarket}</Field>
                <Field label="VIN">
                  {car.vin ? (
                    <span className="num" style={{ fontSize: 12.5 }}>
                      {car.vin}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--warn)' }}>missing</span>
                  )}
                </Field>
              </div>
            </section>

            <section className="det-section">
              <h4>Specs</h4>
              <div className="det-grid">
                <Field label="Drivetrain">{car.drivetrain}</Field>
                <Field label="Fuel type">{car.fuelType}</Field>
                <Field label="Engine">{car.engine}</Field>
                <Field label="Exterior">{car.extColor}</Field>
                <Field label="Interior">{car.intColor}</Field>
                <Field label="Seller">{car.sellerType}</Field>
                <Field label="Dealer">{car.dealership}</Field>
                <Field label="Location">{car.location}</Field>
              </div>
            </section>

            <section className="det-section">
              <h4>Key features</h4>
              <div className="det-feats">
                {FEATURES.map(([k, , long]) => {
                  const st = featState(car, k);
                  const mark = st === 'yes' ? '✓' : st === 'no' ? '✕' : '?';
                  return (
                    <div key={k} className={`dfeat dfeat-${st}`}>
                      <span className="dfeat-m">{mark}</span>
                      {long}
                    </div>
                  );
                })}
              </div>
              {(car.features || []).length > 0 && (
                <div className="feat-tags" style={{ marginTop: 11 }}>
                  {car.features.map((f, i) => (
                    <span key={i} className="ftag">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="det-section">
              <h4>Risk &amp; value flags</h4>
              {flags.length ? (
                flags.map((f, i) => (
                  <div key={i} className={`flag f-${f.lvl}`} style={{ marginBottom: 6 }}>
                    {flagIcon(f.lvl)}
                    <span>{f.t}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--good)', fontSize: 13 }}>No flags raised.</div>
              )}
            </section>

            {car.notes && (
              <section className="det-section">
                <h4>Notes</h4>
                <div className="det-notes">{car.notes}</div>
              </section>
            )}

            <div className="det-actions">
              {safeHref(car.sourceUrl) && (
                <a className="btn btn-accent" href={safeHref(car.sourceUrl)} target="_blank" rel="noopener noreferrer">
                  Open listing <IconExt />
                </a>
              )}
              <button className="btn-mini" onClick={() => onEdit(car.id)}>
                Edit
              </button>
              <label className="btn-mini" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={inCompare}
                  onChange={() => onToggleCompare(car.id)}
                  style={{ marginRight: 6, accentColor: 'var(--accent)' }}
                />
                Compare
              </label>
              {car.status !== 'Sold' && (
                <button className="btn-mini" onClick={() => onMarkSold(car.id)}>
                  Mark as sold
                </button>
              )}
              <button className="btn-mini" onClick={() => onDelete(car.id)} style={{ color: 'var(--risk)' }}>
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
