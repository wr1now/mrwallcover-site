import type { ProjectDraft, ProjectResources, ScopeItem, ValidationIssue, ValidationResult } from './types.ts';

export const PORTAL_LIMITS = Object.freeze({ rooms: 50, items: 200, walls: 100, resources: 200, openings: 100, vehicleDays: 366, widthMm: 100_000, heightMm: 30_000, count: 100, itemNetMm2: 100_000_000_000, projectNetMm2: 250_000_000_000 });
const groups = ['printed-paper', 'printed-nonwoven', 'vinyl-coated-paper', 'domestic-vinyl', 'wide-contract-vinyl', 'standard-fabric', 'velvet-flock-pile', 'formed-acoustic', 'specialists'];
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value && value >= '2020-01-01' && value <= '2100-12-31';
}
export function measureScopeArea(item: ScopeItem) {
  let grossMm2 = 0, openingsMm2 = 0, revealsMm2 = 0;
  if (item.surfaceKind === 'ceiling') {
    for (const face of item.ceilings || []) {
      grossMm2 += face.widthMm * face.lengthMm * face.count;
      openingsMm2 += face.openings.reduce((sum, x) => sum + x.widthMm * x.lengthMm * x.count, 0) * face.count;
    }
  } else for (const wall of item.walls) {
    grossMm2 += wall.widthMm * wall.heightMm * wall.count;
    openingsMm2 += wall.openings.reduce((sum, x) => sum + x.widthMm * x.heightMm * x.count, 0) * wall.count;
    revealsMm2 += wall.reveals.reduce((sum, x) => sum + x.widthMm * x.heightMm * x.count, 0) * wall.count;
  }
  const netMm2 = grossMm2 - openingsMm2 + revealsMm2;
  return { grossMm2, openingsMm2, revealsMm2, netMm2, netM2: netMm2 / 1_000_000 };
}
/** Zero-sized rectangles remain valid draft placeholders, but are never complete estimating geometry. */
export function hasCompleteScopeGeometry(item: ScopeItem): boolean {
  const positive = (value: number) => value > 0;
  if ((item.surfaceKind ?? 'wall') === 'wall') return item.walls.length > 0 && item.walls.every(wall => positive(wall.widthMm) && positive(wall.heightMm) && [...wall.openings, ...wall.reveals].every(part => positive(part.widthMm) && positive(part.heightMm)));
  if (item.surfaceKind === 'ceiling') return Boolean(item.ceilings?.length) && item.ceilings!.every(ceiling => positive(ceiling.widthMm) && positive(ceiling.lengthMm) && ceiling.openings.every(part => positive(part.widthMm) && positive(part.lengthMm)));
  return false;
}
export function emptyProjectDraft(): ProjectDraft {
  return { schemaVersion: 1, name: '', buildingType: 'unknown', resources: emptyProjectResources(), rooms: [], items: [], contact: { name: '', email: '' }, address: { line1: '', town: '', postcode: '', country: 'UK' }, programme: { occupied: 'unknown', outOfHours: 'unknown', phases: 1, materialReadiness: { status: 'unknown', scopeItemIds: [] } }, logistics: { vehicleDays: [], vehicleDaysConfirmed: false, deliveriesRequired: 'unknown', storageRequired: 'unknown', accessEquipmentRequired: 'unknown', wasteRemovalRequired: 'unknown', notes: '' } };
}
/** Strict transport validation permits incomplete drafts; estimate eligibility handles missing information. */
export function validateProjectDraft(input: unknown): ValidationResult<ProjectDraft> {
  const issues: ValidationIssue[] = [];
  const fail = (path: string, code: string, message: string) => issues.push({ path, code, message });
  const object = (value: unknown, path: string, keys: string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) { fail(path, 'object', 'Use a plain object.'); return {} as Record<string, unknown>; }
    const result = value as Record<string, unknown>;
    for (const key of Object.keys(result)) if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown-field', 'This field is not accepted.');
    return result;
  };
  const string = (value: unknown, path: string, max = 160, optional = false) => {
    if (optional && value === undefined) return;
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) fail(path, 'string', `Use text of at most ${max} characters.`);
  };
  const id = (value: unknown, path: string, optional = false) => { if (optional && value === undefined) return; if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)) fail(path, 'id', 'Use a stable identifier of at most 80 letters, numbers, underscores or hyphens.'); };
  const integer = (value: unknown, path: string, min: number, max: number, optional = false) => { if (optional && value === undefined) return; if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) fail(path, 'integer', `Use a whole number between ${min} and ${max}.`); };
  const enumeration = (value: unknown, path: string, values: readonly unknown[]) => { if (!values.includes(value)) fail(path, 'choice', 'Choose a supported value.'); };
  const flag = (value: unknown, path: string) => enumeration(value, path, ['yes', 'no', 'unknown']);
  const array = (value: unknown, path: string, max: number) => { if (!Array.isArray(value) || value.length > max) { fail(path, 'array', `Use at most ${max} entries.`); return [] as unknown[]; } return value; };
  const date = (value: unknown, path: string) => { if (value !== undefined && !isCalendarDate(value)) fail(path, 'date', 'Use a valid calendar date between 2020 and 2100.'); };
  const unique = (values: unknown[], path: string) => { const ids = values.map(x => x && typeof x === 'object' ? (x as Record<string, unknown>).id : undefined); if (new Set(ids).size !== ids.length) fail(path, 'duplicate-id', 'Each entry needs a unique identifier.'); };
  const p = object(input, 'project', ['schemaVersion', 'id', 'name', 'buildingType', 'resources', 'rooms', 'items', 'contact', 'address', 'propertyValuePence', 'programme', 'logistics']);
  if (p.buildingType !== undefined) enumeration(p.buildingType, 'buildingType', ['private-home', 'apartment', 'hotel', 'retail', 'office', 'commercial-other', 'mixed-use', 'unknown']);
  enumeration(p.schemaVersion, 'schemaVersion', [1]); id(p.id, 'id', true); string(p.name, 'name'); integer(p.propertyValuePence, 'propertyValuePence', 0, 10_000_000_000_000, true);
  const rooms = array(p.rooms, 'rooms', PORTAL_LIMITS.rooms); unique(rooms, 'rooms');
  rooms.forEach((value, i) => { const path = `rooms.${i}`, room = object(value, path, ['id', 'label', 'floor']); id(room.id, `${path}.id`); string(room.label, `${path}.label`); string(room.floor, `${path}.floor`, 80); });
  const roomIds = new Set(rooms.map(x => (x as Record<string, unknown>)?.id));
  const items = array(p.items, 'items', PORTAL_LIMITS.items); unique(items, 'items');
  let totalArea = 0;
  items.forEach((value, i) => {
    const path = `items.${i}`, item = object(value, path, ['id', 'roomId', 'label', 'scopeKind', 'confirmedMeasurements', 'surfaceKind', 'walls', 'ceilings', 'material', 'preparation', 'access', 'packageId']);
    id(item.id, `${path}.id`); id(item.roomId, `${path}.roomId`); if (!roomIds.has(item.roomId)) fail(`${path}.roomId`, 'room', 'Choose an existing room.'); string(item.label, `${path}.label`); id(item.packageId, `${path}.packageId`, true);
    if (item.surfaceKind !== undefined) enumeration(item.surfaceKind, `${path}.surfaceKind`, ['wall', 'ceiling', 'unknown']);
    enumeration(item.scopeKind, `${path}.scopeKind`, ['feature_wall', 'single_room', 'multiple_rooms', 'commercial']); enumeration(item.confirmedMeasurements, `${path}.confirmedMeasurements`, [true, false]);
    enumeration(item.preparation, `${path}.preparation`, ['normal-prep-lining-hanging', 'contract-ready', 'removal-or-repair', 'unknown']); enumeration(item.access, `${path}.access`, ['standard', 'stairs', 'high-level', 'restricted', 'unknown']);
    const material = object(item.material, `${path}.material`, ['groupId', 'verifiedTypeId', 'productId', 'manufacturer', 'productName', 'productCode', 'clientProvided', 'acoustic', 'velvet', 'specialist']);
    enumeration(material.groupId, `${path}.material.groupId`, groups); for (const k of ['verifiedTypeId', 'productId']) id(material[k], `${path}.material.${k}`, true); for (const k of ['manufacturer', 'productName', 'productCode']) string(material[k], `${path}.material.${k}`, 200, true); enumeration(material.clientProvided, `${path}.material.clientProvided`, [true, false]); for (const k of ['acoustic', 'velvet', 'specialist']) flag(material[k], `${path}.material.${k}`);
    const walls = array(item.walls, `${path}.walls`, PORTAL_LIMITS.walls); unique(walls, `${path}.walls`);
    walls.forEach((value, wi) => {
      const wp = `${path}.walls.${wi}`, wall = object(value, wp, ['id', 'widthMm', 'heightMm', 'count', 'openings', 'reveals']); id(wall.id, `${wp}.id`); integer(wall.widthMm, `${wp}.widthMm`, 0, PORTAL_LIMITS.widthMm); integer(wall.heightMm, `${wp}.heightMm`, 0, PORTAL_LIMITS.heightMm); integer(wall.count, `${wp}.count`, 1, PORTAL_LIMITS.count);
      let openingArea = 0;
      for (const key of ['openings', 'reveals']) {
        const list = array(wall[key], `${wp}.${key}`, PORTAL_LIMITS.openings); unique(list, `${wp}.${key}`);
        list.forEach((value, oi) => { const op = `${wp}.${key}.${oi}`, part = object(value, op, ['id', 'widthMm', 'heightMm', 'count']); id(part.id, `${op}.id`); integer(part.widthMm, `${op}.widthMm`, 0, PORTAL_LIMITS.widthMm); integer(part.heightMm, `${op}.heightMm`, 0, PORTAL_LIMITS.heightMm); integer(part.count, `${op}.count`, 1, PORTAL_LIMITS.count); if (key === 'openings') { openingArea += Number(part.widthMm) * Number(part.heightMm) * Number(part.count); if (Number(part.widthMm) > Number(wall.widthMm) || Number(part.heightMm) > Number(wall.heightMm)) fail(op, 'opening-bounds', 'An opening cannot exceed its wall dimensions.'); } });
      }
      if (openingArea > Number(wall.widthMm) * Number(wall.heightMm)) fail(`${wp}.openings`, 'opening-area', 'Opening area cannot exceed the wall area.');
    });
    const ceilings = item.ceilings === undefined ? [] : array(item.ceilings, `${path}.ceilings`, PORTAL_LIMITS.walls); unique(ceilings, `${path}.ceilings`);
    ceilings.forEach((value, ci) => {
      const cp = `${path}.ceilings.${ci}`, ceiling = object(value, cp, ['id', 'widthMm', 'lengthMm', 'count', 'openings']);
      id(ceiling.id, `${cp}.id`); integer(ceiling.widthMm, `${cp}.widthMm`, 0, PORTAL_LIMITS.widthMm); integer(ceiling.lengthMm, `${cp}.lengthMm`, 0, PORTAL_LIMITS.widthMm); integer(ceiling.count, `${cp}.count`, 1, PORTAL_LIMITS.count);
      const openings = array(ceiling.openings, `${cp}.openings`, PORTAL_LIMITS.openings); unique(openings, `${cp}.openings`); let openingArea = 0;
      openings.forEach((value, oi) => { const op = `${cp}.openings.${oi}`, opening = object(value, op, ['id', 'widthMm', 'lengthMm', 'count']); id(opening.id, `${op}.id`); integer(opening.widthMm, `${op}.widthMm`, 0, PORTAL_LIMITS.widthMm); integer(opening.lengthMm, `${op}.lengthMm`, 0, PORTAL_LIMITS.widthMm); integer(opening.count, `${op}.count`, 1, PORTAL_LIMITS.count); openingArea += Number(opening.widthMm) * Number(opening.lengthMm) * Number(opening.count); if (Number(opening.widthMm) > Number(ceiling.widthMm) || Number(opening.lengthMm) > Number(ceiling.lengthMm)) fail(op, 'opening-bounds', 'A ceiling opening cannot exceed its measured ceiling face.'); });
      if (openingArea > Number(ceiling.widthMm) * Number(ceiling.lengthMm)) fail(`${cp}.openings`, 'opening-area', 'Opening area cannot exceed the ceiling face area.');
    });
    if ((item.surfaceKind === 'ceiling' && walls.length) || (item.surfaceKind !== 'ceiling' && ceilings.length)) fail(path, 'mixed-surfaces', 'Keep walls and ceiling faces in separate scope items.');
    if (item.surfaceKind === 'unknown' && (walls.length || ceilings.length)) fail(path, 'unknown-surface', 'Choose the measured surface kind before entering its geometry.');
    if (issues.length === 0) { const area = measureScopeArea(item as unknown as ScopeItem); if (!Number.isSafeInteger(area.netMm2) || area.netMm2 < 0 || area.netMm2 > PORTAL_LIMITS.itemNetMm2) fail(path, 'area', 'The item area exceeds the supported range.'); totalArea += area.netMm2; }
  });
  if (totalArea > PORTAL_LIMITS.projectNetMm2) fail('items', 'project-area', 'The project area exceeds the supported range.');
  const contact = object(p.contact, 'contact', ['name', 'email', 'phone', 'company']); string(contact.name, 'contact.name'); string(contact.email, 'contact.email', 254); if (typeof contact.email === 'string' && contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) fail('contact.email', 'email', 'Use a valid email address.'); string(contact.phone, 'contact.phone', 40, true); string(contact.company, 'contact.company', 160, true);
  const address = object(p.address, 'address', ['line1', 'line2', 'town', 'postcode', 'country']); for (const key of ['line1', 'town']) string(address[key], `address.${key}`, 200); string(address.line2, 'address.line2', 200, true); string(address.postcode, 'address.postcode', 20); string(address.country, 'address.country', 80);
  const programme = object(p.programme, 'programme', ['startDate', 'endDate', 'occupied', 'outOfHours', 'phases', 'notes', 'materialReadiness']); date(programme.startDate, 'programme.startDate'); date(programme.endDate, 'programme.endDate'); if (typeof programme.startDate === 'string' && typeof programme.endDate === 'string' && programme.endDate < programme.startDate) fail('programme.endDate', 'date-order', 'The end date must follow the start date.'); flag(programme.occupied, 'programme.occupied'); flag(programme.outOfHours, 'programme.outOfHours'); integer(programme.phases, 'programme.phases', 1, 100); string(programme.notes, 'programme.notes', 2000, true);
  const itemIds = new Set(items.map(x => (x as Record<string, unknown>)?.id));
  const scopeReferences = (value: unknown, path: string) => { const references = array(value, path, PORTAL_LIMITS.items); if (new Set(references).size !== references.length) fail(path, 'duplicate-scope', 'Do not repeat a scope reference.'); references.forEach((value, i) => { id(value, `${path}.${i}`); if (!itemIds.has(value)) fail(`${path}.${i}`, 'scope', 'Choose an existing scope item.'); }); };
  if (programme.materialReadiness !== undefined) { const readiness = object(programme.materialReadiness, 'programme.materialReadiness', ['status', 'readyDate', 'scopeItemIds', 'constraints']); enumeration(readiness.status, 'programme.materialReadiness.status', ['unknown', 'awaiting-specification', 'ordered', 'part-delivered', 'delivered', 'checked-ready']); date(readiness.readyDate, 'programme.materialReadiness.readyDate'); scopeReferences(readiness.scopeItemIds, 'programme.materialReadiness.scopeItemIds'); string(readiness.constraints, 'programme.materialReadiness.constraints', 2000, true); }
  if (p.resources !== undefined) {
    const resources = object(p.resources, 'resources', ['materialRequirements', 'preparationChecklist', 'sampleApprovals', 'aftercareReferences']);
    for (const kind of ['materialRequirements', 'preparationChecklist', 'sampleApprovals', 'aftercareReferences'] as const) {
      const entries = array(resources[kind], `resources.${kind}`, PORTAL_LIMITS.resources); unique(entries, `resources.${kind}`);
      entries.forEach((value, i) => {
        const path = `resources.${kind}.${i}`, keys = kind === 'materialRequirements' ? ['kind', 'quantity', 'unit', 'sourceNote', 'notes'] : kind === 'preparationChecklist' ? ['checkedBy', 'checkedOn', 'notes'] : kind === 'sampleApprovals' ? ['approvedBy', 'approvedOn', 'sourceDocumentId', 'notes'] : ['url', 'sourceDocumentId', 'instructions'];
        const entry = object(value, path, ['id', 'label', 'scopeItemIds', 'status', ...keys]); id(entry.id, `${path}.id`); string(entry.label, `${path}.label`, 200); scopeReferences(entry.scopeItemIds, `${path}.scopeItemIds`);
        if (kind === 'materialRequirements') { enumeration(entry.kind, `${path}.kind`, ['wallcovering', 'lining', 'primer', 'adhesive', 'other']); enumeration(entry.unit, `${path}.unit`, ['unknown', 'roll', 'panel', 'linear-m', 'm2', 'litre', 'kg', 'item']); enumeration(entry.status, `${path}.status`, ['to-confirm', 'required', 'client-confirmed']); if (entry.quantity !== undefined && (typeof entry.quantity !== 'number' || !Number.isFinite(entry.quantity) || entry.quantity < 0 || entry.quantity > 10_000_000)) fail(`${path}.quantity`, 'quantity', 'Use a finite non-negative quantity up to 10,000,000.'); string(entry.sourceNote, `${path}.sourceNote`, 2000, true); }
        if (kind === 'preparationChecklist') { enumeration(entry.status, `${path}.status`, ['not-checked', 'action-required', 'ready', 'not-applicable', 'needs-review']); string(entry.checkedBy, `${path}.checkedBy`, 160, true); date(entry.checkedOn, `${path}.checkedOn`); }
        if (kind === 'sampleApprovals') { enumeration(entry.status, `${path}.status`, ['not-requested', 'requested', 'received', 'approved', 'changes-required', 'needs-review']); string(entry.approvedBy, `${path}.approvedBy`, 160, true); date(entry.approvedOn, `${path}.approvedOn`); }
        if (kind === 'aftercareReferences') { enumeration(entry.status, `${path}.status`, ['to-confirm', 'issued', 'acknowledged']); string(entry.instructions, `${path}.instructions`, 4000, true); string(entry.url, `${path}.url`, 2000, true); if (typeof entry.url === 'string' && entry.url) { try { const url = new URL(entry.url); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(); } catch { fail(`${path}.url`, 'url', 'Use an HTTP or HTTPS reference without embedded credentials.'); } } }
        if (kind === 'sampleApprovals' || kind === 'aftercareReferences') id(entry.sourceDocumentId, `${path}.sourceDocumentId`, true);
        if (kind !== 'aftercareReferences') string(entry.notes, `${path}.notes`, 2000, true);
      });
    }
  }
  const logistics = object(p.logistics, 'logistics', ['arrangement', 'vehicleDays', 'vehicleDaysConfirmed', 'deliveriesRequired', 'storageRequired', 'accessEquipmentRequired', 'wasteRemovalRequired', 'notes']); if (logistics.arrangement !== undefined) enumeration(logistics.arrangement, 'logistics.arrangement', ['daily-van', 'delivery-storage-collection', 'client-parking', 'team-travel', 'phased', 'not-established']); enumeration(logistics.vehicleDaysConfirmed, 'logistics.vehicleDaysConfirmed', [true, false]); for (const k of ['deliveriesRequired', 'storageRequired', 'accessEquipmentRequired', 'wasteRemovalRequired']) flag(logistics[k], `logistics.${k}`); string(logistics.notes, 'logistics.notes', 2000, true);
  array(logistics.vehicleDays, 'logistics.vehicleDays', PORTAL_LIMITS.vehicleDays).forEach((value, i) => { const path = `logistics.vehicleDays.${i}`, day = object(value, path, ['date', 'vehicleId', 'congestionZone', 'congestionChargeApplies', 'congestionTariff', 'ulezZone', 'ulezChargeApplies', 'ulezTariff', 'parkingRequired']); if (!isCalendarDate(day.date)) fail(`${path}.date`, 'date', 'Use a valid calendar date.'); id(day.vehicleId, `${path}.vehicleId`); for (const k of ['congestionZone', 'congestionChargeApplies', 'ulezZone', 'ulezChargeApplies', 'parkingRequired']) flag(day[k], `${path}.${k}`); for (const k of ['congestionTariff', 'ulezTariff']) if (day[k] !== undefined) enumeration(day[k], `${path}.${k}`, ['standard', 'discounted', 'unknown']); });
  return issues.length ? { ok: false, issues } : { ok: true, value: structuredClone(input) as ProjectDraft };
}

