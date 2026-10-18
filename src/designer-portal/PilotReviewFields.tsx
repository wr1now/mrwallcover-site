import { useEffect, useState, type ReactNode } from 'react';
import type { PortalCloud } from './cloud';
import type { EstimateSnapshot, ProjectDraft } from './types';
import type { HistoricalScope, PilotInput, comparePilot } from '../../server/designer-portal/learning';

type Comparison = ReturnType<typeof comparePilot>;
type PilotRecord = { id: string; estimateId: string; historicalScopeId?: string | null; body: PilotInput; comparison: Comparison; createdAt: string };
type HistoryRecord = { id: string; body: HistoricalScope };
type SourceDocument = { id: string; fileName: string; revision: number; verified: boolean; status?: string; state?: string };
type ExpectedLine = { id: string; label: string; category: string; amountPence: number | null };
export interface PilotReviewFieldsProps {
  cloud: PortalCloud;
  project: { id: string; revision: number; draft: ProjectDraft } | null;
  isOwner: boolean;
  run: (work: () => Promise<void>) => Promise<void>;
  busy: boolean;
  onMessage: (message: string) => void;
}
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value / 100);
const difference = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value))}`;
const readable = (value: string) => value.replaceAll('-', ' ').replaceAll('_', ' ');
const categories = ['installation', 'package', 'preparation', 'survey', 'management', 'logistics'];
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="dp-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }

/** Independent owner-prepared prices are compared with an immutable issued budget. */
export default function PilotReviewFields({ cloud, project, isOwner, run, busy, onMessage }: PilotReviewFieldsProps) {
  const [records, setRecords] = useState<PilotRecord[]>([]), [estimates, setEstimates] = useState<EstimateSnapshot[]>([]), [histories, setHistories] = useState<HistoryRecord[]>([]), [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [estimateId, setEstimateId] = useState(''), [historicalScopeId, setHistoricalScopeId] = useState(''), [sourceDocumentId, setSourceDocumentId] = useState(''), [loaded, setLoaded] = useState(false);
  const [referenceLabel, setReferenceLabel] = useState(''), [preparedOn, setPreparedOn] = useState(today), [note, setNote] = useState(''), [lines, setLines] = useState<ExpectedLine[]>([]);
  const [vatRateBps, setVatRateBps] = useState(2000), [tolerancePence, setTolerancePence] = useState(0), [independent, setIndependent] = useState(false), [scopeChecked, setScopeChecked] = useState(false);
  useEffect(() => { setRecords([]); setEstimates([]); setHistories([]); setDocuments([]); setEstimateId(''); setHistoricalScopeId(''); setSourceDocumentId(''); setLoaded(false); setReferenceLabel(''); setPreparedOn(today()); setNote(''); setLines([]); setVatRateBps(2000); setTolerancePence(0); setIndependent(false); setScopeChecked(false); }, [project?.id]);
  function changeLine(index: number, next: ExpectedLine) { setLines(previous => previous.map((line, i) => i === index ? next : line)); setIndependent(false); }
  if (!isOwner) return <details className="dp-pilot-reviews"><summary>Current-price pilot comparisons</summary><p>The Mr Wallcover owner records independent current-price comparisons and reviews coverage before automatic estimating is enabled.</p></details>;
  return <details className="dp-pilot-reviews"><summary>Current-price pilot comparisons</summary><p>Compare a representative project with a fresh, independently prepared owner estimate using current prices. Historical scopes can identify the work and units; historical totals are not today’s target. Matching results do not approve product coverage or modify the rate card.</p>
    {!project ? <p>Save or open a project before recording a current-price comparison.</p> : <>
      <button type="button" className="mw-action mw-action--secondary" disabled={busy} onClick={() => void run(async () => {
        const [pilots, budgets, history, details] = await Promise.all([
          cloud.action<{ comparisons: PilotRecord[] }>('admin.pilot.list', { projectId: project.id }),
          cloud.action<{ estimates: EstimateSnapshot[] }>('estimate.list', { projectId: project.id }),
          cloud.action<{ records: HistoryRecord[]; ratesImported: false }>('admin.history.list'),
          cloud.action<{ documents: SourceDocument[] }>('project.get', { projectId: project.id }),
        ]);
        setRecords(pilots.comparisons); setEstimates(budgets.estimates.filter(estimate => estimate.status === 'ready' && estimate.totalPence !== null)); setHistories(history.records); setDocuments(details.documents.filter(document => document.verified)); setLoaded(true);
        onMessage('Private pilot comparisons, issued budgets and available sources loaded. No prices have changed.');
      })}><span>Load pilot comparisons and available sources</span></button>
      <form onSubmit={event => { event.preventDefault(); void run(async () => {
        if (!independent || !scopeChecked) throw new Error('Confirm the independently prepared current prices and matching scope before comparing.');
        if (!lines.length || lines.some(line => line.amountPence === null)) throw new Error('Enter every independently prepared line amount, including any explicit zero.');
        const body: PilotInput = { referenceLabel, preparedOn, priceBasis: 'current-owner-prices', independentlyPrepared: true, scopeChecked: true, expectedLines: lines.map(({ label, category, amountPence }) => ({ label, category, amountPence: amountPence! })), vatRateBps, tolerancePence, note, ...(sourceDocumentId ? { sourceDocumentId } : {}) };
        const result = await cloud.action<{ comparison: PilotRecord }>('admin.pilot.save', { projectId: project.id, estimateId, historicalScopeId: historicalScopeId || null, body });
        setRecords(previous => [result.comparison, ...previous.filter(record => record.id !== result.comparison.id)]); setLoaded(true); setIndependent(false); setScopeChecked(false);
        onMessage('Current-price comparison saved with its original budget and owner breakdown. Review any differences; rates and profile approvals are unchanged.');
      }); }}>
        <h3>Independent owner comparison</h3><div className="dp-fields">
          <Field label="Issued budget to assess" hint="Load sources first. Comparison is limited to a complete issued budget; a draft assessment cannot pass calibration."><select required value={estimateId} onChange={event => { setEstimateId(event.target.value); setScopeChecked(false); }}><option value="">Choose an issued budget</option>{estimates.map(estimate => <option key={estimate.id} value={estimate.id}>Project revision {estimate.projectRevision} · issued {new Date(estimate.createdAt).toLocaleDateString('en-GB')}</option>)}</select></Field>
          <Field label="Owner estimate reference"><input maxLength={200} required value={referenceLabel} onChange={event => { setReferenceLabel(event.target.value); setIndependent(false); }} /></Field>
          <Field label="Owner estimate prepared on"><input type="date" max={today()} required value={preparedOn} onChange={event => { setPreparedOn(event.target.value); setIndependent(false); }} /></Field>
          <Field label="Verified project source · optional" hint="Use the independently prepared current estimate or reviewed supporting document already uploaded privately."><select value={sourceDocumentId} onChange={event => { setSourceDocumentId(event.target.value); setIndependent(false); }}><option value="">No uploaded comparison source selected</option>{documents.map(document => <option key={document.id} value={document.id}>{document.fileName} · revision {document.revision}</option>)}</select></Field>
          <Field label="Historical scope reference · optional" hint="This links the original scope and units. It does not copy its historical amounts into this comparison."><select value={historicalScopeId} onChange={event => { setHistoricalScopeId(event.target.value); setScopeChecked(false); }}><option value="">No historical scope selected</option>{histories.map(history => <option key={history.id} value={history.id}>{history.body.title} · {readable(history.body.classification)}</option>)}</select></Field>
        </div>
        <h4>Current owner-prepared breakdown · excluding VAT</h4><p className="dp-hint">Enter your independent selling amounts. The portal does not fill these from its calculated estimate. All wallcovering, lining, primers and adhesives remain client supplied.</p>
        {lines.map((line, index) => <fieldset className="dp-config-card" key={line.id}><legend>Owner estimate line {index + 1}</legend><div className="dp-fields"><Field label="Work / service description"><input maxLength={200} required value={line.label} onChange={event => changeLine(index, { ...line, label: event.target.value })} /></Field><Field label="Cost category"><select value={line.category} onChange={event => changeLine(index, { ...line, category: event.target.value })}>{categories.map(category => <option key={category} value={category}>{category === 'preparation' ? 'Additional preparation' : readable(category)}</option>)}</select></Field><Field label="Owner amount · excluding VAT"><span className="dp-number"><input type="number" inputMode="decimal" min={0} step={0.01} required value={line.amountPence === null ? '' : line.amountPence / 100} onChange={event => changeLine(index, { ...line, amountPence: event.target.value === '' ? null : Math.round(Number(event.target.value) * 100) })} /><span>GBP</span></span></Field></div><button type="button" className="mw-action mw-action--quiet" onClick={() => { setLines(previous => previous.filter((_, i) => i !== index)); setIndependent(false); }}><span>Remove owner line {index + 1}</span></button></fieldset>)}
        <button type="button" className="mw-action mw-action--secondary" onClick={() => { setLines(previous => [...previous, { id: crypto.randomUUID(), label: '', category: 'installation', amountPence: null }]); setIndependent(false); }}><span>Add an owner estimate line</span></button>
        <div className="dp-fields"><Field label="Owner estimate VAT rate"><span className="dp-number"><input type="number" min={0} max={100} step={0.01} required value={vatRateBps / 100} onChange={event => { setVatRateBps(Math.round(Number(event.target.value) * 100)); setIndependent(false); }} /><span>%</span></span></Field><Field label="Maximum acceptable difference" hint="Zero requires an exact match. The limit applies to each category, subtotal, VAT and total; a match never approves a new price."><span className="dp-number"><input type="number" min={0} max={10000} step={0.01} required value={tolerancePence / 100} onChange={event => setTolerancePence(Math.round(Number(event.target.value) * 100))} /><span>GBP</span></span></Field></div>
        <Field label="Comparison scope and review note" hint="Record any scope differences, assumptions and why this example represents the installation profile."><textarea rows={4} maxLength={4000} required value={note} onChange={event => { setNote(event.target.value); setScopeChecked(false); }} /></Field>
        <label className="dp-checkbox"><input type="checkbox" required checked={independent} onChange={event => setIndependent(event.target.checked)} /><span>I independently prepared this breakdown using current owner-approved prices; it is not copied from old totals or the portal calculation.</span></label>
        <label className="dp-checkbox"><input type="checkbox" required checked={scopeChecked} onChange={event => setScopeChecked(event.target.checked)} /><span>I checked that the owner breakdown and selected issued budget cover the same rooms, products, preparation, access, programme and logistics assumptions.</span></label>
        <button type="submit" className="mw-action mw-action--primary" disabled={busy || !estimateId || !independent || !scopeChecked}><span>Save current-price pilot comparison</span></button>
      </form>
      {loaded && <section><h3>Preserved current-price comparisons</h3>{!records.length && <p>No current-price comparisons have been recorded for this project.</p>}{records.map(record => <article className="dp-config-card" key={record.id}>
        <h4>{record.body.referenceLabel}</h4><p>Owner estimate dated {record.body.preparedOn} · comparison saved {new Date(record.createdAt).toLocaleDateString('en-GB')}.</p><p className="dp-tag">{record.comparison.withinTolerance ? 'Within recorded tolerance' : 'Owner review required'}</p>
        <div className="dp-table-scroll"><table><thead><tr><th scope="col">Category</th><th scope="col">Independent owner amount</th><th scope="col">Portal budget</th><th scope="col">Difference</th></tr></thead><tbody>{record.comparison.byCategory.map(category => <tr key={category.category}><th scope="row">{readable(category.category)}</th><td>{money(category.expectedPence)}</td><td>{money(category.calculatedPence)}</td><td>{difference(category.differencePence)}</td></tr>)}{(['subtotalPence', 'vatPence', 'totalPence'] as const).map((key, index) => <tr key={key}><th scope="row">{['Subtotal', 'VAT', 'Total including VAT'][index]}</th><td>{money(record.comparison.expected[key])}</td><td>{money(record.comparison.calculated[key]!)}</td><td>{difference(record.comparison.differences[key])}</td></tr>)}</tbody></table></div>
        <p>Recorded tolerance: {money(record.body.tolerancePence)}. Owner VAT rate: {record.body.vatRateBps / 100}%; portal VAT rate: {record.comparison.calculated.vatRateBps === null ? 'unconfirmed' : `${record.comparison.calculated.vatRateBps / 100}%`}.</p><p>{record.body.note}</p><details><summary>Independent owner breakdown</summary><ul>{record.body.expectedLines.map((line, index) => <li key={index}>{line.label} · {readable(line.category)} · {money(line.amountPence)}</li>)}</ul></details><p className="dp-hint">This comparison preserves its inputs and issued budget. Profile activation and rate changes require separate owner approval.</p>
      </article>)}</section>}
    </>}
  </details>;
}
