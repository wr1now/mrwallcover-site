import type { ReactNode } from 'react';
import type { ServiceEntry, ServicePlan } from '../../server/designer-portal/logistics';

export interface ServicePlanFieldsProps {
  value: ServicePlan;
  onChange: (value: ServicePlan) => void;
  items?: { id: string; label: string }[];
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="dp-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="dp-checkbox"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>;
}

/** These commercial allowances are loaded and saved through the owner-only service-plan API. */
export default function ServicePlanFields({ value, onChange, items = [] }: ServicePlanFieldsProps) {
  const entries = value.serviceEntries ?? [];
  function update(index: number, next: ServiceEntry) { onChange({ ...value, serviceEntries: entries.map((entry, i) => i === index ? next : entry) }); }
  return <div className="dp-service-entries">
    <h3>Survey visits, management and additional preparation</h3>
    <p>Describe the actual work and its approved hours, days or visits. Enter the current selling rate and date reviewed. An empty or unapproved rate keeps the project in review. These entries do not change a product installation rate.</p>
    <p className="dp-hint">For each survey or management category, use either these entries or the legacy hourly allowance above. Keep the legacy hours at zero when entering that category here. Package survey and management is charged once; additional services require the separate project declaration.</p>
    {entries.map((entry, index) => <fieldset className="dp-config-card" key={entry.id}>
      <legend>Service {index + 1}</legend>
      <div className="dp-fields">
        <Field label="Service category"><select value={entry.category} onChange={event => update(index, { ...entry, category: event.target.value as ServiceEntry['category'], approved: false })}><option value="survey">Surveying</option><option value="management">Project management</option><option value="preparation">Additional preparation</option></select></Field>
        <Field label="Service scope / description" hint="For example: setting-out visit, protection planning or removal in the named rooms."><input maxLength={160} value={entry.label} onChange={event => update(index, { ...entry, label: event.target.value, approved: false })} /></Field>
        <Field label="Quantity"><input type="number" inputMode="decimal" min={entry.unit === 'visit' ? 1 : 0.25} max={10000} step={entry.unit === 'visit' ? 1 : 0.25} value={entry.quantity} onChange={event => update(index, { ...entry, quantity: Number(event.target.value), approved: false })} /></Field>
        <Field label="Pricing unit"><select value={entry.unit} onChange={event => update(index, { ...entry, unit: event.target.value as ServiceEntry['unit'], approved: false })}><option value="hour">Hour</option><option value="day">Day</option><option value="visit">Visit</option></select></Field>
        <Field label={`Current selling rate per ${entry.unit}`}><span className="dp-number"><input type="number" inputMode="decimal" min={0.01} step={0.01} value={entry.ratePence === null ? '' : entry.ratePence / 100} onChange={event => update(index, { ...entry, ratePence: event.target.value === '' ? null : Math.round(Number(event.target.value) * 100), approved: false })} /><span>GBP</span></span></Field>
        <Field label="Current rate reviewed on"><input type="date" value={entry.rateReviewedOn || ''} onChange={event => update(index, { ...entry, rateReviewedOn: event.target.value || undefined, approved: false })} /></Field>
      </div>
      <fieldset className="dp-config-checks"><legend>{entry.category === 'preparation' ? 'Preparation scope · select every covered item' : 'Related scope items · optional'}</legend>{items.length ? items.map(item => <Check key={item.id} label={item.label} checked={entry.itemIds?.includes(item.id) ?? false} onChange={checked => update(index, { ...entry, itemIds: checked ? [...(entry.itemIds ?? []), item.id] : entry.itemIds?.filter(id => id !== item.id), approved: false })} />) : <p>Save a project with scope items before linking services.</p>}</fieldset>
      <Check label="Owner approves this service scope, quantity and reviewed current rate" checked={entry.approved} onChange={approved => update(index, { ...entry, approved })} />
      <button type="button" className="mw-action mw-action--quiet" onClick={() => onChange({ ...value, serviceEntries: entries.filter((_, i) => i !== index) })}><span>Remove service {index + 1}</span></button>
    </fieldset>)}
    <button type="button" className="mw-action mw-action--secondary" onClick={() => onChange({ ...value, serviceEntries: [...entries, { id: `service-${crypto.randomUUID()}`, category: 'survey', label: 'New service scope', quantity: 1, unit: 'visit', ratePence: null, approved: false }] })}><span>Add a service allowance</span></button>
    <Check label="Owner has reviewed and allowed for the declared stairs, high-level or restricted working access in this project scope" checked={value.accessReviewed === true} onChange={accessReviewed => onChange({ ...value, accessReviewed })} />
    <Check label="Owner has assessed provisional material availability and its programme implications; this does not confirm that materials are ready on site" checked={value.materialReadinessReviewed === true} onChange={materialReadinessReviewed => onChange({ ...value, materialReadinessReviewed })} />
  </div>;
}
