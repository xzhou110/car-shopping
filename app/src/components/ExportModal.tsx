import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Car, Settings } from '../types';
import { sheetMatrix, toCSV, toJSON, toTSV } from '../lib/exportSheet';
import { Modal } from './Modal';
import { IconClose, IconCopy, IconDownload, IconExport, IconInfo } from './icons';

interface Props {
  open: boolean;
  cars: Car[];
  settings: Settings;
  sheetUrl: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

type Fmt = 'tsv' | 'json';

export function ExportModal({ open, cars, settings, sheetUrl, onClose, onToast }: Props): ReactElement {
  const [fmt, setFmt] = useState<Fmt>('tsv');

  const tsv = useMemo(() => toTSV(cars, settings), [cars, settings]);
  const json = useMemo(() => toJSON(cars), [cars]);
  const preview = fmt === 'tsv' ? tsv : json;

  async function copy() {
    const text = fmt === 'json' ? json : tsv;
    const msg =
      fmt === 'json'
        ? 'JSON copied — paste it to me in chat to save'
        : 'Copied — paste into cell A1 of your Google Sheet';
    try {
      await navigator.clipboard.writeText(text);
      onToast(msg);
    } catch {
      onToast('Copied');
    }
  }

  // Direct push to a Google Sheet via the user's Apps Script Web App (no copy-paste).
  // Apps Script can't return CORS headers, so we fire no-cors (the write happens; the response is opaque).
  async function syncSheet() {
    if (!sheetUrl) {
      onToast('Add your Google Sheet URL in Assumptions first');
      return;
    }
    try {
      await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ rows: sheetMatrix(cars, settings) }),
      });
      onToast('Sent — open your sheet to confirm. Empty? Re-deploy the script with access = “Anyone”.');
    } catch {
      onToast('Sync failed — check the URL in Assumptions');
    }
  }

  function downloadCsv() {
    const blob = new Blob([toCSV(cars, settings)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'car-shopping-cars.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast('CSV downloaded — open with Google Sheets');
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="export-title">
      <div className="modal-head">
        <div>
          <div className="modal-title" id="export-title">
            Export to Google Sheets
          </div>
          <div className="modal-sub">Scan your cars in a spreadsheet — or hand the data back to me.</div>
        </div>
        <button className="x" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>
      </div>

      <div className="modal-body">
        <div className="note">
          <IconInfo />
          <span>
            <b>Sync to Google Sheet</b> pushes every car straight into your sheet — title row + one row per car,
            updated in place (set the URL once in <b>Assumptions</b>; see the README for the 5-min setup). No URL
            yet? <b>Copy</b> and paste into cell A1, or <b>Download CSV</b>. <b>JSON</b> is for pasting back to me so
            I can save your in-app edits.
          </span>
        </div>

        <div className="chips" style={{ marginBottom: 11 }}>
          <button className={`chip ${fmt === 'tsv' ? 'on' : ''}`} onClick={() => setFmt('tsv')}>
            Google Sheets (paste)
          </button>
          <button className={`chip ${fmt === 'json' ? 'on' : ''}`} onClick={() => setFmt('json')}>
            JSON (for Claude)
          </button>
        </div>

        <textarea className="export-ta" readOnly value={preview} aria-label="Export preview" />

        <div className="form-foot" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-accent" onClick={syncSheet} disabled={!sheetUrl} title={sheetUrl ? '' : 'Set your Google Sheet URL in Assumptions first'}>
            <IconExport />
            Sync to Google Sheet
          </button>
          <button className="btn btn-ghost btn-ghost-light" onClick={copy}>
            <IconCopy />
            Copy
          </button>
          <button className="btn btn-ghost btn-ghost-light" onClick={downloadCsv}>
            <IconDownload />
            Download CSV
          </button>
        </div>
      </div>
    </Modal>
  );
}
