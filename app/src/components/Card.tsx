import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Car, OwnerType, Settings } from '../types';
import { FEATURES } from '../data/features';
import { carName, featCount, featState, miles, money, safeHref } from '../lib/format';
import { effectiveTco, isTcoEstimated, otd, totalFees } from '../lib/derive';
import { getFlags, signalLevel } from '../lib/flags';
import { assetUrl, flagIcon } from './helpers';
import { RatingStars } from './RatingStars';
import { IconCar, IconCheck, IconDrive, IconExt, IconFuel, IconPin, IconWarn } from './icons';

interface Props {
  car: Car;
  settings: Settings;
  inCompare: boolean;
  onToggleCompare: (id: string) => void;
  onOpen: (id: string) => void;
  onSetYou: (id: string, n: number) => void;
}

function ImageBlock({ car }: { car: Car }): ReactElement {
  const [failed, setFailed] = useState(false);
  if (car.image && !failed) {
    return (
      <img
        className="card-img"
        src={assetUrl(car.image)}
        alt={carName(car)}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="ph">
      <IconCar />
      <span className="ph-txt">{carName(car) || 'No image'}</span>
    </div>
  );
}

function TitleBadge({ car }: { car: Car }): ReactElement | null {
  if (!car.titleStatus) return null;
  if (car.titleStatus === 'Clean')
    return (
      <span className="badge b-good">
        <IconCheck />
        Clean title
      </span>
    );
  if (car.titleStatus === 'Unknown') return <span className="badge b-warn">Title: ?</span>;
  return (
    <span className="badge b-risk">
      <IconWarn />
      {car.titleStatus} title
    </span>
  );
}

function AccidentBadge({ car }: { car: Car }): ReactElement {
  if (car.accidents === 0)
    return (
      <span className="badge b-good">
        <IconCheck />
        No accidents
      </span>
    );
  if (car.accidents != null && car.accidents >= 1)
    return (
      <span className="badge b-risk">
        <IconWarn />
        {car.accidents} accident{car.accidents > 1 ? 's' : ''}
      </span>
    );
  return <span className="badge b-warn">Accidents: ?</span>;
}

function SellerBadge({ car }: { car: Car }): ReactElement | null {
  if (!car.sellerType) return null;
  const cls = car.sellerType === 'CPO' ? 'b-good' : car.sellerType === 'Private' ? 'b-info' : 'b-neutral';
  return <span className={`badge ${cls}`}>{car.sellerType}</span>;
}

/**
 * Prior-use / owner-type tag. Every OwnerType renders a badge (incl. Personal), so the
 * card always states how the car was used. Tone follows risk: personal = reassuring (good),
 * lease/government = informational, rental-fleet/commercial/unknown = caution (warn).
 */
const OWNER_BADGE: Record<OwnerType, { label: string; cls: string; tone: 'good' | 'warn' | 'plain' }> = {
  Personal: { label: 'Personal use', cls: 'b-good', tone: 'good' },
  Lease: { label: 'Lease return', cls: 'b-info', tone: 'plain' },
  'Rental/Fleet': { label: 'Rental / fleet', cls: 'b-warn', tone: 'warn' },
  Commercial: { label: 'Commercial use', cls: 'b-warn', tone: 'warn' },
  Government: { label: 'Government', cls: 'b-info', tone: 'plain' },
  Unknown: { label: 'Use: unknown', cls: 'b-warn', tone: 'warn' },
};

function OwnerBadge({ car }: { car: Car }): ReactElement | null {
  if (!car.ownerType) return null;
  const o = OWNER_BADGE[car.ownerType];
  if (!o) return null;
  return (
    <span className={`badge ${o.cls}`}>
      {o.tone === 'good' && <IconCheck />}
      {o.tone === 'warn' && <IconWarn />}
      {o.label}
    </span>
  );
}

export function Card({ car, settings, inCompare, onToggleCompare, onOpen, onSetYou }: Props): ReactElement {
  const sig = signalLevel(car);
  const flags = getFlags(car).slice(0, 3);
  const fees = totalFees(car);
  const otdVal = otd(car);
  const tco = effectiveTco(car, settings);
  const tcoEstimated = isTcoEstimated(car);
  const loc = [car.dealership, car.location].filter(Boolean).join(' · ');

  return (
    <article
      className={`card ${sig ? 'signal-' + sig : ''} ${car.status === 'Rejected' ? 'is-rejected' : ''}`}
      onClick={() => onOpen(car.id)}
      role="button"
      tabIndex={0}
      aria-label={`${carName(car)} — open details`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(car.id);
        }
      }}
    >
      <div className="card-imgwrap">
        <ImageBlock car={car} />
        <span className="card-id" title="Car ID (matches the data file & image)">{car.id}</span>
        {car.status && car.status !== 'New' && <span className="status-tag">{car.status}</span>}
        <div className="card-cmp" onClick={(e) => e.stopPropagation()}>
          <label className="cmp-box">
            <input
              type="checkbox"
              checked={inCompare}
              onChange={() => onToggleCompare(car.id)}
              aria-label={`Compare ${carName(car)}`}
            />
            Compare
          </label>
        </div>
      </div>

      <div className="card-body">
        <div className="card-head">
          <div>
            <div className="card-title">{carName(car)}</div>
            {car.trim && <div className="card-trim">{car.trim}</div>}
          </div>
          <span className="card-miles num">{miles(car.mileage)}</span>
        </div>

        <div className="price-row">
          <span className="price num">{money(car.price)}</span>
          {car.marketAvg ? <span className="price-sub num">vs {money(car.marketAvg)} mkt</span> : null}
        </div>

        {car.transferFee || fees ? (
          <div className="price-extra num">
            {car.transferFee ? <span>+ {money(car.transferFee)} transfer</span> : null}
            {otdVal != null ? <span className="otd">≈ {money(otdVal)} out-the-door*</span> : null}
          </div>
        ) : null}

        {tco != null && (
          <div className="card-tco" title={tcoEstimated ? 'Estimated total cost of ownership over your horizon (Assumptions)' : 'Total cost of ownership you entered'}>
            <span className="card-tco-l">
              {tcoEstimated ? 'Est. ' : ''}
              {settings.years}-yr cost to own
            </span>
            <span className="card-tco-v num">{money(tco)}</span>
          </div>
        )}

        {/* Dealer · location — directly below the price / out-the-door */}
        {loc && (
          <div className="loc">
            <IconPin />
            {loc}
          </div>
        )}

        {(car.drivetrain || car.fuelType || car.engine) && (
          <div className="spec-row">
            {car.drivetrain && (
              <span className="spec">
                <IconDrive />
                <b>{car.drivetrain}</b>
              </span>
            )}
            {car.fuelType && (
              <span className="spec">
                <IconFuel />
                <b>{car.fuelType}</b>
              </span>
            )}
            {car.engine && (
              <span className="spec">
                <IconExt />
                <b>{car.engine}</b>
              </span>
            )}
          </div>
        )}

        <div className="badges">
          <TitleBadge car={car} />
          <AccidentBadge car={car} />
          <SellerBadge car={car} />
          <OwnerBadge car={car} />
        </div>

        <div className="kf-block">
          <div className="kf-head">
            Key features <span className="kf-score num">{featCount(car)}/{FEATURES.length}</span>
          </div>
          <div className="kf-tags">
            {FEATURES.map(([k, short]) => {
              const st = featState(car, k);
              const mark = st === 'yes' ? '✓' : st === 'no' ? '✕' : '?';
              return (
                <span key={k} className={`kf kf-${st}`}>
                  <b>{mark}</b>
                  {short}
                </span>
              );
            })}
          </div>
        </div>

        {flags.length > 0 && (
          <div className="flags">
            {flags.map((f, i) => (
              <div key={i} className={`flag f-${f.lvl}`}>
                {flagIcon(f.lvl)}
                <span>{f.t}</span>
              </div>
            ))}
          </div>
        )}

        <div className="card-foot" onClick={(e) => e.stopPropagation()}>
          <div className="ratings">
            <RatingStars label="Expert" value={car.expertRating} variant="r-exp" />
            <RatingStars label="You" value={car.rating} variant="r-you" onSet={(n) => onSetYou(car.id, n)} />
          </div>
          {safeHref(car.sourceUrl) ? (
            <a
              className="listing-link"
              href={safeHref(car.sourceUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              View listing <IconExt />
            </a>
          ) : (
            <span className="listing-link disabled">No link</span>
          )}
        </div>
      </div>
    </article>
  );
}
