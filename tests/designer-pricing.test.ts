import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PUBLIC_PRICE_GROUPS, PUBLIC_PRODUCTS } from '../src/designer-portal/catalog.ts';
import type { MaterialGroupId, ProjectDraft, ScopeItem } from '../src/designer-portal/types.ts';
import { emptyProjectDraft, measureScopeArea, validateProjectDraft } from '../src/designer-portal/validation.ts';
import { createDefaultPricingConfig } from '../server/designer-portal/defaults.ts';
import { computeApprovalScope, createEstimate, getPublicProductCatalog, priceAreaPence, toSharedEstimate, validatePricingConfig } from '../server/designer-portal/pricing.ts';
import type { PricingConfig } from '../server/designer-portal/pricing.ts';

const context = { id: 'estimate-test', projectId: 'project-test', projectRevision: 1, createdAt: '2026-10-18T12:00:00.000Z' };
function item(id = 'item-1', roomId = 'room-1'): ScopeItem {
  return { id, roomId, label: 'Wallcovering', scopeKind: 'multiple_rooms', confirmedMeasurements: true, walls: [{ id: 'wall-1', widthMm: 4000, heightMm: 2500, count: 1, openings: [], reveals: [] }], material: { groupId: 'standard-fabric', verifiedTypeId: 'standard-fabric', clientProvided: true, acoustic: 'no', velvet: 'no', specialist: 'no' }, preparation: 'normal-prep-lining-hanging', access: 'standard' };
}
function project(): ProjectDraft {
  return { ...emptyProjectDraft(), name: 'Example design project', buildingType: 'private-home', rooms: [{ id: 'room-1', label: 'Living room', floor: 'Ground' }, { id: 'room-2', label: 'Study', floor: 'First' }], items: [item(), item('item-2', 'room-2')], contact: { name: 'Example designer', email: 'designer@example.invalid', phone: '0000000000' }, address: { line1: 'Example site', town: 'London', postcode: 'TEST', country: 'UK' }, programme: { startDate: '2026-11-01', endDate: '2026-11-06', materialReadiness: { status: 'ordered', readyDate: '2026-10-30', scopeItemIds: [] }, occupied: 'no', outOfHours: 'no', phases: 1 }, logistics: { vehicleDays: [], vehicleDaysConfirmed: true, deliveriesRequired: 'no', storageRequired: 'no', accessEquipmentRequired: 'no', wasteRemovalRequired: 'no' } };
}
function config(): PricingConfig {
  const c = createDefaultPricingConfig();
  c.logistics.congestionEffectiveUntil = '2026-12-31'; c.logistics.ulezEffectiveUntil = '2026-12-31'; // Synthetic approved test window.
  c.servicePlans.push({ id: 'service-plan', projectId: context.projectId, projectRevision: 1, approved: true, programmeReviewed: true, propertyContextReviewed: true, managementHours: 0, surveyHours: 0, parking: [] });
  return c;
}
test('public catalogue has nine groups, only two qualified guide prices and a review-only Arte product', () => {
  assert.equal(PUBLIC_PRICE_GROUPS.length, 9);
  assert.deepEqual(PUBLIC_PRICE_GROUPS.flatMap(g => g.priceGuide ? [g.priceGuide.amountPence] : []), [2600, 12000]);
  assert.match(PUBLIC_PRICE_GROUPS.find(g => g.id === 'standard-fabric')!.priceGuide!.qualification, /lining, adhesives and primers/);
  assert.match(PUBLIC_PRODUCTS[0].notes!, /thickness is not established/);
});
test('draft validation rejects price injection, unsafe money, bad dates and duplicate identifiers', () => {
  for (const mutate of [
    (p: any) => { p.ratePence = 1; },
    (p: any) => { p.propertyValuePence = Number.MAX_SAFE_INTEGER + 1; },
    (p: any) => { p.programme.startDate = '2026-02-30'; },
    (p: any) => { p.items[1].id = p.items[0].id; },
    (p: any) => { p.items[0].material.discount = 90; },
    (p: any) => { p.logistics.vehicleDays = [{ date: '2026-11-01', vehicleId: 'v', parkingPence: 1 }]; },
  ]) { const p = project(); mutate(p); assert.equal(validateProjectDraft(p).ok, false); }
  assert.equal(validateProjectDraft(emptyProjectDraft()).ok, true);
});
test('area uses integer millimetres, deducts openings and adds reveals once per repeated wall', () => {
  const i = item(); i.walls[0] = { id: 'w', widthMm: 4000, heightMm: 3000, count: 2, openings: [{ id: 'door', widthMm: 1000, heightMm: 2000, count: 1 }], reveals: [{ id: 'return', widthMm: 300, heightMm: 2000, count: 1 }] };
  assert.deepEqual(measureScopeArea(i), { grossMm2: 24_000_000, openingsMm2: 4_000_000, revealsMm2: 1_200_000, netMm2: 21_200_000, netM2: 21.2 });
  assert.equal(priceAreaPence(21_200_000, 12000), 254400);
  assert.equal(priceAreaPence(500000, 1), 1);
});
test('impossible openings, negative values, fractional millimetres and excessive areas are rejected', () => {
  for (const mutate of [(p: ProjectDraft) => { p.items[0].walls[0].openings = [{ id: 'bad', widthMm: 5000, heightMm: 2500, count: 1 }]; }, (p: ProjectDraft) => { p.items[0].walls[0].widthMm = -1; }, (p: ProjectDraft) => { p.items[0].walls[0].heightMm = 2.5; }]) { const p = project(); mutate(p); assert.equal(validateProjectDraft(p).ok, false); }
});
test('eligible standard fabric includes normal prep/lining/hanging exactly once, VAT and 30-day validity', () => {
  const result = createEstimate(project(), config(), context);
  assert.equal(result.status, 'ready'); assert.equal(result.subtotalPence, 240000); assert.equal(result.vatPence, 48000); assert.equal(result.totalPence, 288000);
  assert.equal(result.lines.length, 2); assert.match(result.lines[0].inclusion, /normal preparation, lining and hanging/); assert.equal(result.validUntil, '2026-11-17T12:00:00.000Z');
});
test('missing configuration, material prices and management plans require review with no final total', () => {
  assert.equal(createEstimate(project(), null, context).totalPence, null);
  const c = config(); c.profiles[0].ratePencePerM2 = null; assert.equal(createEstimate(project(), c, context).status, 'review_required');
  assert.equal(createEstimate(project(), createDefaultPricingConfig(), context).totalPence, null);
});
test('unknown or unconfirmed inputs require information and never produce a final total', () => {
  for (const mutate of [(p: ProjectDraft) => { p.items[0].confirmedMeasurements = false; }, (p: ProjectDraft) => { p.items[0].material.acoustic = 'unknown'; }, (p: ProjectDraft) => { p.logistics.vehicleDaysConfirmed = false; }]) { const p = project(); mutate(p); const result = createEstimate(p, config(), context); assert.equal(result.status, 'information_required'); assert.equal(result.totalPence, null); }
});
test('fabric profile cannot stack or absorb acoustic, velvet or specialist work', () => {
  for (const key of ['acoustic', 'velvet', 'specialist'] as const) { const p = project(); p.items[0].material[key] = 'yes'; const result = createEstimate(p, config(), context); assert.equal(result.status, 'review_required'); assert.equal(result.lines.filter(x => x.itemId === p.items[0].id).length, 0); }
});
test('unknown exact product and conflicting type cannot fall back to a standard fabric price', () => {
  const p = project(); p.items[0].material.productId = 'unknown-product'; assert.equal(createEstimate(p, config(), context).status, 'review_required');
  p.items[0].material.productId = 'arte-grandeur-44001'; assert.equal(createEstimate(p, config(), context).status, 'review_required');
  delete p.items[0].material.productId; p.items[0].material.manufacturer = 'Unverified maker'; assert.equal(createEstimate(p, config(), context).status, 'review_required');
});
test('unpriced Arte Grandeur remains review-only even when selected by exact product', () => {
  const p = project(); p.items[0].material = { groupId: 'formed-acoustic', productId: 'arte-grandeur-44001', clientProvided: true, acoustic: 'no', velvet: 'no', specialist: 'yes' };
  const result = createEstimate(p, config(), context); assert.equal(result.status, 'review_required'); assert.equal(result.totalPence, null);
});
test('single room and feature wall never fall back to area pricing, including a disguised one-room multi-room scope', () => {
  for (const scopeKind of ['single_room', 'feature_wall', 'multiple_rooms'] as const) { const p = project(); p.items = [p.items[0]]; p.items[0].scopeKind = scopeKind; const result = createEstimate(p, config(), context); assert.equal(result.status, 'review_required'); assert.equal(result.lines.filter(x => x.category === 'installation').length, 0); }
});
test('approved small-scope template applies to an eligible new project within bounds', () => {
  const p = project(), c = config(); p.items = [p.items[0]]; p.items[0].scopeKind = 'feature_wall'; p.items[0].packageId = 'feature-package';
  c.packages.push({ id: 'feature-package', label: 'Approved example package', scopeKind: 'feature_wall', approved: true, pricePence: null, setupPence: 10000, labourHours: 7, labourRatePencePerHour: 10000, surveyAllowancePence: 5000, managementAllowancePence: 5000, profileIds: ['standard-fabric'], maxNetAreaMm2: 12_000_000, maxWallHeightMm: 3000, maxWalls: 4, maxOpenings: 4, inclusion: 'Normal preparation, lining and hanging labour; materials client provided.' });
  const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.equal(result.subtotalPence, 90000);
  p.items[0].walls[0].widthMm = 6000; assert.equal(createEstimate(p, c, context).status, 'review_required');
  p.items[0].walls[0].widthMm = 4000; p.items[0].material.specialist = 'yes'; assert.equal(createEstimate(p, c, context).status, 'review_required');
});
test('£26 contract price needs the exact approved project, revision, ready walls and commercial scope', () => {
  const p = project(), c = config(); p.items = [p.items[0]]; const i = p.items[0]; i.scopeKind = 'commercial'; i.preparation = 'contract-ready'; i.material.groupId = 'wide-contract-vinyl'; i.material.verifiedTypeId = 'contract-ready-vinyl';
  assert.equal(createEstimate(p, c, context).status, 'review_required');
  c.agreements.push({ id: 'a', projectId: context.projectId, projectRevision: 1, itemId: i.id, profileId: 'contract-ready-vinyl', approved: true, readyWallsVerified: true, allowAreaPricing: true });
  const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.equal(result.subtotalPence, 26000);
  assert.equal(createEstimate(p, c, { ...context, projectRevision: 2 }).totalPence, null);
  c.agreements[0].readyWallsVerified = false; assert.equal(createEstimate(p, c, context).totalPence, null);
});
test('bounded approved quantity revisions recalculate, while scope changes invalidate approval', () => {
  const p = project(), c = config();
  c.servicePlans[0] = { ...c.servicePlans[0], scopeFingerprint: computeApprovalScope(p, undefined, c), minNetAreaMm2: 10_000_000, maxNetAreaMm2: 30_000_000 };
  p.items[0].walls[0].widthMm = 5000;
  const revised = createEstimate(p, c, { ...context, projectRevision: 2 }); assert.equal(revised.status, 'ready'); assert.equal(revised.subtotalPence, 270000);
  for (const change of [(x: ProjectDraft) => { x.items[0].preparation = 'contract-ready'; }, (x: ProjectDraft) => { x.items[0].access = 'stairs'; }, (x: ProjectDraft) => { x.programme.phases = 2; }, (x: ProjectDraft) => { x.programme.startDate = '2026-11-02'; }, (x: ProjectDraft) => { x.items[0].material.productCode = 'new'; }]) { const x = structuredClone(p); change(x); assert.equal(createEstimate(x, c, { ...context, projectRevision: 2 }).totalPence, null); }
  p.items[0].walls[0].widthMm = 9000; assert.equal(createEstimate(p, c, { ...context, projectRevision: 2 }).totalPence, null);
});
test('duplicate vehicle visits charge once per actual vehicle-day; distinct days and vehicles remain separate', () => {
  const p = project(), c = config(); const day = { date: '2026-11-01', vehicleId: 'van', congestionZone: 'yes' as const, congestionChargeApplies: 'yes' as const, ulezZone: 'yes' as const, ulezChargeApplies: 'yes' as const, congestionTariff: 'standard' as const, ulezTariff: 'standard' as const, parkingRequired: 'no' as const };
  p.logistics.vehicleDays = [day, { ...day }, { ...day, date: '2026-11-02' }, { ...day, vehicleId: 'van-2' }];
  const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.equal(result.lines.filter(x => x.category === 'logistics').reduce((n, x) => n + x.amountPence, 0), 3 * (1800 + 1250));
});
test('unknown/conflicting vehicle flags, parking and additional logistics cannot silently become zero', () => {
  const p = project(), c = config(); p.logistics.vehicleDays = [{ date: '2026-11-01', vehicleId: 'van', congestionZone: 'unknown', congestionChargeApplies: 'unknown', ulezZone: 'no', ulezChargeApplies: 'no', parkingRequired: 'yes' }];
  assert.equal(createEstimate(p, c, context).totalPence, null);
  p.logistics.vehicleDays[0].congestionZone = 'no'; p.logistics.vehicleDays[0].congestionChargeApplies = 'yes'; assert.equal(createEstimate(p, c, context).status, 'review_required');
  p.logistics.vehicleDays = []; p.logistics.storageRequired = 'yes'; assert.equal(createEstimate(p, c, context).totalPence, null);
});
test('approved management, survey, parking and delivery are separate once-only allowances', () => {
  const p = project(), c = config(); c.servicePlans[0] = { ...c.servicePlans[0], managementHours: 1.25, managementRatePence: 10000, surveyHours: 0.5, surveyRatePence: 8000, deliveryPence: 5000, parking: [{ date: '2026-11-01', vehicleId: 'van', amountPence: 2000 }] };
  p.logistics.deliveriesRequired = 'yes'; p.logistics.vehicleDays = [{ date: '2026-11-01', vehicleId: 'van', congestionZone: 'no', congestionChargeApplies: 'no', ulezZone: 'no', ulezChargeApplies: 'no', parkingRequired: 'yes' }];
  const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.equal(result.subtotalPence, 263500); assert.equal(result.lines.filter(x => x.category === 'management')[0].quantity, 1);
});
test('property value requires private service-plan review and never changes area prices', () => {
  const p = project(), c = config(); p.propertyValuePence = 900_000_000; c.servicePlans[0].propertyContextReviewed = false;
  assert.equal(createEstimate(p, c, context).totalPence, null); c.servicePlans[0].propertyContextReviewed = true; assert.equal(createEstimate(p, c, context).subtotalPence, 240000);
});
test('snapshots remain immutable after draft/config changes; client projection explicitly excludes private values', () => {
  const p = project(), c = config(); p.propertyValuePence = 999_999_999; const result = createEstimate(p, c, context);
  p.items[0].walls[0].widthMm = 1; c.profiles[0].ratePencePerM2 = 1;
  assert.equal(result.subtotalPence, 240000); assert.equal(result.project.items[0].walls[0].widthMm, 4000); assert.equal(Object.isFrozen(result.project.items[0].walls), true);
  const shared = toSharedEstimate(result), serialized = JSON.stringify(shared);
  assert.equal(shared.projectName, 'Example design project'); assert.equal(shared.projectAddress.line1, 'Example site');
  for (const forbidden of ['designer@example.invalid', '999999999', 'propertyValuePence', 'managementRatePence', 'configVersion', 'projectRevision', '0000000000']) assert.equal(serialized.includes(forbidden), false);
});
test('config validation rejects floating money, unbounded revision approvals and duplicate profiles', () => {
  assert.equal(validatePricingConfig(config()).ok, true);
  for (const change of [(c: PricingConfig) => { c.profiles[0].ratePencePerM2 = 1.1; }, (c: PricingConfig) => { c.profiles.push(c.profiles[0]); }, (c: PricingConfig) => { c.servicePlans[0].scopeFingerprint = 'scope'; }, (c: PricingConfig) => { c.servicePlans[0].managementHours = 0.1; }]) { const c = config(); change(c); assert.equal(validatePricingConfig(c).ok, false); }
  const c = config(); c.vatRateBps = 0; assert.equal(createEstimate(project(), c, context).totalPence, null);
});