export function emptyProjectResources(): ProjectResources {
  return { materialRequirements: [], preparationChecklist: [], sampleApprovals: [], aftercareReferences: [] };
}
/** Helpful intake prompts do not make incomplete draft saves fail. Server pricing decides eligibility. */
export function draftInformationNeeded(project: ProjectDraft): { key: string; message: string; section: number }[] {
  const needs: { key: string; message: string; section: number }[] = [];
  const add = (key: string, message: string, section: number) => needs.push({ key, message, section });
  if (!project.name.trim()) add('name', 'Add a project name or reference.', 0);
  if (!project.buildingType || project.buildingType === 'unknown') add('building', 'Confirm the building type.', 0);
  if (!project.address.line1.trim() || !project.address.postcode.trim()) add('address', 'Complete the site address and postcode.', 0);
  if (!project.contact.name.trim() || !project.contact.email.trim()) add('contact', 'Add the contact name and reply email.', 0);
  if (!project.items.length) add('scope', 'Add at least one room and measured scope.', 1);
  project.items.forEach(item => {
    const label = `${project.rooms.find(room => room.id === item.roomId)?.label || 'Unnamed room'} · ${item.label || 'Unnamed scope'}`;
    if (item.surfaceKind === 'unknown') add(`${item.id}-surface`, `${label}: confirm whether this is wall or ceiling work.`, 1);
    const faces = item.surfaceKind === 'ceiling' ? item.ceilings || [] : item.walls;
    if (!faces.length || faces.some(face => !face.widthMm || !('lengthMm' in face ? face.lengthMm : face.heightMm))) add(`${item.id}-dimensions`, `${label}: enter measured covered dimensions; no scale or height is assumed.`, 1);
    if (!hasCompleteScopeGeometry(item) && faces.length && faces.every(face => face.widthMm > 0 && ('lengthMm' in face ? face.lengthMm : face.heightMm) > 0)) add(`${item.id}-parts`, `${label}: measure every listed uncovered opening and covered reveal, or remove entries that are outside the scope. Zero-sized rectangles cannot be priced.`, 1);
    if (!item.confirmedMeasurements) add(`${item.id}-confirmation`, `${label}: check the dimensions and deductions against current drawings or site measurements.`, 1);
    if (!item.material.productId && !item.material.productCode?.trim() && !item.material.verifiedTypeId) add(`${item.id}-product`, `${label}: identify the product or installation type for review.`, 1);
    if (item.preparation === 'unknown' || item.access === 'unknown') add(`${item.id}-site`, `${label}: confirm preparation and working access.`, 1);
  });
  const readiness = project.programme.materialReadiness;
  if (!readiness || readiness.status === 'unknown') add('readiness', 'Confirm material readiness or record what is outstanding.', 2);
  else if (!['delivered', 'checked-ready'].includes(readiness.status) && !readiness.readyDate) add('readiness-date', 'Add the expected material-ready date, or leave readiness awaiting review.', 2);
  else if (readiness.scopeItemIds.length && readiness.scopeItemIds.length < project.items.length) add('readiness-coverage', 'Material readiness covers selected scopes only; the remaining scopes need review.', 2);
  if (readiness?.readyDate && project.programme.startDate && readiness.readyDate > project.programme.startDate) add('readiness-programme', 'Materials are expected after the target start. Review the programme.', 2);
  const resources = project.resources;
  resources?.materialRequirements.forEach(entry => { if (entry.status !== 'client-confirmed' || !entry.quantity || entry.unit === 'unknown' || !entry.sourceNote?.trim()) add(`resource-${entry.id}`, `${entry.label || 'Material requirement'}: confirm the quantity source, unit and client supply arrangement.`, 5); });
  resources?.preparationChecklist.forEach(entry => { if (!['ready', 'not-applicable'].includes(entry.status) || !entry.checkedBy?.trim() || !entry.checkedOn) add(`resource-${entry.id}`, `${entry.label || 'Preparation check'}: ${entry.status === 'action-required' ? 'action is still required' : 'readiness needs checking'}.`, 5); });
  resources?.sampleApprovals.forEach(entry => { if (entry.status !== 'approved' || !entry.approvedBy || !entry.approvedOn) add(`resource-${entry.id}`, `${entry.label || 'Sample'}: record the approval and who approved it.`, 5); });
  resources?.aftercareReferences.forEach(entry => { if (entry.status === 'to-confirm' || !entry.url && !entry.sourceDocumentId && !entry.instructions?.trim()) add(`resource-${entry.id}`, `${entry.label || 'Aftercare reference'}: attach the product-specific instructions or reference.`, 5); });
  return needs;
}
