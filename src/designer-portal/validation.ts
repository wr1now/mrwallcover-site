import type { ProjectDraft, ScopeItem, ValidationIssue, ValidationResult } from './types.ts';

export const PORTAL_LIMITS = Object.freeze({ rooms: 50, items: 200, walls: 100, openings: 100, vehicleDays: 366, widthMm: 100_000, heightMm: 30_000, count: 100, itemNetMm2: 100_000_000_000, projectNetMm2: 250_000_000_000 });
const groups = ['printed-paper', 'printed-nonwoven', 'vinyl-coated-paper', 'domestic-vinyl', 'wide-contract-vinyl', 'standard-fabric', 'velvet-flock-pile', 'formed-acoustic', 'specialists'];
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value && value >= '2020-01-01' && value <= '2100-12-31';
}
export function measureScopeArea(item: ScopeItem) {
  let grossMm2 = 0, openingsMm2 = 0, revealsMm2 = 0;
  for (const wall of item.walls) {
    grossMm2 += wall.widthMm * wall.heightMm * wall.count;
    openingsMm2 += wall.openings.reduce((sum, x) => sum + x.widthMm * x.heightMm * x.count, 0) * wall.count;
    revealsMm2 += wall.reveals.reduce((sum, x) => sum + x.widthMm * x.heightMm * x.count, 0) * wall.count;
  }
  const netMm2 = grossMm2 - openingsMm2 + revealsMm2;
  return { grossMm2, openingsMm2, revealsMm2, netMm2, netM2: netMm2 / 1_000_000 };
}
export function emptyProjectDraft(): ProjectDraft {
  return { schemaVersion: 1, name: '', rooms: [], items: [], contact: { name: '', email: '' }, address: { line1: '', town: '', postcode: '', country: 'UK' }, programme: { occupied: 'unknown', outOfHours: 'unknown', phases: 1 }, logistics: { vehicleDays: [], vehicleDaysConfirmed: false, deliveriesRequired: 'unknown', storageRequired: 'unknown', accessEquipmentRequired: 'unknown', wasteRemovalRequired: 'unknown', notes: '' } };
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
  const p = object(input, 'project', ['schemaVersion', 'id', 'name', 'rooms', 'items', 'contact', 'address', 'propertyValuePence', 'programme', 'logistics']);
  enumeration(p.schemaVersion, 'schemaVersion', [1]); id(p.id, 'id', true); string(p.name, 'name'); integer(p.propertyValuePence, 'propertyValuePence', 0, 10_000_000_000_000, true);
  const rooms = array(p.rooms, 'rooms', PORTAL_LIMITS.rooms); unique(rooms, 'rooms');
  rooms.forEach((value, i) => { const path = `rooms.${i}`, room = object(value, path, ['id', 'label', 'floor']); id(room.id, `${path}.id`); string(room.label, `${path}.label`); string(room.floor, `${path}.floor`, 80); });
  const roomIds = new Set(rooms.map(x => (x as Record<string, unknown>)?.id));
  const items = array(p.items, 'items', PORTAL_LIMITS.items); unique(items, 'items');
  let totalArea = 0;
  items.forEach((value, i) => {
    const path = `items.${i}`, item = object(value, path, ['id', 'roomId', 'label', 'scopeKind', 'confirmedMeasurements', 'walls', 'material', 'preparation', 'access', 'packageId']);
    id(item.id, `${path}.id`); id(item.roomId, `${path}.roomId`); if (!roomIds.has(item.roomId)) fail(`${path}.roomId`, 'room', 'Choose an existing room.'); string(item.label, `${path}.label`); id(item.packageId, `${path}.packageId`, true);
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
    if (issues.length === 0) { const area = measureScopeArea(item as unknown as ScopeItem); if (!Number.isSafeInteger(area.netMm2) || area.netMm2 < 0 || area.netMm2 > PORTAL_LIMITS.itemNetMm2) fail(path, 'area', 'The item area exceeds the supported range.'); totalArea += area.netMm2; }
  });
  if (totalArea > PORTAL_LIMITS.projectNetMm2) fail('items', 'project-area', 'The project area exceeds the supported range.');
  const contact = object(p.contact, 'contact', ['name', 'email', 'phone', 'company']); string(contact.name, 'contact.name'); string(contact.email, 'contact.email', 254); if (typeof contact.email === 'string' && contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) fail('contact.email', 'email', 'Use a valid email address.'); string(contact.phone, 'contact.phone', 40, true); string(contact.company, 'contact.company', 160, true);
  const address = object(p.address, 'address', ['line1', 'line2', 'town', 'postcode', 'country']); for (const key of ['line1', 'town']) string(address[key], `address.${key}`, 200); string(address.line2, 'address.line2', 200, true); string(address.postcode, 'address.postcode', 20); string(address.country, 'address.country', 80);
  const programme = object(p.programme, 'programme', ['startDate', 'endDate', 'occupied', 'outOfHours', 'phases', 'notes']); date(programme.startDate, 'programme.startDate'); date(programme.endDate, 'programme.endDate'); if (typeof programme.startDate === 'string' && typeof programme.endDate === 'string' && programme.endDate < programme.startDate) fail('programme.endDate', 'date-order', 'The end date must follow the start date.'); flag(programme.occupied, 'programme.occupied'); flag(programme.outOfHours, 'programme.outOfHours'); integer(programme.phases, 'programme.phases', 1, 100); string(programme.notes, 'programme.notes', 2000, true);
  const logistics = object(p.logistics, 'logistics', ['arrangement', 'vehicleDays', 'vehicleDaysConfirmed', 'deliveriesRequired', 'storageRequired', 'accessEquipmentRequired', 'wasteRemovalRequired', 'notes']); if (logistics.arrangement !== undefined) enumeration(logistics.arrangement, 'logistics.arrangement', ['daily-van', 'delivery-storage-collection', 'client-parking', 'team-travel', 'phased', 'not-established']); enumeration(logistics.vehicleDaysConfirmed, 'logistics.vehicleDaysConfirmed', [true, false]); for (const k of ['deliveriesRequired', 'storageRequired', 'accessEquipmentRequired', 'wasteRemovalRequired']) flag(logistics[k], `logistics.${k}`); string(logistics.notes, 'logistics.notes', 2000, true);
  array(logistics.vehicleDays, 'logistics.vehicleDays', PORTAL_LIMITS.vehicleDays).forEach((value, i) => { const path = `logistics.vehicleDays.${i}`, day = object(value, path, ['date', 'vehicleId', 'congestionZone', 'congestionChargeApplies', 'congestionTariff', 'ulezZone', 'ulezChargeApplies', 'ulezTariff', 'parkingRequired']); if (!isCalendarDate(day.date)) fail(`${path}.date`, 'date', 'Use a valid calendar date.'); id(day.vehicleId, `${path}.vehicleId`); for (const k of ['congestionZone', 'congestionChargeApplies', 'ulezZone', 'ulezChargeApplies', 'parkingRequired']) flag(day[k], `${path}.${k}`); for (const k of ['congestionTariff', 'ulezTariff']) if (day[k] !== undefined) enumeration(day[k], `${path}.${k}`, ['standard', 'discounted', 'unknown']); });
  return issues.length ? { ok: false, issues } : { ok: true, value: structuredClone(input) as ProjectDraft };
}