function calculatedPackage(c: PricingConfig, kind: 'feature_wall' | 'single_room' = 'single_room') {
  c.packages.push({ id: 'routine-package', label: 'Example approved routine package', scopeKind: kind, approved: true, pricePence: null, setupPence: 10000, labourHours: 6, labourRatePencePerHour: 10000, surveyAllowancePence: 5000, managementAllowancePence: 10000, routineServiceApproved: true, profileIds: ['standard-fabric'], maxNetAreaMm2: 30_000_000, maxWallHeightMm: 3000, maxWalls: 4, maxOpenings: 4, inclusion: 'Labour for normal preparation, lining and hanging; all materials client provided.' });
}
test('routine calculated small-scope package works automatically without a project plan or designer-visible package ID', () => {
  const p = project(), c = createDefaultPricingConfig(); p.items = [p.items[0]]; p.items[0].scopeKind = 'single_room'; calculatedPackage(c);
  const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.equal(result.subtotalPence, 85000); assert.equal(result.totalPence, 102000);
  p.items[0].walls[0].widthMm = 5000; assert.equal(createEstimate(p, c, context).subtotalPence, 85000); // Fixed approved labour time, not area pricing.
  p.programme.occupied = 'yes'; assert.equal(createEstimate(p, c, context).totalPence, null);
});
test('a single-room package charges once for multiple eligible material items with aggregate bounds', () => {
  const p = project(), c = createDefaultPricingConfig(); p.items[1].roomId = 'room-1'; p.items.forEach(i => { i.scopeKind = 'single_room'; }); calculatedPackage(c);
  const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.equal(result.lines.length, 1); assert.equal(result.subtotalPence, 85000);
  p.items[1].walls[0].widthMm = 10000; assert.equal(createEstimate(p, c, context).totalPence, null);
});
test('package geometry and nonroutine private context require review and never area fallback', () => {
  for (const change of [(p: ProjectDraft) => { p.items[0].walls[0].heightMm = 3500; }, (p: ProjectDraft) => { p.items[0].walls[0].count = 5; }, (p: ProjectDraft) => { p.propertyValuePence = 100000; }, (p: ProjectDraft) => { p.programme.phases = 2; }, (p: ProjectDraft) => { p.logistics.storageRequired = 'yes'; }]) {
    const p = project(), c = createDefaultPricingConfig(); p.items = [p.items[0]]; p.items[0].scopeKind = 'single_room'; calculatedPackage(c); change(p); assert.equal(createEstimate(p, c, context).totalPence, null);
  }
});
test('routine package survey and management are not charged again without explicit additional-services approval', () => {
  const p = project(), c = config(); p.items = [p.items[0]]; p.items[0].scopeKind = 'single_room'; calculatedPackage(c); c.servicePlans[0].managementHours = 1; c.servicePlans[0].managementRatePence = 10000;
  assert.equal(createEstimate(p, c, context).totalPence, null); c.servicePlans[0].additionalServicesOnly = true; const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.equal(result.subtotalPence, 95000);
});
test('discounted and unknown tariff classes require sourced approval and never receive a standard charge', () => {
  const p = project(), c = config(); p.logistics.vehicleDays = [{ date: '2026-11-01', vehicleId: 'electric-van', congestionZone: 'yes', congestionChargeApplies: 'yes', congestionTariff: 'discounted', ulezZone: 'no', ulezChargeApplies: 'no', parkingRequired: 'no' }];
  const pending = createEstimate(p, c, context); assert.equal(pending.totalPence, null); assert.equal(pending.lines.some(x => x.label === 'Congestion Charge'), false);
  c.servicePlans[0].roadCharges = [{ date: '2026-11-01', vehicleId: 'electric-van', scheme: 'congestion', amountPence: 900, source: 'Synthetic test of a verified vehicle account discount' }];
  const approved = createEstimate(p, c, context); assert.equal(approved.status, 'ready'); assert.equal(approved.lines.find(x => x.label === 'Congestion Charge')!.amountPence, 900);
  p.logistics.vehicleDays[0].congestionTariff = 'unknown'; assert.equal(createEstimate(p, c, context).totalPence, null);
});
test('quantity approvals retain height, wall count, opening and reveal geometry as scope assumptions', () => {
  const p = project(), c = config(); c.servicePlans[0] = { ...c.servicePlans[0], scopeFingerprint: computeApprovalScope(p, undefined, c), minNetAreaMm2: 10_000_000, maxNetAreaMm2: 50_000_000 };
  for (const change of [(x: ProjectDraft) => { x.items[0].walls[0].heightMm = 5000; }, (x: ProjectDraft) => { x.items[0].walls[0].count = 2; }, (x: ProjectDraft) => { x.items[0].walls[0].openings.push({ id: 'door', widthMm: 900, heightMm: 2000, count: 1 }); }, (x: ProjectDraft) => { x.items[0].walls[0].reveals.push({ id: 'return', widthMm: 200, heightMm: 2000, count: 1 }); }]) { const revised = structuredClone(p); change(revised); const result = createEstimate(revised, c, { ...context, projectRevision: 2 }); assert.equal(result.totalPence, null); assert.equal(result.reviewReasons.some(x => x.code === 'service-plan-required'), true); }
  const revised = structuredClone(p); revised.items[0].walls[0].widthMm = 5000; assert.equal(createEstimate(revised, c, { ...context, projectRevision: 2 }).status, 'ready');
});
test('zero calculated labour is not approvable even when a legacy package amount is positive', () => {
  for (const legacy of [null, 0, 85000]) {
    const p = project(), c = createDefaultPricingConfig(); p.items = [p.items[0]]; p.items[0].scopeKind = 'single_room'; calculatedPackage(c);
    Object.assign(c.packages[0], { pricePence: legacy, setupPence: 0, labourHours: 0, labourRatePencePerHour: 0, surveyAllowancePence: 0, managementAllowancePence: 0 });
    assert.equal(validatePricingConfig(c).ok, false); const result = createEstimate(p, c, context); assert.equal(result.totalPence, null); assert.notEqual(result.status, 'ready');
  }
});
function registeredFabric(c: PricingConfig) {
  c.products!.push({ id: 'verified-fabric', manufacturer: 'Example maker', name: 'Example fabric', code: 'FAB1', collection: 'Example collection', groupId: 'standard-fabric', approved: true, verified: true, construction: 'Verified standard fabric', faceMaterial: 'Fabric', backingMaterial: null, suppliedFormat: 'roll', widthMm: 1000, repeatMm: null, thicknessMm: null, hangingMethod: 'Follow the verified product instructions', sourceUrl: 'https://example.invalid/product', instructionsUrl: 'https://example.invalid/instructions', sourceReviewedOn: '2026-10-18', verifiedTypeId: 'standard-fabric', traits: { acoustic: false, velvet: false, specialist: false } });
}
test('verified registry product inherits only an explicit approved type mapping and supplies authoritative traits', () => {
  const p = project(), c = config(); registeredFabric(c); p.items[0].material = { groupId: 'standard-fabric', productId: 'verified-fabric', clientProvided: true, acoustic: 'unknown', velvet: 'unknown', specialist: 'unknown' };
  c.servicePlans[0] = { ...c.servicePlans[0], scopeFingerprint: computeApprovalScope(p, undefined, c), minNetAreaMm2: 1, maxNetAreaMm2: 30_000_000 };
  assert.equal(createEstimate(p, c, context).status, 'ready');
  p.items[0].material.velvet = 'yes'; assert.equal(createEstimate(p, c, context).totalPence, null);
});
test('an invented product cannot resolve from profile ID or a shared maker/collection name', () => {
  const p = project(), c = config(); registeredFabric(c); c.profiles[0].productId = 'invented-product'; p.items[0].material.productId = 'invented-product';
  assert.equal(createEstimate(p, c, context).totalPence, null);
  p.items[0].material.productId = 'verified-fabric'; delete c.products![1].verifiedTypeId; assert.equal(createEstimate(p, c, context).totalPence, null);
});
test('product registry permits unknown published facts, validates source data, and exposes only approved metadata', () => {
  const c = config(); registeredFabric(c); assert.equal(validatePricingConfig(c).ok, true); const products = getPublicProductCatalog(c); assert.equal(products.length, 1); assert.equal(products[0].thicknessMm, null);
  for (const key of ['approved', 'verified', 'traits', 'verifiedTypeId', 'installationProfileId', 'ratePencePerM2']) assert.equal(JSON.stringify(products).includes(`\"${key}\"`), false);
  c.products![1].sourceUrl = 'javascript:alert(1)'; assert.equal(validatePricingConfig(c).ok, false);
  delete c.products; assert.equal(validatePricingConfig(c).ok, true); // Backwards-compatible config without a registry.
});

