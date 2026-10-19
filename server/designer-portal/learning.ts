/** Private operational evidence. Observations never set or approve selling prices. */
import { isCalendarDate } from '../../src/designer-portal/validation.ts';
import type { EstimateSnapshot, ProjectDraft } from '../../src/designer-portal/types.ts';
import type { PricingConfig } from './pricing.ts';

export interface LabourObservation { id: string; category: 'installation' | 'preparation' | 'survey' | 'management'; label: string; minutes: number; itemId?: string }
export interface VehicleObservation { date: string; vehicleId: string; costsConfirmed: boolean; parkingPence?: number; congestionPence?: number; ulezPence?: number; deliveryPence?: number; storagePence?: number; notes?: string }
export interface ActualWork { completedOn: string; installationDates: string[]; labour: LabourObservation[]; vehicles: VehicleObservation[]; notes?: string }
export interface HistoricalScope {
  externalRef: string; title: string; classification: 'selling-quotation' | 'worker-cost' | 'unpriced-schedule' | 'mixed-schedule';
  source: { fileName: string; sha256: string; reviewedOn: string; locations: { sheet?: string; range?: string; page?: number; note?: string }[] };
  scopeNotes: string; quantityBasis: string;
  amounts: { label: string; valuePence: number | null; role: 'selling' | 'worker-cost' | 'subtotal' | 'total' | 'alternative' | 'unpriced' | 'duplicate-total'; locationIndex: number; alternativeGroup?: string }[];
  warnings: string[];
}
export interface PilotInput {
  referenceLabel: string; preparedOn: string; priceBasis: 'current-owner-prices'; independentlyPrepared: true; scopeChecked: true;
  expectedLines: { label: string; category: string; amountPence: number }[];
  vatRateBps: number; tolerancePence: number; note: string; sourceDocumentId?: string;
}
export class ObservationError extends Error {}
const fail = (message: string): never => { throw new ObservationError(message); };
const obj = (value: unknown, keys: string[]) => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('An evidence object is required.'); const row = value as Record<string, any>; if (Object.keys(row).some(key => !keys.includes(key))) fail('Unexpected operational evidence field.'); return row; };
const text = (value: unknown, limit: number, optional = false): string | undefined => { if (value === undefined && optional) return undefined; if (typeof value !== 'string' || value.length > limit || (!optional && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return fail('Use bounded, plain text for operational evidence.'); return value.trim(); };
const count = (value: unknown, maximum: number) => { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) fail('Use a nonnegative whole-number quantity within the supported limit.'); return Number(value); };
const list = (value: unknown, maximum: number): any[] => { if (!Array.isArray(value) || value.length > maximum) return fail('The evidence list exceeds its supported limit.'); return value; };
const date = (value: unknown) => { if (!isCalendarDate(value)) fail('Use a real calendar date for operational evidence.'); return String(value); };
const identifier = (value: unknown): string => { const result = text(value, 100)!; if (!/^[a-zA-Z0-9_-]+$/.test(result)) fail('Use a valid evidence identifier.'); return result; };
const unique = (values: string[]) => { if (new Set(values).size !== values.length) fail('Duplicate operational evidence identifiers are not permitted.'); };

export function validateActualWork(raw: unknown, project: ProjectDraft, today: string): ActualWork {
  const value = obj(raw, ['completedOn', 'installationDates', 'labour', 'vehicles', 'notes']);
  const completedOn = date(value.completedOn); if (completedOn > today) fail('Completion cannot be in the future.');
  const installationDates = list(value.installationDates, 730).map(date); unique(installationDates);
  if (!installationDates.length || installationDates.some(day => day > completedOn)) fail('Record actual installation dates no later than completion.');
  const itemIds = new Set(project.items.map(item => item.id));
  const labour = list(value.labour, 500).map(raw => { const row = obj(raw, ['id', 'category', 'label', 'minutes', 'itemId']); if (!['installation', 'preparation', 'survey', 'management'].includes(row.category)) fail('Choose a supported labour category.'); const itemId = row.itemId === undefined ? undefined : identifier(row.itemId); if (itemId && !itemIds.has(itemId)) fail('The labour entry refers to a different project scope.'); return { id: identifier(row.id), category: row.category, label: text(row.label, 200)!, minutes: count(row.minutes, 10_000_000), ...(itemId ? { itemId } : {}) } as LabourObservation; });
  unique(labour.map(row => row.id)); if (!labour.some(row => row.category === 'installation' && row.minutes > 0)) fail('Record positive actual installation person-minutes.');
  const moneyKeys = ['parkingPence', 'congestionPence', 'ulezPence', 'deliveryPence', 'storagePence'] as const;
  const vehicles = list(value.vehicles, 1000).map(raw => { const row = obj(raw, ['date', 'vehicleId', 'costsConfirmed', ...moneyKeys, 'notes']); const day = date(row.date); if (day > completedOn) fail('Actual vehicle attendance cannot be after completion.'); if (typeof row.costsConfirmed !== 'boolean') fail('Confirm whether all vehicle costs are known.'); const costs: Partial<VehicleObservation> = {}; for (const key of moneyKeys) { if (row[key] !== undefined) costs[key] = count(row[key], 1_000_000_000); else if (row.costsConfirmed) fail('Confirmed vehicle costs need each amount, including an explicit zero.'); } const notes = text(row.notes, 1000, true); return { date: day, vehicleId: identifier(row.vehicleId), costsConfirmed: row.costsConfirmed, ...costs, ...(notes ? { notes } : {}) }; });
  unique(vehicles.map(row => `${row.date}/${row.vehicleId}`));
  const notes = text(value.notes, 4000, true);
  return { completedOn, installationDates, labour, vehicles, ...(notes ? { notes } : {}) };
}

export function validateHistoricalScope(raw: unknown): HistoricalScope {
  const row = obj(raw, ['externalRef', 'title', 'classification', 'source', 'scopeNotes', 'quantityBasis', 'amounts', 'warnings']);
  if (!['selling-quotation', 'worker-cost', 'unpriced-schedule', 'mixed-schedule'].includes(row.classification)) fail('Classify the historical source before import.');
  const source = obj(row.source, ['fileName', 'sha256', 'reviewedOn', 'locations']);
  const fileName = text(source.fileName, 240)!; if (/[\\/]/.test(fileName)) fail('Use the source file name, not an absolute archive path.');
  if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)) fail('A verified source-file SHA-256 is required.');
  const locations = list(source.locations, 100).map(raw => { const location = obj(raw, ['sheet', 'range', 'page', 'note']); const sheet = text(location.sheet, 120, true), range = text(location.range, 120, true), note = text(location.note, 500, true); const page = location.page === undefined ? undefined : count(location.page, 100000); if (!range && !page) fail('Every historical citation needs a sheet/cell range or page.'); if (page === 0) fail('PDF page references start at one.'); return { ...(sheet ? { sheet } : {}), ...(range ? { range } : {}), ...(page ? { page } : {}), ...(note ? { note } : {}) }; });
  if (!locations.length) fail('Historical scope requires original source provenance.');
  const roles = ['selling', 'worker-cost', 'subtotal', 'total', 'alternative', 'unpriced', 'duplicate-total'];
  const amounts = list(row.amounts, 500).map(raw => { const amount = obj(raw, ['label', 'valuePence', 'role', 'locationIndex', 'alternativeGroup']); if (!roles.includes(amount.role)) fail('Historical amounts must distinguish selling, worker costs, alternatives and totals.'); const locationIndex = count(amount.locationIndex, locations.length - 1); const valuePence = amount.valuePence === null ? null : count(amount.valuePence, 1_000_000_000_000); if (amount.role === 'unpriced' && valuePence !== null) fail('Unpriced values stay null, never an inferred zero.'); const alternativeGroup = text(amount.alternativeGroup, 100, true); if (amount.role === 'alternative' && !alternativeGroup) fail('Identify alternative prices so they cannot be added together.'); return { label: text(amount.label, 200)!, valuePence, role: amount.role, locationIndex, ...(alternativeGroup ? { alternativeGroup } : {}) }; });
  if (row.classification === 'unpriced-schedule' && amounts.some(amount => amount.role !== 'unpriced')) fail('An unpriced schedule cannot be imported as populated selling amounts.');
  if (row.classification === 'worker-cost' && amounts.some(amount => amount.role === 'selling')) fail('Worker payments cannot be classified as selling prices.');
  return { externalRef: identifier(row.externalRef), title: text(row.title, 200)!, classification: row.classification, source: { fileName, sha256: source.sha256, reviewedOn: date(source.reviewedOn), locations }, scopeNotes: text(row.scopeNotes, 4000)!, quantityBasis: text(row.quantityBasis, 200)!, amounts, warnings: list(row.warnings, 50).map(value => text(value, 500)!) };
}

