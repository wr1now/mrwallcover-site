import { useRef, useState } from 'react';
import type { PortalCloud } from './cloud';
import type { HistoricalScope } from '../../server/designer-portal/learning';

export interface PrivateHistoryFieldsProps { cloud: PortalCloud; run: (work: () => Promise<void>) => Promise<void>; busy: boolean; onMessage: (message: string) => void }
type HistoryRecord = { id: string; body: HistoricalScope; createdAt: string };
const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value / 100);
const readable = (value: string) => value.replaceAll('-', ' ');
const classifications = ['selling-quotation', 'worker-cost', 'unpriced-schedule', 'mixed-schedule'];
const roles = ['selling', 'worker-cost', 'subtotal', 'total', 'alternative', 'unpriced', 'duplicate-total'];
function object(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object in the prepared history file.`); return value as Record<string, unknown>; }
function plain(value: unknown, label: string, max = 4000): string { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must contain bounded text in the prepared history file.`); return value; }
function list(value: unknown, label: string, max: number): unknown[] { if (!Array.isArray(value) || value.length > max) throw new Error(`${label} exceeds the supported history preview format.`); return value; }
/** Preview validation controls rendering only. The private API independently validates every imported field. */
function previewFile(value: unknown): HistoricalScope[] {
  const values = Array.isArray(value) ? value : object(value, 'History file').entries;
  const entries = list(values, 'History entries', 50);
  if (!entries.length) throw new Error('The prepared history file contains no entries.');
  for (const [index, raw] of entries.entries()) {
    const row = object(raw, `Entry ${index + 1}`), source = object(row.source, 'Source');
    plain(row.externalRef, 'External reference', 100); plain(row.title, 'Scope title', 200); plain(row.scopeNotes, 'Scope notes'); plain(row.quantityBasis, 'Quantity basis', 200);
    if (!classifications.includes(String(row.classification))) throw new Error('Classify each source as a selling quotation, worker cost, unpriced schedule or mixed schedule.');
    const filename = plain(source.fileName, 'Source file name', 240); if (/[\\/]/.test(filename)) throw new Error('Use source file names without original computer or iCloud paths.');
    if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('Each source needs its verified SHA-256.');
    plain(source.reviewedOn, 'Source review date', 10);
    const locations = list(source.locations, 'Source locations', 100); if (!locations.length) throw new Error('Each source needs a page or cell/range citation.');
    for (const rawLocation of locations) { const location = object(rawLocation, 'Source location'); if (location.page === undefined && !location.range) throw new Error('Each citation needs a page or cell/range.'); if (location.page !== undefined && (!Number.isSafeInteger(location.page) || Number(location.page) < 1)) throw new Error('Source page numbers start at one.'); for (const key of ['sheet', 'range', 'note']) if (location[key] !== undefined) plain(location[key], `Source ${key}`, key === 'note' ? 500 : 120); }
    for (const rawAmount of list(row.amounts, 'Historical amount records', 500)) {
      const amount = object(rawAmount, 'Historical amount'); plain(amount.label, 'Amount description', 200);
      if (!roles.includes(String(amount.role))) throw new Error('Every historical amount needs its selling, worker-cost, total, duplicate or unpriced role.');
      if (amount.valuePence !== null && (!Number.isSafeInteger(amount.valuePence) || Number(amount.valuePence) < 0)) throw new Error('Historical amounts use whole pence; unpriced amounts remain null.');
      if (!Number.isSafeInteger(amount.locationIndex) || Number(amount.locationIndex) < 0 || Number(amount.locationIndex) >= locations.length) throw new Error('Each historical amount must cite an existing source location.');
      if (amount.role === 'unpriced' && amount.valuePence !== null) throw new Error('An unpriced schedule entry must remain null.');
      if (amount.alternativeGroup !== undefined || amount.role === 'alternative') plain(amount.alternativeGroup, 'Alternative group', 100);
      if (row.classification === 'worker-cost' && amount.role === 'selling') throw new Error('Worker-cost records cannot become selling prices.');
      if (row.classification === 'unpriced-schedule' && amount.role !== 'unpriced') throw new Error('An unpriced schedule cannot contain populated price roles.');
    }
    for (const warning of list(row.warnings, 'Review warnings', 50)) plain(warning, 'Review warning', 500);
  }
  return entries as unknown as HistoricalScope[];
}
function HistoryDetails({ value }: { value: HistoricalScope }) {
  return <div><p><strong>{readable(value.classification)}</strong> · {value.externalRef}</p><p>{value.scopeNotes}</p><p>Quantity basis: {value.quantityBasis}</p><p>Source: {value.source.fileName} · reviewed {value.source.reviewedOn}</p><details><summary>Source identity and citations</summary><p className="dp-hint">SHA-256: {value.source.sha256}</p><ol>{value.source.locations.map((location, index) => <li key={index}>{location.sheet ? `${location.sheet} · ` : ''}{location.range || ''}{location.page ? `Page ${location.page}` : ''}{location.note ? ` · ${location.note}` : ''}</li>)}</ol></details>
    {value.amounts.length ? <div className="dp-table-scroll"><table><thead><tr><th scope="col">Historical description</th><th scope="col">Role</th><th scope="col">Historical amount</th><th scope="col">Citation</th></tr></thead><tbody>{value.amounts.map((amount, index) => <tr key={index}><th scope="row">{amount.label}{amount.alternativeGroup && <small>Alternative group: {amount.alternativeGroup}</small>}</th><td>{readable(amount.role)}</td><td>{amount.valuePence === null ? 'Unpriced / unknown' : money(amount.valuePence)}</td><td>Source {amount.locationIndex + 1}</td></tr>)}</tbody></table></div> : <p>No historical amounts recorded.</p>}
    {value.warnings.length > 0 && <><h4>Review notes and exclusions</h4><ul>{value.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></>}<p className="dp-hint">These historical amounts are reference evidence. They are not added together or imported into the current rate card.</p></div>;
}

/** Render only inside the owner area. The server enforces owner access independently. */
export default function PrivateHistoryFields({ cloud, run, busy, onMessage }: PrivateHistoryFieldsProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<HistoricalScope[]>([]), [records, setRecords] = useState<HistoryRecord[]>([]), [reviewed, setReviewed] = useState(false), [loaded, setLoaded] = useState(false);
  return <details className="dp-private-history"><summary>Historical scopes · private evidence import</summary><p>Load a prepared, reviewed selection of historical scopes with original file identity and page or cell citations. Old prices, worker payments, duplicate totals and unpriced schedules stay distinct. Current selling prices require separate owner approval.</p>
    <div className="dp-actions"><button type="button" className="mw-action mw-action--secondary" disabled={busy} onClick={() => void run(async () => { const result = await cloud.action<{ records: HistoryRecord[]; ratesImported: false }>('admin.history.list'); if (result.ratesImported !== false) throw new Error('The history response did not establish that rates remain unchanged.'); setRecords(result.records); setLoaded(true); onMessage('Private historical evidence loaded. Current selling rates are unchanged.'); })}><span>Load imported historical scopes</span></button><button type="button" className="mw-action mw-action--secondary" disabled={busy} onClick={() => picker.current?.click()}><span>Choose prepared history JSON</span></button><input ref={picker} type="file" className="dp-file-hidden" accept="application/json,.json" aria-label="Choose a prepared historical scope JSON file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; void run(async () => { if (file.size > 2_000_000) throw new Error('Choose a prepared history JSON file no larger than 2 MB.'); setPending([]); setReviewed(false); const checked = previewFile(JSON.parse(await file.text())); setPending(checked); onMessage(`${checked.length} historical scopes opened for local review. Nothing has been imported.`); }); }} /></div>
    <p className="dp-hint">Choose a JSON array or an object containing an entries array, up to 2 MB and 50 reviewed scopes. The file is read in this tab for review. Original archive paths and source files are never fetched by this screen.</p>
    {pending.length > 0 && <section><h3>Review before importing · {pending.length} scopes</h3>{pending.map((entry, index) => <details className="dp-config-card" key={`${entry.externalRef}-${index}`}><summary>{entry.title} · {readable(entry.classification)}</summary><HistoryDetails value={entry} /></details>)}<label className="dp-checkbox"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>I have reviewed source citations, quantity units, amount classifications, alternatives, duplicate totals and warnings. These records are historical evidence, not current rates.</span></label><div className="dp-actions"><button type="button" className="mw-action mw-action--primary" disabled={busy || !reviewed} onClick={() => void run(async () => { const result = await cloud.action<{ records: HistoryRecord[]; count: number; ratesImported: false }>('admin.history.import', { entries: pending }); if (result.ratesImported !== false) throw new Error('The import response did not establish that current rates remain unchanged.'); setRecords(previous => [...result.records, ...previous.filter(record => !result.records.some(next => next.id === record.id))]); setPending([]); setReviewed(false); setLoaded(true); onMessage(`${result.count} reviewed historical scopes imported privately. Current selling prices are unchanged.`); })}><span>Import reviewed historical scopes privately</span></button><button type="button" className="mw-action mw-action--quiet" onClick={() => { setPending([]); setReviewed(false); }}><span>Discard local preview</span></button></div></section>}
    {loaded && <section><h3>Imported historical evidence</h3>{records.length ? records.map(record => <details className="dp-config-card" key={record.id}><summary>{record.body.title} · imported {new Date(record.createdAt).toLocaleDateString('en-GB')}</summary><HistoryDetails value={record.body} /></details>) : <p>No reviewed historical scopes have been imported.</p>}</section>}
  </details>;
}
