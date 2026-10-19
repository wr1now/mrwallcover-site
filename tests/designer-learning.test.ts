import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseActualWork, comparePilot, validateActualWork, validateHistoricalScope, validatePilotInput } from '../server/designer-portal/learning.ts';
import { emptyProjectDraft } from '../src/designer-portal/validation.ts';
import { createDefaultPricingConfig } from '../server/designer-portal/defaults.ts';
import type { ActualWork, HistoricalScope, PilotInput } from '../server/designer-portal/learning.ts';
import type { EstimateSnapshot } from '../src/designer-portal/types.ts';

const today = '2026-10-18';
const project = { ...emptyProjectDraft(), items: [{ id: 'scope-one' }] } as ReturnType<typeof emptyProjectDraft>;
const work = (): ActualWork => ({ completedOn: today, installationDates: ['2026-10-14', '2026-10-15', '2026-10-16'], labour: [{ id: 'time-one', category: 'installation', label: 'Two hangers, person-time combined', minutes: 960, itemId: 'scope-one' }], vehicles: [{ date: '2026-10-14', vehicleId: 'van', costsConfirmed: false }, { date: '2026-10-16', vehicleId: 'van', costsConfirmed: false }] });
const history = (): HistoricalScope => ({ externalRef: 'synthetic-old-scope', title: 'Synthetic source, not a live selling rate', classification: 'mixed-schedule', source: { fileName: 'synthetic-old-schedule.xlsx', sha256: 'a'.repeat(64), reviewedOn: today, locations: [{ sheet: 'Scope', range: 'B8:F12' }] }, scopeNotes: 'Separate hanging, lining and delivery scope', quantityBasis: 'm2/person-day/item', amounts: [{ label: 'Historical selling total', valuePence: 10000, role: 'selling', locationIndex: 0 }, { label: 'Worker cost', valuePence: 4000, role: 'worker-cost', locationIndex: 0 }, { label: 'Repeated total, exclude', valuePence: 10000, role: 'duplicate-total', locationIndex: 0 }, { label: 'Alternative A', valuePence: 9000, role: 'alternative', alternativeGroup: 'same-scope', locationIndex: 0 }], warnings: ['Historical amounts do not approve a current rate.'] });
const pilot = (): PilotInput => ({ referenceLabel: 'Independent current-price comparison', preparedOn: today, priceBasis: 'current-owner-prices', independentlyPrepared: true, scopeChecked: true, expectedLines: [{ label: 'Installation', category: 'installation', amountPence: 10000 }, { label: 'Logistics', category: 'logistics', amountPence: 2000 }], vatRateBps: 2000, tolerancePence: 0, note: 'Synthetic calibration fixture only.' });
const snapshot = (): EstimateSnapshot => ({ schemaVersion: 1, id: 'example', projectId: 'project', projectRevision: 1, configVersion: 'v1', createdAt: today, validUntil: '2026-11-17', status: 'ready', currency: 'GBP', lines: [{ id: 'install', label: 'Installation', category: 'installation', quantity: 1, unit: 'item', amountPence: 10000, inclusion: 'Labour' }, { id: 'travel', label: 'Logistics', category: 'logistics', quantity: 2, unit: 'vehicle-day', amountPence: 2000, inclusion: 'Two actual visits' }], subtotalPence: 12000, vatRateBps: 2000, vatPence: 2400, totalPence: 14400, vatStatus: 'exclusive', reviewReasons: [], assumptions: [], project: { ...project, logistics: { ...project.logistics, vehicleDays: [] } } });