test('product evidence and profile technical changes invalidate approval while issued snapshots stay fixed', () => {
  const p = project(), c = config(); registeredFabric(c); p.items[0].material = { groupId: 'standard-fabric', productId: 'verified-fabric', clientProvided: true, acoustic: 'unknown', velvet: 'unknown', specialist: 'unknown' };
  assert.equal(createEstimate(p, c, context).totalPence, null); // Exact-product approvals need their technical snapshot.
  c.servicePlans[0] = { ...c.servicePlans[0], scopeFingerprint: computeApprovalScope(p, undefined, c), minNetAreaMm2: 1, maxNetAreaMm2: 30_000_000 };
  const issued = createEstimate(p, c, context); assert.equal(issued.status, 'ready');
  c.products![1].hangingMethod = 'Revised verified installation method'; assert.equal(createEstimate(p, c, context).totalPence, null); assert.equal(issued.totalPence, 288000);
  c.products![1].hangingMethod = 'Follow the verified product instructions'; c.profiles[0].requiresProjectAgreement = true; assert.equal(createEstimate(p, c, context).totalPence, null);
});

test('standard road tariffs require approved date bounds with no historical or expired future fallback', () => {
  const p = project(), c = config(); p.logistics.vehicleDays = [{ date: '2026-11-01', vehicleId: 'van', congestionZone: 'yes', congestionChargeApplies: 'yes', congestionTariff: 'standard', ulezZone: 'yes', ulezChargeApplies: 'yes', ulezTariff: 'standard', parkingRequired: 'no' }];
  assert.equal(createEstimate(p, c, context).status, 'ready');
  for (const date of ['2025-11-01', '2027-01-01']) { p.logistics.vehicleDays[0].date = date; const result = createEstimate(p, c, context); assert.equal(result.totalPence, null); assert.equal(result.lines.some(x => x.label === 'Congestion Charge' || x.label === 'ULEZ charge'), false); }
  p.logistics.vehicleDays[0].date = '2026-11-01'; c.logistics.congestionEffectiveUntil = null; assert.equal(createEstimate(p, c, context).totalPence, null);
  c.servicePlans[0].roadCharges = [{ date: '2026-11-01', vehicleId: 'van', scheme: 'congestion', amountPence: 1800, source: 'Synthetic approved dated tariff override' }]; assert.equal(createEstimate(p, c, context).status, 'ready');
  c.logistics.congestionEffectiveUntil = '2025-01-01'; assert.equal(validatePricingConfig(c).ok, false);
});
test('installation and package breakdown identify their room and scope without private property context', () => {
  const p = project(), c = config(); p.items[0].label = 'Chimney breast'; p.items[1].label = 'Desk wall'; p.propertyValuePence = 999999999;
  const result = createEstimate(p, c, context); assert.match(result.lines[0].label, /Living room · Chimney breast/); assert.match(result.lines[1].label, /Study · Desk wall/); assert.equal(result.lines.some(line => line.label.includes('999999999')), false);
  p.items = [p.items[0]]; p.items[0].scopeKind = 'single_room'; calculatedPackage(c); const packaged = createEstimate(p, c, context); assert.match(packaged.lines.find(line => line.category === 'package')!.label, /^Living room · /);
});
test('a removal and repair profile cannot hide an absent separately priced preparation scope', () => {
  const p = project(), c = config(); c.profiles.push({ ...c.profiles[0], id: 'repair-fabric', label: 'Approved removal and repair installation', verifiedTypeId: 'repair-fabric', preparations: ['removal-or-repair'], ratePencePerM2: 15000 }); p.items[0].material.verifiedTypeId = 'repair-fabric'; p.items[0].preparation = 'removal-or-repair';
  const result = createEstimate(p, c, context); assert.equal(result.status, 'review_required'); assert.equal(result.totalPence, null); assert.equal(result.reviewReasons.some(reason => reason.code === 'preparation-service-required'), true);
});
test('approving a product requires verified primary provenance, exact instructions, review date and a compatible mapping', () => {
  for (const key of ['sourceUrl', 'instructionsUrl', 'sourceReviewedOn', 'verifiedTypeId'] as const) {
    const c = config(); registeredFabric(c); delete c.products![1][key]; const result = validatePricingConfig(c); assert.equal(result.ok, false, `Missing ${key} must block approval`);
    c.products![1].approved = false; assert.equal(validatePricingConfig(c).ok, true, `An incomplete ${key} may remain an unapproved record`);
  }
  for (const sourceUrl of ['javascript:alert(1)', 'data:text/html,source', 'http://example.invalid/product', 'https://user:secret@example.invalid/product']) { const c = config(); registeredFabric(c); c.products![1].sourceUrl = sourceUrl; assert.equal(validatePricingConfig(c).ok, false); }
  const c = config(); registeredFabric(c); c.products![1].verified = false; assert.equal(validatePricingConfig(c).ok, false);
  c.products![1].verified = true; c.products![1].verifiedTypeId = 'not-a-verified-type'; assert.equal(validatePricingConfig(c).ok, false);
  delete c.products![1].verifiedTypeId; c.products![1].installationProfileId = 'standard-fabric'; assert.equal(validatePricingConfig(c).ok, true);
  c.products![1].installationProfileId = 'contract-ready-vinyl'; assert.equal(validatePricingConfig(c).ok, false);
});
test('the applicable VAT rate is immutable in the estimate and preserved in the client projection', () => {
  const c = config(), snapshot = createEstimate(project(), c, context); assert.equal(snapshot.vatRateBps, 2000); c.vatRateBps = null; assert.equal(snapshot.vatRateBps, 2000); assert.equal(toSharedEstimate(snapshot).vatRateBps, 2000);
  const unknown = createEstimate(project(), c, context); assert.equal(unknown.vatRateBps, null); assert.equal(toSharedEstimate(unknown).vatRateBps, null); assert.equal(unknown.totalPence, null);
});

