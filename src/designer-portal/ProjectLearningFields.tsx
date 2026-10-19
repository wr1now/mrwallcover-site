import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PortalCloud } from './cloud';
import type { EstimateSnapshot, ProjectDraft } from './types';
import type { ActualWork, LabourObservation, VehicleObservation, analyseActualWork } from '../../server/designer-portal/learning';

type Analysis = ReturnType<typeof analyseActualWork>;
type ActualRecord = { id: string; projectRevision: number; estimateId: string | null; supersedesId?: string | null; body: ActualWork; analysis: Analysis; createdAt: string };
type ActualReview = { id: string; actualId: string; decision: 'reviewed' | 'rate-card-review-needed'; note: string; createdAt: string };
export interface ProjectLearningFieldsProps {
  cloud: PortalCloud;
  project: { id: string; revision: number; draft: ProjectDraft } | null;
  isOwner: boolean;
  run: (work: () => Promise<void>) => Promise<void>;
  busy: boolean;
  onMessage: (message: string) => void;
}
const today = () => new Date().toISOString().slice(0, 10);
const initial = (): ActualWork => ({ completedOn: today(), installationDates: [], labour: [], vehicles: [] });
const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
const dateLabel = (date: string) => new Date(date).toLocaleDateString('en-GB');
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="dp-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function Button({ children, onClick, disabled = false, quiet = false }: { children: ReactNode; onClick: () => void; disabled?: boolean; quiet?: boolean }) { return <button type="button" disabled={disabled} className={`mw-action mw-action--${quiet ? 'quiet' : 'secondary'}`} onClick={onClick}><span>{children}</span></button>; }