test('completed work separates installation dates, person-minutes and actual vehicle attendance without guessing costs', () => {
  const input = validateActualWork(work(), project, today), analysis = analyseActualWork(input, snapshot(), null);
  assert.equal(analysis.actualInstallationDays, 3); assert.equal(analysis.actualVehicleDays, 2); assert.equal(analysis.personMinutes.installation, 960);
  assert.equal(analysis.vehicleCostPence, null); assert.equal(analysis.vehicleCostsComplete, false); assert.equal(analysis.rateChangesApplied, false);
  assert.equal(analysis.quotedPackageLabourMinutes, null, 'Selling m² prices do not imply a worker time allowance.');
});
test('actual records reject duplicate vehicle days, foreign scope, future completion and incomplete confirmed costs', () => {
  for (const mutate of [(value: ActualWork) => value.vehicles.push(value.vehicles[0]), (value: ActualWork) => { value.labour[0].itemId = 'another-project'; }, (value: ActualWork) => { value.completedOn = '2027-01-01'; }, (value: ActualWork) => { value.vehicles[0].costsConfirmed = true; }]) { const value = work(); mutate(value); assert.throws(() => validateActualWork(value, project, today)); }
  const value = work(); value.vehicles = [{ date: '2026-10-14', vehicleId: 'van', costsConfirmed: true, parkingPence: 0, congestionPence: 1800, ulezPence: 0, deliveryPence: 5000, storagePence: 0 }]; assert.equal(analyseActualWork(validateActualWork(value, project, today), null, null).vehicleCostPence, 6800);
});
test('feedback compares exact package identities from the issued rate version and never matches by label', () => {
  const config = createDefaultPricingConfig(); config.version = 'v1'; config.packages = [{ id: 'approved-package', label: 'Example package', approved: true, pricePence: 80000, scopeKind: 'single_room', profileIds: ['standard-fabric'], maxNetAreaMm2: 12000000, inclusion: 'Synthetic labour scope', setupPence: 0, labourHours: 8, labourRatePencePerHour: 10000, surveyAllowancePence: 0, managementAllowancePence: 0, maxWallHeightMm: 3000, maxWalls: 4, maxOpenings: 4 }];
  const estimate = snapshot(); estimate.lines = [{ ...estimate.lines[0], category: 'package', packageTemplateId: 'approved-package' }];
  const analysis = analyseActualWork(work(), estimate, config); assert.equal(analysis.quotedPackageLabourMinutes, 480); assert.equal(analysis.packageLabourVarianceMinutes, 480); assert.ok(analysis.suggestions.some(value => value.includes('package labour allowance')));
  delete estimate.lines[0].packageTemplateId; estimate.lines[0].label = 'Example package'; assert.equal(analyseActualWork(work(), estimate, config).quotedPackageLabourMinutes, null);
  estimate.lines[0].packageTemplateId = 'approved-package'; config.version = 'v2'; assert.equal(analyseActualWork(work(), estimate, config).quotedPackageLabourMinutes, null);
});
test('historical import preserves selling/cost/alternative/duplicate roles with exact source provenance', () => {
  const value = validateHistoricalScope(history()); assert.equal(value.amounts.length, 4); assert.equal(value.amounts[1].role, 'worker-cost'); assert.equal(value.amounts[2].role, 'duplicate-total'); assert.equal(value.source.locations[0].range, 'B8:F12');
  for (const mutate of [(value: HistoricalScope) => { value.source.sha256 = ''; }, (value: HistoricalScope) => { value.source.locations = []; }, (value: HistoricalScope) => { value.amounts[0].locationIndex = 9; }, (value: HistoricalScope) => { delete value.amounts[3].alternativeGroup; }, (value: HistoricalScope) => { value.classification = 'worker-cost'; }]) { const value = history(); mutate(value); assert.throws(() => validateHistoricalScope(value)); }
  const unpriced = history(); unpriced.classification = 'unpriced-schedule'; unpriced.amounts = [{ label: 'Unpriced hanging', valuePence: null, role: 'unpriced', locationIndex: 0 }]; assert.equal(validateHistoricalScope(unpriced).amounts[0].valuePence, null); unpriced.amounts[0].valuePence = 0; assert.throws(() => validateHistoricalScope(unpriced));
});
test('pilot compares independent current totals, VAT and categories without netting offsetting scope errors', () => {
  const input = validatePilotInput(pilot(), today), estimate = snapshot(); assert.equal(comparePilot(input, estimate).status, 'matching');
  estimate.lines[0].amountPence += 1000; estimate.lines[1].amountPence -= 1000;
  const comparison = comparePilot(input, estimate); assert.equal(comparison.differences.totalPence, 0); assert.equal(comparison.withinTolerance, false); assert.equal(comparison.rateChangesApplied, false);
  const invalid: any = pilot(); invalid.independentlyPrepared = false; assert.throws(() => validatePilotInput(invalid, today)); invalid.independentlyPrepared = true; invalid.priceBasis = 'historical-quotation'; assert.throws(() => validatePilotInput(invalid, today));
});