// All prices in this acceptance matrix are invented test inputs, never business rates or public defaults.
const acceptanceMaterials: { name: string; group: MaterialGroupId; face: string; backing: string; syntheticRate: number; acoustic: boolean; velvet: boolean; specialist: boolean; contract?: boolean }[] = [
  { name: 'ordinary printed paper', group: 'printed-paper', face: 'Printed paper', backing: 'Paper', syntheticRate: 1111, acoustic: false, velvet: false, specialist: false },
  { name: 'printed nonwoven', group: 'printed-nonwoven', face: 'Printed nonwoven', backing: 'Nonwoven', syntheticRate: 2222, acoustic: false, velvet: false, specialist: false },
  { name: 'vinyl-coated paper', group: 'vinyl-coated-paper', face: 'Vinyl-coated paper', backing: 'Paper', syntheticRate: 3333, acoustic: false, velvet: false, specialist: false },
  { name: 'wide fabric-backed contract vinyl', group: 'wide-contract-vinyl', face: 'Vinyl', backing: 'Woven fabric', syntheticRate: 4444, acoustic: false, velvet: false, specialist: false, contract: true },
  { name: 'standard fabric', group: 'standard-fabric', face: 'Woven fabric', backing: 'Nonwoven', syntheticRate: 5555, acoustic: false, velvet: false, specialist: false },
  { name: 'velvet face', group: 'velvet-flock-pile', face: 'Velvet pile', backing: 'Nonwoven', syntheticRate: 6666, acoustic: false, velvet: true, specialist: true },
  { name: 'thick 3D velvet acoustic', group: 'formed-acoustic', face: 'Formed velvet textile', backing: 'Specified acoustic backing', syntheticRate: 7777, acoustic: true, velvet: true, specialist: true },
];
function acceptanceScenario(material: typeof acceptanceMaterials[number]) {
  const p = project(), c = config(); p.items = [p.items[0]]; const scope = p.items[0]; scope.scopeKind = 'commercial'; scope.preparation = material.contract ? 'contract-ready' : 'normal-prep-lining-hanging';
  c.profiles = [{ id: 'synthetic-approved-profile', label: `Approved ${material.name} profile`, materialGroupId: material.group, verifiedTypeId: material.contract ? 'contract-ready-vinyl' : 'synthetic-verified-type', approved: true, ratePencePerM2: material.syntheticRate, preparations: [scope.preparation], requiresProjectAgreement: true, reviewRequired: false, traits: { acoustic: material.acoustic, velvet: material.velvet, specialist: material.specialist } }];
  c.products = [{ id: 'synthetic-sourced-product', manufacturer: 'Synthetic acceptance maker', name: material.name, code: 'TEST-ONLY', groupId: material.group, approved: true, verified: true, construction: `Synthetic verified ${material.name} construction`, faceMaterial: material.face, backingMaterial: material.backing, suppliedFormat: material.group === 'formed-acoustic' ? 'panel' : 'roll', widthMm: 1000, thicknessMm: material.group === 'formed-acoustic' ? 15 : null, hangingMethod: 'Synthetic product-specific approved hanging method', sourceUrl: 'https://example.invalid/test-product-source', instructionsUrl: 'https://example.invalid/test-product-instructions', sourceReviewedOn: '2026-10-18', installationProfileId: 'synthetic-approved-profile', traits: { acoustic: material.acoustic, velvet: material.velvet, specialist: material.specialist } }];
  scope.material = { groupId: material.group, productId: 'synthetic-sourced-product', clientProvided: true, acoustic: 'unknown', velvet: 'unknown', specialist: 'unknown' };
  c.agreements = [{ id: 'synthetic-project-agreement', projectId: context.projectId, projectRevision: 1, itemId: scope.id, profileId: 'synthetic-approved-profile', approved: true, readyWallsVerified: !!material.contract, allowAreaPricing: true, scopeFingerprint: computeApprovalScope(p, scope.id, c), minNetAreaMm2: 1, maxNetAreaMm2: 20_000_000 }];
  c.servicePlans[0] = { ...c.servicePlans[0], scopeFingerprint: computeApprovalScope(p, undefined, c), minNetAreaMm2: 1, maxNetAreaMm2: 20_000_000 };
  return { p, c };
}
for (const material of acceptanceMaterials) test(`approved sourced ${material.name} resolves its intended installation price`, () => {
  const { p, c } = acceptanceScenario(material), result = createEstimate(p, c, context);
  assert.equal(result.status, 'ready'); assert.equal(result.lines.length, 1); assert.match(result.lines[0].label, new RegExp(`Approved ${material.name} profile`)); assert.equal(result.subtotalPence, 10 * material.syntheticRate); assert.equal(result.totalPence, 12 * material.syntheticRate);
});
test('fabric-backed vinyl cannot claim the available fabric-face profile through a wrong group or type request', () => {
  for (const wrongRequest of ['group', 'type'] as const) {
    const { p, c } = acceptanceScenario(acceptanceMaterials[3]); c.profiles.push(createDefaultPricingConfig().profiles[0]);
    if (wrongRequest === 'group') p.items[0].material.groupId = 'standard-fabric';
    else p.items[0].material.verifiedTypeId = 'standard-fabric';
    const result = createEstimate(p, c, context); assert.equal(result.status, 'review_required'); assert.equal(result.totalPence, null); assert.equal(result.lines.filter(x => x.category === 'installation').length, 0); assert.equal(result.reviewReasons.some(x => x.code === 'material-conflict'), true);
  }
});
test('overlapping 3D, velvet and acoustic characteristics use one approved profile with no surcharges; unapproved work stays in review', () => {
  const { p, c } = acceptanceScenario(acceptanceMaterials[6]), approved = createEstimate(p, c, context);
  assert.equal(approved.status, 'ready'); assert.equal(approved.lines.length, 1); assert.equal(approved.lines[0].amountPence, 77770); assert.equal(approved.lines[0].category, 'installation');
  c.profiles[0].approved = false; const unapprovedProfile = createEstimate(p, c, context); assert.equal(unapprovedProfile.status, 'review_required'); assert.equal(unapprovedProfile.totalPence, null); assert.equal(unapprovedProfile.lines.length, 0);
  c.profiles[0].approved = true; c.products![0].approved = false; const unapprovedProduct = createEstimate(p, c, context); assert.equal(unapprovedProduct.status, 'review_required'); assert.equal(unapprovedProduct.totalPence, null); assert.equal(unapprovedProduct.lines.length, 0);
});
test('wide contract vinyl keeps its project and ready-wall gate after profile renaming; another material at the same amount is unaffected', () => {
  const p = project(), c = config(); c.profiles = [{ ...c.profiles[0], id: 'renamed-contract-profile', label: 'Renamed contract installation', materialGroupId: 'wide-contract-vinyl', verifiedTypeId: 'renamed-contract-type', ratePencePerM2: 2600, requiresProjectAgreement: false, preparations: ['normal-prep-lining-hanging', 'contract-ready'] }]; c.products = [];
  p.items.forEach(item => { item.material.groupId = 'wide-contract-vinyl'; item.material.verifiedTypeId = 'renamed-contract-type'; });
  const bypass = createEstimate(p, c, context); assert.equal(bypass.status, 'review_required'); assert.equal(bypass.totalPence, null); assert.equal(bypass.lines.length, 0);
  p.items = [p.items[0]]; p.items[0].scopeKind = 'commercial'; c.agreements = [{ id: 'renamed-profile-agreement', projectId: context.projectId, projectRevision: 1, itemId: p.items[0].id, profileId: 'renamed-contract-profile', approved: true, readyWallsVerified: false, allowAreaPricing: true }];
  assert.equal(createEstimate(p, c, context).totalPence, null); c.agreements[0].readyWallsVerified = true; assert.equal(createEstimate(p, c, context).totalPence, null); p.items[0].preparation = 'contract-ready'; const approved = createEstimate(p, c, context); assert.equal(approved.status, 'ready'); assert.equal(approved.subtotalPence, 26000);
  const ordinary = config(); ordinary.profiles[0].ratePencePerM2 = 2600; assert.equal(createEstimate(project(), ordinary, context).status, 'ready');
});