/** Staff operational evidence remains private and never changes the rate card automatically. */
export default function ProjectLearningFields({ cloud, project, isOwner, run, busy, onMessage }: ProjectLearningFieldsProps) {
  const [body, setBody] = useState<ActualWork>(initial), [records, setRecords] = useState<ActualRecord[]>([]), [reviews, setReviews] = useState<ActualReview[]>([]);
  const [estimates, setEstimates] = useState<EstimateSnapshot[]>([]), [estimateId, setEstimateId] = useState(''), [supersedesId, setSupersedesId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({}), [loaded, setLoaded] = useState(false);
  const requestKey = useRef<string | null>(null);
  useEffect(() => { setBody(initial()); setRecords([]); setReviews([]); setEstimates([]); setEstimateId(''); setSupersedesId(null); setReviewNotes({}); setLoaded(false); requestKey.current = null; }, [project?.id]);
  function change(next: ActualWork) { setBody(next); requestKey.current = null; }
  function changeLabour(index: number, next: LabourObservation) { change({ ...body, labour: body.labour.map((entry, i) => i === index ? next : entry) }); }
  function changeVehicle(index: number, next: VehicleObservation) { change({ ...body, vehicles: body.vehicles.map((entry, i) => i === index ? next : entry) }); }
  async function load() {
    if (!project) return;
    const [actuals, budgets] = await Promise.all([cloud.action<{ actuals: ActualRecord[]; reviews: ActualReview[] }>('admin.actuals.list', { projectId: project.id }), cloud.action<{ estimates: EstimateSnapshot[] }>('estimate.list', { projectId: project.id })]);
    setRecords(actuals.actuals); setReviews(actuals.reviews); setEstimates(budgets.estimates); setLoaded(true); onMessage('Private completion records and issued budgets loaded.');
  }
  async function review(record: ActualRecord, decision: ActualReview['decision']) {
    if (!project || !isOwner) return;
    const result = await cloud.action<{ review: ActualReview }>('admin.actuals.review', { projectId: project.id, actualId: record.id, decision, note: reviewNotes[record.id]?.trim() || '' });
    setReviews(previous => [result.review, ...previous]); onMessage('Owner review recorded. Selling prices are unchanged; a rate change needs a separately approved rate card.');
  }
  return <details className="dp-project-learning"><summary>Completed work · actual labour and logistics</summary>
    <p>Capture actual person-time and vehicle attendance after completion. Compare these observations with the issued budget to improve future scope and allowances. Observations and review suggestions never approve or change a selling rate.</p>
    {!project ? <p>Save or open a project before recording completed work.</p> : <>
      <p>Completion evidence will refer to saved project revision {project.revision}. Save any changed scope first.</p>
      <Button disabled={busy} onClick={() => void run(load)}>Load completion records and budgets</Button>
      <form onSubmit={event => { event.preventDefault(); void run(async () => {
        requestKey.current ??= crypto.randomUUID();
        const result = await cloud.action<{ actual: ActualRecord }>('admin.actuals.save', { projectId: project.id, expectedRevision: project.revision, estimateId: estimateId || null, supersedesId, idempotencyKey: requestKey.current, body });
        setRecords(previous => [result.actual, ...previous.filter(record => record.id !== result.actual.id)]); setSupersedesId(result.actual.id); requestKey.current = null; setLoaded(true);
        onMessage('Completion evidence saved as a preserved record. Further edits will create a correction; selling prices are unchanged.');
      }); }}>
        <h3>{supersedesId ? 'Correction to a preserved completion record' : 'New completion evidence'}</h3>
        <div className="dp-fields"><Field label="Completed on"><input type="date" max={today()} value={body.completedOn} required onChange={event => change({ ...body, completedOn: event.target.value })} /></Field><Field label="Compare with issued budget · optional" hint="Load project budgets first. An observation without a linked budget is still useful evidence."><select value={estimateId} onChange={event => { setEstimateId(event.target.value); requestKey.current = null; }}><option value="">Observation only · no budget comparison</option>{estimateId && !estimates.some(estimate => estimate.id === estimateId) && <option value={estimateId}>Previously linked budget</option>}{estimates.map(estimate => <option key={estimate.id} value={estimate.id}>Project revision {estimate.projectRevision} · {dateLabel(estimate.createdAt)} · {estimate.totalPence === null ? 'Incomplete assessment' : money(estimate.totalPence)}</option>)}</select></Field></div>
        <h4>Actual installation dates</h4><p className="dp-hint">Record each day worked once. These dates do not create vehicle days or parking costs.</p>
        {body.installationDates.map((date, index) => <div className="dp-inline-form" key={index}><Field label={`Installation date ${index + 1}`}><input type="date" max={body.completedOn} value={date} required onChange={event => change({ ...body, installationDates: body.installationDates.map((value, i) => i === index ? event.target.value : value) })} /></Field><Button quiet onClick={() => change({ ...body, installationDates: body.installationDates.filter((_, i) => i !== index) })}>Remove installation date {index + 1}</Button></div>)}
        <Button onClick={() => change({ ...body, installationDates: [...body.installationDates, ''] })}>Add an installation date</Button>
        <h4>Actual person-time</h4><p className="dp-hint">Enter combined person-hours: two installers working eight hours each is 16 person-hours. Values are saved as whole person-minutes. Do not add money or treat these observations as selling rates.</p>
        {body.labour.map((entry, index) => <fieldset className="dp-config-card" key={entry.id}><legend>Labour entry {index + 1}</legend><div className="dp-fields">
          <Field label="Work category"><select value={entry.category} onChange={event => changeLabour(index, { ...entry, category: event.target.value as LabourObservation['category'] })}><option value="installation">Installation</option><option value="preparation">Additional preparation</option><option value="survey">Surveying</option><option value="management">Management</option></select></Field>
          <Field label="Work carried out"><input maxLength={200} required value={entry.label} onChange={event => changeLabour(index, { ...entry, label: event.target.value })} /></Field>
          <Field label="Actual person-hours"><input type="number" min={0} step="any" inputMode="decimal" value={entry.minutes / 60} onChange={event => changeLabour(index, { ...entry, minutes: Math.round(Number(event.target.value) * 60) })} /></Field>
          <Field label="Related scope · optional"><select value={entry.itemId || ''} onChange={event => changeLabour(index, { ...entry, itemId: event.target.value || undefined })}><option value="">Whole project / not assigned</option>{project.draft.items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        </div><Button quiet onClick={() => change({ ...body, labour: body.labour.filter((_, i) => i !== index) })}>Remove labour entry {index + 1}</Button></fieldset>)}
        <Button onClick={() => change({ ...body, labour: [...body.labour, { id: `labour-${crypto.randomUUID()}`, category: 'installation', label: '', minutes: 0 }] })}>Add actual labour</Button>
        <h4>Actual vehicle attendance</h4><p className="dp-hint">Record delivery, replenishment and collection dates separately from installation. Leave unknown costs blank. Confirming a complete cost record requires every amount, including explicit zeroes.</p>
        {body.vehicles.map((entry, index) => <fieldset className="dp-config-card" key={index}><legend>Vehicle attendance {index + 1}</legend><div className="dp-fields">
          <Field label="Vehicle attendance date"><input type="date" max={body.completedOn} required value={entry.date} onChange={event => changeVehicle(index, { ...entry, date: event.target.value })} /></Field>
          <Field label="Vehicle reference"><input maxLength={100} required value={entry.vehicleId} onChange={event => changeVehicle(index, { ...entry, vehicleId: event.target.value })} /></Field>
          {(['parkingPence', 'congestionPence', 'ulezPence', 'deliveryPence', 'storagePence'] as const).map((key, i) => <Field key={key} label={['Actual parking cost', 'Actual Congestion Charge', 'Actual ULEZ charge', 'Actual delivery cost', 'Actual storage cost'][i]}><span className="dp-number"><input type="number" min={0} step={0.01} inputMode="decimal" required={entry.costsConfirmed} value={entry[key] === undefined ? '' : entry[key]! / 100} onChange={event => changeVehicle(index, { ...entry, [key]: event.target.value === '' ? undefined : Math.round(Number(event.target.value) * 100), costsConfirmed: false })} /><span>GBP</span></span></Field>)}
          <Field label="Attendance / receipt notes"><textarea rows={2} maxLength={1000} value={entry.notes || ''} onChange={event => changeVehicle(index, { ...entry, notes: event.target.value || undefined })} /></Field>
        </div><label className="dp-checkbox"><input type="checkbox" checked={entry.costsConfirmed} onChange={event => changeVehicle(index, { ...entry, costsConfirmed: event.target.checked })} /><span>All five vehicle cost amounts are known, including any zeroes.</span></label><Button quiet onClick={() => change({ ...body, vehicles: body.vehicles.filter((_, i) => i !== index) })}>Remove vehicle attendance {index + 1}</Button></fieldset>)}
        <Button onClick={() => change({ ...body, vehicles: [...body.vehicles, { date: '', vehicleId: '', costsConfirmed: false }] })}>Add actual vehicle attendance</Button>
        <Field label="Completion notes"><textarea rows={4} maxLength={4000} value={body.notes || ''} onChange={event => change({ ...body, notes: event.target.value || undefined })} /></Field>
        <div className="dp-actions"><button type="submit" disabled={busy} className="mw-action mw-action--primary"><span>{supersedesId ? 'Save corrected completion record' : 'Save completion evidence'}</span></button>{supersedesId && <Button quiet onClick={() => { change(initial()); setSupersedesId(null); setEstimateId(''); }}>Start a separate completion record</Button>}</div>
      </form>
      {loaded && <div className="dp-actual-records"><h3>Preserved completion records</h3>{!records.length && <p>No completion records have been saved for this project.</p>}{records.map(record => <article className="dp-config-card" key={record.id}>
        <h4>Completed {dateLabel(record.body.completedOn)} · project revision {record.projectRevision}</h4><p>Saved {dateLabel(record.createdAt)}{record.supersedesId ? ' · correction to an earlier record' : ''}. {record.body.installationDates.length} installation days; {record.body.vehicles.length} vehicle days.</p>
        <dl className="dp-product-facts">{Object.entries(record.analysis.personMinutes).map(([category, minutes]) => <div key={category}><dt>{category === 'preparation' ? 'Additional preparation' : category.charAt(0).toUpperCase() + category.slice(1)}</dt><dd>{(minutes / 60).toFixed(2)} person-hours</dd></div>)}<div><dt>Actual vehicle costs</dt><dd>{record.analysis.vehicleCostPence === null ? 'Incomplete cost evidence' : money(record.analysis.vehicleCostPence)}</dd></div><div><dt>Quoted vehicle days</dt><dd>{record.analysis.quotedVehicleDays ?? 'No linked budget'}</dd></div><div><dt>Quoted package labour</dt><dd>{record.analysis.quotedPackageLabourMinutes === null ? 'No comparable fixed labour allowance' : `${(record.analysis.quotedPackageLabourMinutes / 60).toFixed(2)} person-hours`}</dd></div></dl>
        {record.analysis.suggestions.length ? <><h5>Points for owner review</h5><ul>{record.analysis.suggestions.map((suggestion, index) => <li key={index}>{suggestion}</li>)}</ul></> : <p>No automatic improvement suggestion was identified. This does not approve a rate or establish that the work matched every assumption.</p>}
        <details><summary>Recorded dates, work and costs</summary><p>Installation: {record.body.installationDates.map(dateLabel).join(', ')}.</p><ul>{record.body.labour.map(entry => <li key={entry.id}>{entry.label} · {(entry.minutes / 60).toFixed(2)} person-hours · {entry.category}</li>)}</ul>{record.body.vehicles.map((entry, index) => <div key={index}><p>{dateLabel(entry.date)} · {entry.vehicleId} · {entry.costsConfirmed ? 'costs complete' : 'costs incomplete'}{entry.notes ? ` · ${entry.notes}` : ''}</p><dl className="dp-product-facts">{(['parkingPence', 'congestionPence', 'ulezPence', 'deliveryPence', 'storagePence'] as const).map((key, i) => <div key={key}><dt>{['Parking', 'Congestion Charge', 'ULEZ', 'Delivery', 'Storage'][i]}</dt><dd>{entry[key] === undefined ? 'Not yet known' : money(entry[key]!)}</dd></div>)}</dl></div>)}{record.body.notes && <p>{record.body.notes}</p>}</details>
        <Button disabled={busy} onClick={() => { change(structuredClone(record.body)); setSupersedesId(record.id); setEstimateId(record.estimateId || ''); onMessage('A correction draft is open. The earlier completion record remains preserved.'); }}>Prepare a correction</Button>
        {reviews.filter(review => review.actualId === record.id).map(review => <p key={review.id}><strong>{review.decision === 'rate-card-review-needed' ? 'Rate-card review requested' : 'Owner reviewed'}</strong> · {dateLabel(review.createdAt)} · {review.note}</p>)}
        {isOwner && <div className="dp-owner-review"><Field label="Owner review note"><textarea rows={2} maxLength={2000} value={reviewNotes[record.id] || ''} onChange={event => setReviewNotes({ ...reviewNotes, [record.id]: event.target.value })} /></Field><div className="dp-actions"><Button disabled={busy || !reviewNotes[record.id]?.trim()} onClick={() => void run(() => review(record, 'reviewed'))}>Record owner review</Button><Button disabled={busy || !reviewNotes[record.id]?.trim()} onClick={() => void run(() => review(record, 'rate-card-review-needed'))}>Request rate-card review</Button></div></div>}
      </article>)}</div>}
    </>}
  </details>;
}