/** Compare only known allowances; area selling rates cannot reveal assumed worker time. */
export function analyseActualWork(actual: ActualWork, snapshot: EstimateSnapshot | null, config: PricingConfig | null) {
  const minutes = { installation: 0, preparation: 0, survey: 0, management: 0 }; for (const row of actual.labour) minutes[row.category] += row.minutes;
  const quotedDays = new Set(snapshot?.project.logistics.vehicleDays.map(day => `${day.date}/${day.vehicleId}`) || []);
  const actualDays = new Set(actual.vehicles.map(day => `${day.date}/${day.vehicleId}`));
  const packageLines = snapshot?.lines.filter(line => line.category === 'package') || [];
  const reviewedPackages = snapshot && config && snapshot.configVersion === config.version && !snapshot.lines.some(line => line.category === 'installation') ? packageLines.map(line => config.packages.find(pack => pack.id === line.packageTemplateId)) : [];
  const packageMinutes = reviewedPackages.length && reviewedPackages.every(pack => pack?.labourHours !== undefined) ? reviewedPackages.reduce((sum, pack) => sum + pack!.labourHours! * 60, 0) : null;
  const completeVehicleCosts = actual.vehicles.every(day => day.costsConfirmed);
  const vehicleCostPence = completeVehicleCosts ? actual.vehicles.reduce((sum, day) => sum + (day.parkingPence ?? 0) + (day.congestionPence ?? 0) + (day.ulezPence ?? 0) + (day.deliveryPence ?? 0) + (day.storagePence ?? 0), 0) : null;
  const suggestions: string[] = [];
  if (packageMinutes !== null && minutes.installation + minutes.preparation > packageMinutes) suggestions.push('Actual installation/preparation person-time exceeded the quoted package labour allowance. Review package hours and scope limits.');
  if (snapshot && actualDays.size !== quotedDays.size) suggestions.push('Actual vehicle attendance differed from the estimate. Review delivery/storage planning and the project logistics allowance.');
  if (minutes.survey || minutes.management) suggestions.push('Review actual survey and management person-time against the approved project service plan.');
  return { personMinutes: minutes, actualInstallationDays: actual.installationDates.length, actualVehicleDays: actualDays.size, quotedVehicleDays: snapshot ? quotedDays.size : null, quotedPackageLabourMinutes: packageMinutes, packageLabourVarianceMinutes: packageMinutes === null ? null : minutes.installation + minutes.preparation - packageMinutes, vehicleCostPence, vehicleCostsComplete: completeVehicleCosts, suggestions, rateChangesApplied: false as const };
}