test('explicit product methods round-trip and changing any maker instruction invalidates quantity approval', () => {
  const p = project(), c = config(); registeredFabric(c);
  const record = c.products!.find(value => value.id === 'verified-fabric')!;
  const fields = ['hangingDirection', 'pastingMethod', 'trimmingMethod', 'jointingMethod', 'cornerTreatment', 'handlingRequirements'] as const;
  for (const key of fields) record[key] = `Verified ${key}`;
  p.items.forEach(item => { item.material.productId = record.id; });
  c.servicePlans[0] = { ...c.servicePlans[0], scopeFingerprint: computeApprovalScope(p, undefined, c), minNetAreaMm2: 1, maxNetAreaMm2: 50_000_000 };
  assert.equal(validatePricingConfig(c).ok, true);
  const publicRecord = getPublicProductCatalog(c).find(value => value.id === record.id)!;
  for (const key of fields) assert.equal(publicRecord[key], record[key]);
  assert.equal(createEstimate(p, c, context).status, 'ready');
  for (const key of fields) {
    const changed = structuredClone(c); changed.products!.find(value => value.id === record.id)![key] = 'Revised maker requirement';
    assert.equal(createEstimate(p, changed, { ...context, projectRevision: 2 }).totalPence, null);
  }
  record.pastingMethod = null; assert.equal(validatePricingConfig(c).ok, true);
  record.cornerTreatment = 'x'.repeat(2001); assert.equal(validatePricingConfig(c).ok, false);
});
test('structured services price the actual approved hours, days and visits with dated rates', () => {
  const p = project(), c = config(); c.servicePlans[0].serviceEntries = [
    { id: 'survey-visits', category: 'survey', label: 'Setting-out survey visits', quantity: 2, unit: 'visit', ratePence: 15000, rateReviewedOn: '2026-10-18', approved: true },
    { id: 'management-days', category: 'management', label: 'Protection and trade coordination', quantity: 1.5, unit: 'day', ratePence: 40000, rateReviewedOn: '2026-10-18', approved: true },
    { id: 'management-hours', category: 'management', label: 'Sample review', quantity: 0.75, unit: 'hour', ratePence: 8000, rateReviewedOn: '2026-10-18', approved: true },
  ];
  const result = createEstimate(p, c, context);
  assert.equal(result.status, 'ready'); assert.equal(result.subtotalPence, 336000);
  assert.deepEqual(result.lines.filter(line => ['survey', 'management'].includes(line.category)).map(line => [line.quantity, line.unit, line.amountPence]), [[2, 'visit', 30000], [1.5, 'day', 60000], [0.75, 'hour', 6000]]);
});
test('unapproved, missing, fractional visits and future-dated service prices never complete an estimate', () => {
  for (const mutate of [
    (entry: any) => { entry.approved = false; }, (entry: any) => { entry.ratePence = null; },
    (entry: any) => { delete entry.rateReviewedOn; }, (entry: any) => { entry.quantity = 0.5; },
    (entry: any) => { entry.rateReviewedOn = '2027-01-01'; },
  ]) {
    const c = config(); c.servicePlans[0].serviceEntries = [{ id: 'survey', category: 'survey', label: 'Survey visit', quantity: 1, unit: 'visit', ratePence: 15000, rateReviewedOn: '2026-10-18', approved: true }]; mutate(c.servicePlans[0].serviceEntries[0]);
    assert.equal(createEstimate(project(), c, context).totalPence, null);
  }
});
test('structured service entries cannot duplicate legacy hours or included package services', () => {
  const p = project(), c = config(); c.servicePlans[0].serviceEntries = [{ id: 'management', category: 'management', label: 'Supervision', quantity: 1, unit: 'day', ratePence: 40000, rateReviewedOn: '2026-10-18', approved: true }];
  c.servicePlans[0].managementHours = 8; c.servicePlans[0].managementRatePence = 5000;
  assert.equal(createEstimate(p, c, context).totalPence, null);
  c.servicePlans[0].managementHours = 0; p.items = [p.items[0]]; p.items[0].scopeKind = 'single_room'; calculatedPackage(c);
  assert.equal(createEstimate(p, c, context).totalPence, null);
  c.servicePlans[0].additionalServicesOnly = true; const result = createEstimate(p, c, context);
  assert.equal(result.status, 'ready'); assert.equal(result.subtotalPence, 125000); assert.equal(result.lines.filter(line => line.category === 'management').length, 1);
});
test('declared nonstandard access requires a bound owner assessment and can then be estimated', () => {
  const p = project(), c = config(); p.items[0].access = 'high-level';
  assert.equal(createEstimate(p, c, context).totalPence, null);
  c.servicePlans[0].accessReviewed = true; assert.equal(createEstimate(p, c, context).status, 'ready');
  assert.equal(createEstimate(p, c, { ...context, projectRevision: 2 }).totalPence, null);
  p.items[0].access = 'unknown'; assert.equal(createEstimate(p, c, context).status, 'information_required');
});
test('removal and repair require a separately approved linked preparation allowance', () => {
  const p = project(), c = config(); p.items[0].preparation = 'removal-or-repair';
  assert.equal(createEstimate(p, c, context).totalPence, null);
  c.servicePlans[0].serviceEntries = [{ id: 'prep', category: 'preparation', label: 'Remove old paper and repair living-room substrate', quantity: 1.5, unit: 'day', ratePence: 30000, rateReviewedOn: '2026-10-18', approved: true, itemIds: ['item-1'] }];
  const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.equal(result.subtotalPence, 285000);
  assert.equal(result.lines.filter(line => line.category === 'preparation').length, 1); assert.equal(result.lines.find(line => line.category === 'preparation')!.amountPence, 45000);
  assert.match(result.lines.find(line => line.itemId === 'item-1')!.inclusion, /separately approved removal or repair/);
  c.servicePlans[0].serviceEntries[0].itemIds = ['item-2']; assert.equal(createEstimate(p, c, context).totalPence, null);
});
test('unknown material readiness stays explicit while known future supply can receive a desk budget', () => {
  const p = project(), c = config(); delete p.programme.materialReadiness;
  const missing = createEstimate(p, c, context); assert.equal(missing.status, 'information_required'); assert.equal(missing.totalPence, null);
  c.servicePlans[0].materialReadinessReviewed = true; const provisional = createEstimate(p, c, context); assert.equal(provisional.status, 'ready'); assert.equal(provisional.assumptions.some(note => /availability is provisional/.test(note)), true);
  delete c.servicePlans[0].materialReadinessReviewed;
  p.programme.materialReadiness = { status: 'ordered', readyDate: '2026-10-30', scopeItemIds: [] };
  assert.equal(createEstimate(p, c, context).status, 'ready');
  p.programme.materialReadiness.readyDate = '2026-11-10'; assert.equal(createEstimate(p, c, context).totalPence, null);
  p.programme.materialReadiness = { status: 'checked-ready', scopeItemIds: ['item-1'] }; assert.equal(createEstimate(p, c, context).totalPence, null);
});
test('ceilings need explicitly approved surface coverage and cannot inherit an ordinary wall profile', () => {
  const p = project(), c = config(); p.items[0].surfaceKind = 'ceiling'; p.items[0].walls = []; p.items[0].ceilings = [{ id: 'ceiling', widthMm: 4000, lengthMm: 3000, count: 1, openings: [] }];
  assert.equal(createEstimate(p, c, context).totalPence, null);
  c.profiles[0].surfaceKinds = ['wall', 'ceiling']; const result = createEstimate(p, c, context);
  assert.equal(result.status, 'ready'); assert.equal(result.lines.find(line => line.itemId === 'item-1')!.quantity, 12);
  c.servicePlans[0] = { ...c.servicePlans[0], scopeFingerprint: computeApprovalScope(p, undefined, c), minNetAreaMm2: 1, maxNetAreaMm2: 50_000_000 };
  p.items[0].ceilings[0].lengthMm = 3500; assert.equal(createEstimate(p, c, { ...context, projectRevision: 2 }).totalPence, null);
});
test('ceiling packages require their own approved geometry bounds', () => {
  const p = project(), c = config(); p.items = [p.items[0]]; p.items[0].scopeKind = 'single_room'; p.items[0].surfaceKind = 'ceiling'; p.items[0].walls = []; p.items[0].ceilings = [{ id: 'ceiling', widthMm: 4000, lengthMm: 3000, count: 1, openings: [] }];
  c.profiles[0].surfaceKinds = ['wall', 'ceiling']; calculatedPackage(c);
  assert.equal(createEstimate(p, c, context).totalPence, null);
  Object.assign(c.packages[0], { surfaceKinds: ['ceiling'], maxCeilings: 1, maxCeilingWidthMm: 4000, maxCeilingLengthMm: 3000 });
  assert.equal(createEstimate(p, c, context).status, 'ready');
  p.items[0].ceilings[0].widthMm = 4500; assert.equal(createEstimate(p, c, context).totalPence, null);
});
test('building, resource approvals and readiness revisions invalidate a quantity-only service approval', () => {
  const p = project(), c = config(); p.buildingType = 'hotel'; p.resources = { materialRequirements: [], preparationChecklist: [], sampleApprovals: [], aftercareReferences: [] };
  c.servicePlans[0] = { ...c.servicePlans[0], scopeFingerprint: computeApprovalScope(p, undefined, c), minNetAreaMm2: 1, maxNetAreaMm2: 50_000_000 };
  for (const mutate of [
    (value: ProjectDraft) => { value.buildingType = 'private-home'; },
    (value: ProjectDraft) => { value.programme.materialReadiness!.status = 'part-delivered'; },
    (value: ProjectDraft) => { value.resources!.sampleApprovals.push({ id: 'sample', label: 'New sample', scopeItemIds: [], status: 'requested' }); },
  ]) { const changed = structuredClone(p); mutate(changed); assert.equal(createEstimate(changed, c, { ...context, projectRevision: 2 }).totalPence, null); }
});

