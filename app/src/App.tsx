import { useCallback, useMemo, useRef, useState } from 'react';
import type { Car } from './types';
import { useGarage } from './state/useGarage';
import { applyFilters, applySort } from './components/helpers';
import { Filters } from './components/Filters';
import { Grid } from './components/Grid';
import { CompareTable } from './components/CompareTable';
import { DetailModal } from './components/DetailModal';
import { CarForm } from './components/CarForm';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { ThemeToggle } from './components/ThemeToggle';
import { IconBrand, IconCompare, IconExport, IconGrid, IconPlus, IconSettings } from './components/icons';

export default function App() {
  const g = useGarage();
  const [detailId, setDetailId] = useState<string | null>(null);
  // undefined = closed, null = add mode, Car = edit mode
  const [formCar, setFormCar] = useState<Car | null | undefined>(undefined);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const visible = useMemo(
    () => applySort(applyFilters(g.cars, g.filters), g.filters.sort, g.settings),
    [g.cars, g.filters, g.settings],
  );
  const compareCars = useMemo(
    () => g.cars.filter((c) => g.compareSet.has(c.id)),
    [g.cars, g.compareSet],
  );
  const detailCar = detailId ? g.cars.find((c) => c.id === detailId) ?? null : null;

  const handleSaveCar = useCallback(
    (saved: Car) => {
      const isEdit = g.cars.some((c) => c.id === saved.id);
      if (isEdit) g.updateCar(saved.id, saved);
      else g.addCar(saved);
      setFormCar(undefined);
      showToast(isEdit ? 'Car updated' : 'Car added');
    },
    [g, showToast],
  );

  const handleEdit = useCallback(
    (id: string) => {
      const c = g.cars.find((x) => x.id === id);
      if (!c) return;
      setDetailId(null);
      setFormCar(c);
    },
    [g.cars],
  );

  const handleDelete = useCallback(
    (id: string) => {
      g.deleteCar(id);
      setDetailId(null);
      showToast('Car removed');
    },
    [g, showToast],
  );

  const handleMarkSold = useCallback(
    (id: string) => {
      g.setStatus(id, 'Sold');
      setDetailId(null);
      showToast('Marked sold — hidden from the list ("Show sold" brings it back)');
    },
    [g, showToast],
  );

  return (
    <>
      <header className="cowl">
        <div className="cowl-inner">
          <div className="brand">
            <div className="brand-mark">
              <IconBrand />
            </div>
            <div className="brand-text">
              <span className="brand-name">Car Shopping</span>
              <span className="brand-sub">Car shortlist &amp; compare</span>
            </div>
          </div>

          <div className="stats">
            <div className="stat">
              <span className="stat-v num">{g.cars.length}</span>
              <span className="stat-l">Cars</span>
            </div>
            <div className="stat">
              <span className="stat-v num">{g.compareSet.size}</span>
              <span className="stat-l">Comparing</span>
            </div>
          </div>

          <div className="cowl-actions">
            <div className="seg" role="tablist" aria-label="View">
              <button
                className={g.view === 'grid' ? 'on' : ''}
                onClick={() => g.setView('grid')}
                role="tab"
                aria-selected={g.view === 'grid'}
              >
                <IconGrid />
                Grid
              </button>
              <button
                className={g.view === 'compare' ? 'on' : ''}
                onClick={() => g.setView('compare')}
                role="tab"
                aria-selected={g.view === 'compare'}
              >
                <IconCompare />
                Compare
              </button>
            </div>
            <ThemeToggle theme={g.theme} onToggle={g.toggleTheme} />
            <button className="btn btn-ghost" onClick={() => setExportOpen(true)}>
              <IconExport />
              Export
            </button>
            <button className="btn btn-ghost" onClick={() => setSettingsOpen(true)}>
              <IconSettings />
              Assumptions
            </button>
            <button className="btn btn-accent" onClick={() => setFormCar(null)}>
              <IconPlus />
              Add car
            </button>
          </div>
        </div>
      </header>

      <Filters
        filters={g.filters}
        activeFilterCount={g.activeFilterCount}
        shownCount={visible.length}
        totalCount={g.cars.length}
        compareCount={g.compareSet.size}
        view={g.view}
        setFilters={g.setFilters}
        resetFilters={g.resetFilters}
        toggleReqFeature={g.toggleReqFeature}
        onClearCompare={g.clearCompare}
      />

      <main>
        {g.view === 'compare' ? (
          compareCars.length >= 2 ? (
            <CompareTable
              cars={compareCars}
              settings={g.settings}
              onToggleCompare={g.toggleCompare}
              onGoToGrid={() => g.setView('grid')}
            />
          ) : (
            <div className="empty">
              <p>Tick at least two cars in the grid, then come back here to compare them side by side.</p>
              <button className="btn-mini" onClick={() => g.setView('grid')}>
                Back to grid
              </button>
            </div>
          )
        ) : (
          <Grid
            cars={visible}
            totalCount={g.cars.length}
            settings={g.settings}
            compareSet={g.compareSet}
            onToggleCompare={g.toggleCompare}
            onOpen={(id) => setDetailId(id)}
            onSetYou={(id, n) => g.setRating(id, 'you', n)}
          />
        )}
      </main>

      <DetailModal
        car={detailCar}
        settings={g.settings}
        inCompare={detailCar ? g.compareSet.has(detailCar.id) : false}
        onClose={() => setDetailId(null)}
        onToggleCompare={g.toggleCompare}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onMarkSold={handleMarkSold}
        onSetExpert={(id, n) => g.setRating(id, 'expert', n)}
        onSetYou={(id, n) => g.setRating(id, 'you', n)}
      />

      <CarForm car={formCar} onClose={() => setFormCar(undefined)} onSave={handleSaveCar} />

      <ExportModal
        open={exportOpen}
        cars={g.cars}
        settings={g.settings}
        sheetUrl={g.settings.sheetUrl ?? ''}
        onClose={() => setExportOpen(false)}
        onToast={showToast}
      />

      <SettingsModal
        open={settingsOpen}
        settings={g.settings}
        onClose={() => setSettingsOpen(false)}
        onSave={g.setSettings}
        onToast={showToast}
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