export function validatePilotInput(raw: unknown, today: string): PilotInput {
  const row = obj(raw, ['referenceLabel', 'preparedOn', 'priceBasis', 'independentlyPrepared', 'scopeChecked', 'expectedLines', 'vatRateBps', 'tolerancePence', 'note', 'sourceDocumentId']);
  if (row.priceBasis !== 'current-owner-prices' || row.independentlyPrepared !== true || row.scopeChecked !== true) fail('Confirm independently prepared current prices and the matching project scope.');
  const preparedOn = date(row.preparedOn); if (preparedOn > today) fail('The owner comparison cannot be dated in the future.');
  const expectedLines = list(row.expectedLines, 500).map(raw => { const line = obj(raw, ['label', 'category', 'amountPence']); if (!['installation', 'package', 'preparation', 'survey', 'management', 'logistics'].includes(line.category)) fail('Use a project labour/service category, with client materials excluded.'); return { label: text(line.label, 200)!, category: line.category, amountPence: count(line.amountPence, 1_000_000_000_000) }; });
  if (!expectedLines.length || !expectedLines.some(line => line.amountPence > 0)) fail('Enter the independently prepared current-price breakdown.');
  const vatRateBps = count(row.vatRateBps, 10000), tolerancePence = count(row.tolerancePence, 1000000);
  const sourceDocumentId = row.sourceDocumentId === undefined ? undefined : text(row.sourceDocumentId, 100);
  if (sourceDocumentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceDocumentId)) fail('Use a saved project document as the comparison source.');
  return { referenceLabel: text(row.referenceLabel, 200)!, preparedOn, priceBasis: 'current-owner-prices', independentlyPrepared: true, scopeChecked: true, expectedLines, vatRateBps, tolerancePence, note: text(row.note, 4000)!, ...(sourceDocumentId ? { sourceDocumentId } : {}) };
}

export function comparePilot(input: PilotInput, estimate: EstimateSnapshot) {
  if (estimate.status !== 'ready' || estimate.totalPence === null || estimate.vatPence === null) fail('Only a complete issued budget can be compared.');
  const subtotalPence = input.expectedLines.reduce((sum, line) => sum + line.amountPence, 0);
  if (!Number.isSafeInteger(subtotalPence)) fail('The expected total exceeds the supported range.');
  const vatPence = Number((BigInt(subtotalPence) * BigInt(input.vatRateBps) + 5000n) / 10000n), totalPence = subtotalPence + vatPence;
  const categories = ['installation', 'package', 'preparation', 'survey', 'management', 'logistics'];
  const byCategory = categories.map(category => { const expectedPence = input.expectedLines.filter(line => line.category === category).reduce((sum, line) => sum + line.amountPence, 0), calculatedPence = estimate.lines.filter(line => line.category === category).reduce((sum, line) => sum + line.amountPence, 0); return { category, expectedPence, calculatedPence, differencePence: calculatedPence - expectedPence }; });
  const differences = { subtotalPence: estimate.subtotalPence - subtotalPence, vatPence: estimate.vatPence! - vatPence, totalPence: estimate.totalPence! - totalPence };
  const withinTolerance = input.vatRateBps === estimate.vatRateBps && Object.values(differences).every(value => Math.abs(value) <= input.tolerancePence) && byCategory.every(row => Math.abs(row.differencePence) <= input.tolerancePence);
  return { expected: { subtotalPence, vatRateBps: input.vatRateBps, vatPence, totalPence }, calculated: { subtotalPence: estimate.subtotalPence, vatRateBps: estimate.vatRateBps, vatPence: estimate.vatPence, totalPence: estimate.totalPence }, byCategory, differences, withinTolerance, status: withinTolerance ? 'matching' : 'review-required', rateChangesApplied: false };
}