test('unmeasured openings and reveals remain saveable but owner approval cannot price them as zero area', () => {
  for (const surface of ['wall-opening', 'wall-reveal', 'ceiling-opening'] as const) for (const missing of ['width', 'second-dimension'] as const) for (const mode of ['area', 'package'] as const) {
    const p = project(), c = config(), first = p.items[0];
    c.profiles[0].surfaceKinds = ['wall', 'ceiling'];
    if (surface === 'ceiling-opening') {
      first.surfaceKind = 'ceiling'; first.walls = []; first.ceilings = [{ id: 'ceiling', widthMm: 4000, lengthMm: 3000, count: 1, openings: [{ id: 'rooflight', widthMm: missing === 'width' ? 0 : 500, lengthMm: missing === 'second-dimension' ? 0 : 500, count: 1 }] }];
    } else first.walls[0][surface === 'wall-opening' ? 'openings' : 'reveals'] = [{ id: 'part', widthMm: missing === 'width' ? 0 : 500, heightMm: missing === 'second-dimension' ? 0 : 500, count: 1 }];
    if (mode === 'package') {
      p.items = [first]; first.scopeKind = 'single_room'; calculatedPackage(c);
      Object.assign(c.packages[0], { surfaceKinds: ['wall', 'ceiling'], maxCeilings: 1, maxCeilingWidthMm: 4000, maxCeilingLengthMm: 3000 });
    } else c.agreements.push({ id: 'owner-agreement', projectId: context.projectId, projectRevision: 1, itemId: first.id, profileId: 'standard-fabric', approved: true, readyWallsVerified: true, allowAreaPricing: true, agreedRatePencePerM2: 12000, scopeFingerprint: computeApprovalScope(p, first.id, c), minNetAreaMm2: 1, maxNetAreaMm2: 50_000_000 });
    c.servicePlans[0] = { ...c.servicePlans[0], scopeFingerprint: computeApprovalScope(p, undefined, c), minNetAreaMm2: 1, maxNetAreaMm2: 50_000_000, accessReviewed: true, materialReadinessReviewed: true };
    assert.equal(validateProjectDraft(p).ok, true, `${surface}/${missing}/${mode}: incomplete dimensions are saveable`);
    const result = createEstimate(p, c, context);
    assert.equal(result.status, 'information_required', `${surface}/${missing}/${mode}`); assert.equal(result.totalPence, null);
    assert.ok(result.reviewReasons.some(reason => reason.itemId === first.id && reason.code === 'measurements-required'));
    assert.equal(result.lines.some(line => line.itemId === first.id || line.category === 'package'), false, 'no installation or package line can price the unmeasured scope');
  }
});
test('measured inner rectangles continue to price after all unknown dimensions are resolved', () => {
  const p = project(), c = config();
  p.items[0].walls[0].openings = [{ id: 'opening', widthMm: 500, heightMm: 1000, count: 1 }];
  p.items[0].walls[0].reveals = [{ id: 'reveal', widthMm: 100, heightMm: 1000, count: 2 }];
  c.profiles[0].surfaceKinds = ['wall', 'ceiling']; p.items[1].surfaceKind = 'ceiling'; p.items[1].walls = []; p.items[1].ceilings = [{ id: 'ceiling', widthMm: 4000, lengthMm: 2500, count: 1, openings: [{ id: 'rooflight', widthMm: 500, lengthMm: 1000, count: 1 }] }];
  const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.equal(result.totalPence, 276480);
  assert.deepEqual(result.lines.filter(line => line.category === 'installation').map(line => line.quantity), [9.7, 9.5]);
});


test('small wide-vinyl work uses its approved component package before large-contract area pricing', () => {
  for (const kind of ['feature_wall', 'single_room'] as const) {
    const p = project(), c = config(); p.items = [p.items[0]]; const scope = p.items[0]; scope.scopeKind = kind; scope.preparation = 'contract-ready'; scope.material.groupId = 'wide-contract-vinyl'; scope.material.verifiedTypeId = 'contract-ready-vinyl';
    calculatedPackage(c, kind); c.packages[0].profileIds = ['contract-ready-vinyl']; c.packages[0].inclusion = 'Prepared-wall hanging labour and approved project service allowances; client materials.';
    c.agreements.push({ id: 'small-vinyl', projectId: context.projectId, projectRevision: 1, itemId: scope.id, profileId: 'contract-ready-vinyl', approved: true, readyWallsVerified: true, allowAreaPricing: false, agreedRatePencePerM2: 2600 });
    const packaged = createEstimate(p, c, context); assert.equal(packaged.status, 'ready'); assert.equal(packaged.subtotalPence, 85000); assert.equal(packaged.lines.filter(line => line.category === 'package').length, 1); assert.equal(packaged.lines.some(line => line.category === 'installation'), false);
    c.agreements[0].readyWallsVerified = false; assert.equal(createEstimate(p, c, context).totalPence, null, 'prepared-wall verification is still required'); c.agreements[0].readyWallsVerified = true;
    c.packages[0].approved = false; const missingPackage = createEstimate(p, c, context); assert.equal(missingPackage.totalPence, null); assert.equal(missingPackage.lines.some(line => line.category === 'installation'), false, 'missing packages never fall back to £26/m²'); c.packages[0].approved = true;
    c.agreements = []; assert.equal(createEstimate(p, c, context).totalPence, null, 'the profile still requires explicit project approval');
  }
});
test('legacy fixed package amounts are review data and cannot replace missing component allowances', () => {
  const p = project(), c = config(); p.items = [p.items[0]]; p.items[0].scopeKind = 'feature_wall';
  c.packages = [{ id: 'legacy-package', label: 'Legacy reference awaiting current allowances', scopeKind: 'feature_wall', approved: false, pricePence: 90000, profileIds: ['standard-fabric'], maxNetAreaMm2: 12_000_000, maxWallHeightMm: 3000, maxWalls: 4, maxOpenings: 4, inclusion: 'Historical fixed amount retained for review only.' }];
  assert.equal(validatePricingConfig(c).ok, true, 'unapproved legacy records may be saved for review'); assert.equal(createEstimate(p, c, context).totalPence, null);
  c.packages[0].approved = true; const invalid = validatePricingConfig(c); assert.equal(invalid.ok, false); if (!invalid.ok) for (const key of ['setupPence', 'labourHours', 'labourRatePencePerHour', 'surveyAllowancePence', 'managementAllowancePence']) assert.ok(invalid.issues.some(issue => issue.path === `packages.0.${key}`), `missing ${key} needs explicit configuration`);
  assert.equal(createEstimate(p, c, context).totalPence, null, 'a positive legacy amount cannot make the estimate ready');
});
test('automatic packages always calculate approved components even when a different legacy amount is present', () => {
  for (const legacy of [0, 1, 90000]) {
    const p = project(), c = createDefaultPricingConfig(); p.items = [p.items[0]]; p.items[0].scopeKind = 'single_room'; calculatedPackage(c); c.packages[0].pricePence = legacy;
    assert.equal(validatePricingConfig(c).ok, true); const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.equal(result.subtotalPence, 85000); assert.equal(result.lines[0].amountPence, 85000);
  }
  for (const field of ['setupPence', 'labourHours', 'labourRatePencePerHour', 'surveyAllowancePence', 'managementAllowancePence'] as const) {
    const c = config(); calculatedPackage(c); delete c.packages[0][field]; assert.equal(validatePricingConfig(c).ok, false, `approved ${field} cannot be omitted`);
  }
});
test('a changed site address invalidates bounded survey, management and parking approvals', () => {
  const p = project(), c = config();
  p.logistics.vehicleDays = [{ date: '2026-11-01', vehicleId: 'van', congestionZone: 'no', congestionChargeApplies: 'no', ulezZone: 'no', ulezChargeApplies: 'no', parkingRequired: 'yes' }];
  c.servicePlans[0] = { ...c.servicePlans[0], managementHours: 1, managementRatePence: 10000, surveyHours: 1, surveyRatePence: 10000, parking: [{ date: '2026-11-01', vehicleId: 'van', amountPence: 2000 }], scopeFingerprint: computeApprovalScope(p, undefined, c), minNetAreaMm2: 1, maxNetAreaMm2: 50_000_000 };
  const sameSite = structuredClone(p); sameSite.items[0].walls[0].widthMm = 4500; assert.equal(createEstimate(sameSite, c, { ...context, projectRevision: 2 }).status, 'ready', 'bounded quantity change still works at the approved site');
  for (const mutate of [(value: ProjectDraft) => { value.address.line1 = 'A different project address'; }, (value: ProjectDraft) => { value.address.postcode = 'OTHER'; }, (value: ProjectDraft) => { value.address.line2 = 'A different access entrance'; }]) {
    const moved = structuredClone(p); mutate(moved); assert.notEqual(computeApprovalScope(moved, undefined, c), c.servicePlans[0].scopeFingerprint);
    const result = createEstimate(moved, c, { ...context, projectRevision: 2 }); assert.equal(result.totalPence, null); assert.ok(result.reviewReasons.some(reason => reason.code === 'service-plan-required')); assert.equal(result.lines.some(line => ['management', 'survey'].includes(line.category) || line.label === 'Parking allowance'), false, 'site-specific service and parking allowances cannot silently transfer');
  }
});
test('known preparation actions require priced repair scope, while planned repairs can receive an honest early budget', () => {
  for (const status of ['action-required', 'needs-review'] as const) for (const wholeProject of [false, true]) {
    const p = project(), c = config(); p.resources = { materialRequirements: [], sampleApprovals: [], aftercareReferences: [], preparationChecklist: [{ id: 'repair-check', label: 'Substrate repair actions identified', scopeItemIds: wholeProject ? [] : ['item-1'], status }] };
    const unresolved = createEstimate(p, c, context); assert.equal(unresolved.totalPence, null); assert.ok(unresolved.reviewReasons.some(reason => reason.itemId === 'item-1' && reason.code === 'preparation-check-review-required')); assert.equal(unresolved.lines.some(line => line.itemId === 'item-1'), false);
    const affected = wholeProject ? p.items : [p.items[0]]; affected.forEach(scope => { scope.preparation = 'removal-or-repair'; });
    assert.equal(createEstimate(p, c, context).totalPence, null, 'declaring repairs without an approved allowance is insufficient');
    c.servicePlans[0].serviceEntries = [{ id: 'planned-prep', label: 'Planned substrate repairs before hanging', category: 'preparation', quantity: 1, unit: 'day', ratePence: 40000, rateReviewedOn: '2026-10-18', approved: true, itemIds: affected.map(scope => scope.id) }];
    const budget = createEstimate(p, c, context); assert.equal(budget.status, 'ready'); assert.equal(budget.subtotalPence, 280000); assert.equal(budget.lines.filter(line => line.category === 'preparation').length, 1); assert.ok(budget.assumptions.some(note => /Planned preparation actions/.test(note) && /does not assert that repair work is finished/.test(note)));
    assert.equal(budget.project.resources!.preparationChecklist[0].status, status, 'pricing planned repairs does not mark the physical checklist ready');
  }
});
test('unapproved sample decisions remain clear early-budget assumptions rather than an invented approval', () => {
  const p = project(), c = config(); p.resources = { materialRequirements: [], preparationChecklist: [], aftercareReferences: [], sampleApprovals: [{ id: 'sample', label: 'Setting-out sample awaiting decision', scopeItemIds: [], status: 'changes-required' }] };
  const result = createEstimate(p, c, context); assert.equal(result.status, 'ready'); assert.ok(result.assumptions.some(note => /Sample or setting-out approvals remain outstanding/.test(note))); assert.equal(result.project.resources!.sampleApprovals[0].status, 'changes-required');
});
