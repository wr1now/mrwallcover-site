import type { EstimateLine, EstimateReviewReason, EstimateSnapshot, MaterialGroupId, ProjectDraft, ScopeKind, SharedEstimate, ValidationIssue, ValidationResult } from '../../src/designer-portal/types.ts';
import { hasCompleteScopeGeometry, isCalendarDate, measureScopeArea, validateProjectDraft } from '../../src/designer-portal/validation.ts';
import type { PublicProduct } from '../../src/designer-portal/catalog.ts';
import { priceLogistics } from './logistics.ts';
import type { LogisticsConfig, ServicePlan } from './logistics.ts';
export type { ServicePlan } from './logistics.ts';

export interface InstallationProfile {
  id: string; label: string; materialGroupId: MaterialGroupId; verifiedTypeId?: string; productId?: string;
  approved: boolean; ratePencePerM2: number | null; preparations: ProjectDraft['items'][number]['preparation'][];
  requiresProjectAgreement: boolean; reviewRequired: boolean; surfaceKinds?: ('wall' | 'ceiling')[]; traits: { acoustic: boolean; velvet: boolean; specialist: boolean };
}
export interface ApprovedPackage { id: string; label: string; scopeKind: 'feature_wall' | 'single_room'; approved: boolean; /** Legacy reference only; automatic prices always use the approved components. */ pricePence: number | null; profileIds: string[]; maxNetAreaMm2: number; inclusion: string; setupPence?: number; labourHours?: number; labourRatePencePerHour?: number; surveyAllowancePence?: number; managementAllowancePence?: number; routineServiceApproved?: boolean; maxWallHeightMm?: number; maxWalls?: number; maxOpenings?: number; surfaceKinds?: ('wall' | 'ceiling')[]; maxCeilings?: number; maxCeilingWidthMm?: number; maxCeilingLengthMm?: number }
export interface ProjectAgreement { id: string; projectId: string; projectRevision: number; itemId?: string; profileId?: string; packageId?: string; approved: boolean; readyWallsVerified: boolean; agreedRatePencePerM2?: number; allowAreaPricing?: boolean; scopeFingerprint?: string; minNetAreaMm2?: number; maxNetAreaMm2?: number }
export interface ProductSpecification extends PublicProduct { approved: boolean; verified: boolean; installationProfileId?: string; traits?: { acoustic: boolean | null; velvet: boolean | null; specialist: boolean | null } }
export interface PricingConfig { version: string; active: boolean; vatRateBps: number | null; profiles: InstallationProfile[]; products?: ProductSpecification[]; packages: ApprovedPackage[]; agreements: ProjectAgreement[]; servicePlans: ServicePlan[]; logistics: LogisticsConfig }
export interface EstimateContext { id: string; projectId: string; projectRevision: number; createdAt: string }
/** Owner-approved technical metadata only; private profile mappings and prices never leave this projection. */
export function getPublicProductCatalog(config: PricingConfig): PublicProduct[] {
  const keys = ['id', 'manufacturer', 'name', 'code', 'collection', 'groupId', 'sourceUrl', 'instructionsUrl', 'sourceReviewedOn', 'construction', 'faceMaterial', 'backingMaterial', 'coating', 'pile', 'relief', 'suppliedFormat', 'widthMm', 'heightMm', 'repeatMm', 'thicknessMm', 'weightGsm', 'patternMatch', 'hangingMethod', 'hangingDirection', 'pastingMethod', 'trimmingMethod', 'jointingMethod', 'cornerTreatment', 'handlingRequirements', 'notes'];
  return (config.products ?? []).filter(p => p.approved && p.verified).map(p => Object.fromEntries(Object.entries(p).filter(([key]) => keys.includes(key)))) as unknown as PublicProduct[];
}
const MAX_PENCE = 1_000_000_000;
const groups = ['printed-paper', 'printed-nonwoven', 'vinyl-coated-paper', 'domestic-vinyl', 'wide-contract-vinyl', 'standard-fabric', 'velvet-flock-pile', 'formed-acoustic', 'specialists'];
const preparations = ['normal-prep-lining-hanging', 'contract-ready', 'removal-or-repair', 'unknown'];
/** Admin configuration still crosses a trust boundary: reject unknown fields and unsafe numbers. */
export function validatePricingConfig(input: unknown): ValidationResult<PricingConfig> {
  const issues: ValidationIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, code: 'configuration', message });
  const object = (v: unknown, p: string, keys: string[]) => { if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) { fail(p, 'Use a plain object.'); return {} as Record<string, unknown>; } const o = v as Record<string, unknown>; for (const k of Object.keys(o)) if (!keys.includes(k)) fail(`${p}.${k}`, 'Unknown configuration field.'); return o; };
  const text = (v: unknown, p: string, max = 500, optional = false) => { if (optional && v === undefined) return; if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u001F\u007F]/.test(v)) fail(p, 'Use bounded nonempty text.'); };
  const id = (v: unknown, p: string, optional = false) => { if (optional && v === undefined) return; if (typeof v !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(v)) fail(p, 'Use a stable identifier.'); };
  const number = (v: unknown, p: string, min: number, max: number, optional = false, nullable = false) => { if ((optional && v === undefined) || (nullable && v === null)) return; if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > max) fail(p, 'Use a bounded whole number.'); };
  const bool = (v: unknown, p: string, optional = false) => { if (!(optional && v === undefined) && typeof v !== 'boolean') fail(p, 'Use true or false.'); };
  const array = (v: unknown, p: string, max: number) => { if (!Array.isArray(v) || v.length > max) { fail(p, 'Use a bounded array.'); return [] as unknown[]; } return v; };
  const unique = (xs: unknown[], p: string) => { const ids = xs.map(x => (x as Record<string, unknown>)?.id); if (ids.length !== new Set(ids).size) fail(p, 'Identifiers must be unique.'); };
  function validateBounds(o: Record<string, unknown>, p: string) {
    text(o.scopeFingerprint, `${p}.scopeFingerprint`, 200_000, true);
    number(o.minNetAreaMm2, `${p}.minNetAreaMm2`, 0, 250_000_000_000, true);
    number(o.maxNetAreaMm2, `${p}.maxNetAreaMm2`, 1, 250_000_000_000, true);
    if ([o.scopeFingerprint, o.minNetAreaMm2, o.maxNetAreaMm2].some(x => x !== undefined) && (o.scopeFingerprint === undefined || o.minNetAreaMm2 === undefined || o.maxNetAreaMm2 === undefined || Number(o.maxNetAreaMm2) < Number(o.minNetAreaMm2))) fail(p, 'Quantity revision approval requires a scope fingerprint and ordered minimum/maximum area bounds.');
    if (o.agreedRatePencePerM2 !== undefined && !o.profileId) fail(p, 'An agreed rate must identify its installation profile.');
  }
  const c = object(input, 'config', ['version', 'active', 'vatRateBps', 'profiles', 'products', 'packages', 'agreements', 'servicePlans', 'logistics']);
  id(c.version, 'version'); bool(c.active, 'active'); number(c.vatRateBps, 'vatRateBps', 0, 10_000, false, true);
  const profiles = array(c.profiles, 'profiles', 200); unique(profiles, 'profiles');
  profiles.forEach((v, i) => { const p = `profiles.${i}`, o = object(v, p, ['id', 'label', 'materialGroupId', 'verifiedTypeId', 'productId', 'approved', 'ratePencePerM2', 'preparations', 'requiresProjectAgreement', 'reviewRequired', 'surfaceKinds', 'traits']); id(o.id, `${p}.id`); text(o.label, `${p}.label`, 160); if (!groups.includes(String(o.materialGroupId))) fail(`${p}.materialGroupId`, 'Unknown material group.'); id(o.verifiedTypeId, `${p}.verifiedTypeId`, true); id(o.productId, `${p}.productId`, true); if (!o.productId && !o.verifiedTypeId) fail(p, 'Specify a verified type or exact product.'); number(o.ratePencePerM2, `${p}.ratePencePerM2`, 1, MAX_PENCE, false, true); for (const k of ['approved', 'requiresProjectAgreement', 'reviewRequired']) bool(o[k], `${p}.${k}`); const prep = array(o.preparations, `${p}.preparations`, 4); if (!prep.length || prep.some(x => !preparations.includes(String(x)))) fail(`${p}.preparations`, 'Choose known preparation states.'); if (o.surfaceKinds !== undefined) { const surfaces = array(o.surfaceKinds, `${p}.surfaceKinds`, 2); if (!surfaces.length || new Set(surfaces).size !== surfaces.length || surfaces.some(x => !['wall', 'ceiling'].includes(String(x)))) fail(`${p}.surfaceKinds`, 'Choose the explicitly approved wall or ceiling surfaces.'); } const traits = object(o.traits, `${p}.traits`, ['acoustic', 'velvet', 'specialist']); for (const k of ['acoustic', 'velvet', 'specialist']) bool(traits[k], `${p}.traits.${k}`); });
  const profileIds = new Set(profiles.map(x => (x as Record<string, unknown>)?.id));
  if (c.products !== undefined) {
    const products = array(c.products, 'products', 2000); unique(products, 'products');
    products.forEach((v, i) => {
      const p = `products.${i}`, o = object(v, p, ['id', 'manufacturer', 'name', 'code', 'collection', 'groupId', 'approved', 'verified', 'construction', 'faceMaterial', 'backingMaterial', 'coating', 'pile', 'relief', 'suppliedFormat', 'widthMm', 'heightMm', 'repeatMm', 'thicknessMm', 'weightGsm', 'patternMatch', 'hangingMethod', 'hangingDirection', 'pastingMethod', 'trimmingMethod', 'jointingMethod', 'cornerTreatment', 'handlingRequirements', 'sourceUrl', 'instructionsUrl', 'sourceReviewedOn', 'notes', 'installationProfileId', 'verifiedTypeId', 'traits']);
      id(o.id, `${p}.id`); text(o.manufacturer, `${p}.manufacturer`, 200); text(o.name, `${p}.name`, 200); for (const k of ['code', 'collection']) text(o[k], `${p}.${k}`, 200, true); for (const k of ['approved', 'verified']) bool(o[k], `${p}.${k}`); if (!groups.includes(String(o.groupId))) fail(`${p}.groupId`, 'Use a known material group.');
      for (const k of ['construction', 'faceMaterial', 'backingMaterial', 'coating', 'pile', 'relief', 'patternMatch', 'hangingMethod', 'hangingDirection', 'pastingMethod', 'trimmingMethod', 'jointingMethod', 'cornerTreatment', 'handlingRequirements']) if (o[k] !== null) text(o[k], `${p}.${k}`, 2000, true);
      text(o.notes, `${p}.notes`, 2000, true); for (const k of ['widthMm', 'heightMm', 'repeatMm', 'weightGsm']) number(o[k], `${p}.${k}`, 0, 1_000_000, true, true);
      if (o.thicknessMm !== undefined && o.thicknessMm !== null && (typeof o.thicknessMm !== 'number' || !Number.isFinite(o.thicknessMm) || o.thicknessMm <= 0 || o.thicknessMm > 1000)) fail(`${p}.thicknessMm`, 'Use a published thickness in millimetres or leave unknown.');
      if (o.suppliedFormat !== undefined && !['roll', 'panel', 'sheet', 'other', 'unknown'].includes(String(o.suppliedFormat))) fail(`${p}.suppliedFormat`, 'Choose a known supplied format.');
      for (const k of ['sourceUrl', 'instructionsUrl']) if (o[k] !== undefined) { text(o[k], `${p}.${k}`, 1000); try { const url = new URL(String(o[k])); if (url.protocol !== 'https:' || url.username || url.password) fail(`${p}.${k}`, 'Use an HTTPS source without embedded credentials.'); } catch { fail(`${p}.${k}`, 'Use a valid source URL.'); } }
      if (o.sourceReviewedOn !== undefined && !isCalendarDate(o.sourceReviewedOn)) fail(`${p}.sourceReviewedOn`, 'Record the source review date.');
      id(o.installationProfileId, `${p}.installationProfileId`, true); id(o.verifiedTypeId, `${p}.verifiedTypeId`, true); if (o.installationProfileId && !profileIds.has(o.installationProfileId)) fail(`${p}.installationProfileId`, 'Use an existing installation profile.');
      if (o.approved === true) {
        if (o.verified !== true) fail(`${p}.verified`, 'Verify the exact product evidence before approving its classification.');
        for (const k of ['sourceUrl', 'instructionsUrl']) if (typeof o[k] !== 'string' || !o[k]) fail(`${p}.${k}`, 'An approved product requires its product source and exact installation instructions.');
        if (!isCalendarDate(o.sourceReviewedOn)) fail(`${p}.sourceReviewedOn`, 'An approved product requires the source review date.');
        const mapped = profiles.filter(v => { const profile = v as Record<string, unknown>; return o.installationProfileId ? profile.id === o.installationProfileId : !!o.verifiedTypeId && profile.verifiedTypeId === o.verifiedTypeId; }) as unknown as InstallationProfile[];
        if (mapped.length !== 1 || mapped[0].materialGroupId !== o.groupId || (o.verifiedTypeId && mapped[0].verifiedTypeId !== o.verifiedTypeId)) fail(p, 'An approved product requires one explicit, compatible installation-profile or verified-type mapping.');
      }
      if (o.traits !== undefined) { const traits = object(o.traits, `${p}.traits`, ['acoustic', 'velvet', 'specialist']); for (const k of ['acoustic', 'velvet', 'specialist']) if (traits[k] !== null) bool(traits[k], `${p}.traits.${k}`); }
    });
  }
  const packages = array(c.packages, 'packages', 200); unique(packages, 'packages');
  packages.forEach((v, i) => {
    const p = `packages.${i}`, o = object(v, p, ['id', 'label', 'scopeKind', 'approved', 'pricePence', 'profileIds', 'maxNetAreaMm2', 'inclusion', 'setupPence', 'labourHours', 'labourRatePencePerHour', 'surveyAllowancePence', 'managementAllowancePence', 'routineServiceApproved', 'maxWallHeightMm', 'maxWalls', 'maxOpenings', 'surfaceKinds', 'maxCeilings', 'maxCeilingWidthMm', 'maxCeilingLengthMm']);
    id(o.id, `${p}.id`); text(o.label, `${p}.label`, 160);
    if (!['feature_wall', 'single_room'].includes(String(o.scopeKind))) fail(`${p}.scopeKind`, 'Choose a small-scope package kind.');
    bool(o.approved, `${p}.approved`); number(o.pricePence, `${p}.pricePence`, 0, MAX_PENCE, false, true);
    number(o.maxNetAreaMm2, `${p}.maxNetAreaMm2`, 1, 100_000_000_000); text(o.inclusion, `${p}.inclusion`);
    // A legacy fixed amount is retained as evidence, never as an alternate price.
    // An unapproved record can be saved while its current components are reviewed.
    for (const k of ['setupPence', 'labourRatePencePerHour', 'surveyAllowancePence', 'managementAllowancePence']) number(o[k], `${p}.${k}`, k === 'labourRatePencePerHour' && o.approved === true ? 1 : 0, MAX_PENCE, o.approved !== true);
    if ((o.approved === true || o.labourHours !== undefined) && (typeof o.labourHours !== 'number' || !Number.isFinite(o.labourHours) || o.labourHours < (o.approved === true ? 0.25 : 0) || o.labourHours > 10000 || !Number.isSafeInteger(o.labourHours * 4))) fail(`${p}.labourHours`, 'An approved package needs positive labour in bounded quarter-hour increments.');
    bool(o.routineServiceApproved, `${p}.routineServiceApproved`, true);
    number(o.maxWallHeightMm, `${p}.maxWallHeightMm`, 1, 30000, o.approved !== true); number(o.maxWalls, `${p}.maxWalls`, 1, 1000, o.approved !== true); number(o.maxOpenings, `${p}.maxOpenings`, 0, 10000, o.approved !== true);
    for (const k of ['maxCeilings', 'maxCeilingWidthMm', 'maxCeilingLengthMm']) number(o[k], `${p}.${k}`, 1, k === 'maxCeilings' ? 1000 : 100000, true);
    if (o.surfaceKinds !== undefined) {
      const surfaces = array(o.surfaceKinds, `${p}.surfaceKinds`, 2);
      if (!surfaces.length || new Set(surfaces).size !== surfaces.length || surfaces.some(x => !['wall', 'ceiling'].includes(String(x)))) fail(`${p}.surfaceKinds`, 'Choose the approved package surface kinds.');
      if (o.approved === true && surfaces.includes('ceiling')) for (const k of ['maxCeilings', 'maxCeilingWidthMm', 'maxCeilingLengthMm']) if (o[k] === undefined) fail(`${p}.${k}`, 'An approved ceiling package requires its explicit geometry bounds.');
    }
    const ids = array(o.profileIds, `${p}.profileIds`, 200); if (!ids.length || ids.some(x => !profileIds.has(x))) fail(`${p}.profileIds`, 'Use existing profile IDs.');
  });
  const packageIds = new Set(packages.map(x => (x as Record<string, unknown>)?.id));
  const agreements = array(c.agreements, 'agreements', 1000); unique(agreements, 'agreements');
  agreements.forEach((v, i) => { const p = `agreements.${i}`, o = object(v, p, ['id', 'projectId', 'projectRevision', 'itemId', 'profileId', 'packageId', 'approved', 'readyWallsVerified', 'agreedRatePencePerM2', 'allowAreaPricing', 'scopeFingerprint', 'minNetAreaMm2', 'maxNetAreaMm2']); id(o.id, `${p}.id`); id(o.projectId, `${p}.projectId`); number(o.projectRevision, `${p}.projectRevision`, 1, 1_000_000); for (const k of ['itemId', 'profileId', 'packageId']) id(o[k], `${p}.${k}`, true); if (o.profileId && !profileIds.has(o.profileId)) fail(`${p}.profileId`, 'Unknown profile.'); if (o.packageId && !packageIds.has(o.packageId)) fail(`${p}.packageId`, 'Unknown package.'); bool(o.approved, `${p}.approved`); bool(o.readyWallsVerified, `${p}.readyWallsVerified`); bool(o.allowAreaPricing, `${p}.allowAreaPricing`, true); number(o.agreedRatePencePerM2, `${p}.agreedRatePencePerM2`, 1, MAX_PENCE, true); validateBounds(o, p); });
  const plans = array(c.servicePlans, 'servicePlans', 1000); unique(plans, 'servicePlans');
  plans.forEach((v, i) => { const p = `servicePlans.${i}`, o = object(v, p, ['id', 'projectId', 'projectRevision', 'approved', 'programmeReviewed', 'propertyContextReviewed', 'managementHours', 'managementRatePence', 'surveyHours', 'surveyRatePence', 'deliveryPence', 'storagePence', 'accessEquipmentPence', 'wasteRemovalPence', 'parking', 'scopeFingerprint', 'minNetAreaMm2', 'maxNetAreaMm2', 'additionalServicesOnly', 'roadCharges', 'accessReviewed', 'materialReadinessReviewed', 'serviceEntries']); id(o.id, `${p}.id`); id(o.projectId, `${p}.projectId`); number(o.projectRevision, `${p}.projectRevision`, 1, 1_000_000); for (const k of ['approved', 'programmeReviewed', 'propertyContextReviewed']) bool(o[k], `${p}.${k}`); validateBounds(o, p); bool(o.additionalServicesOnly, `${p}.additionalServicesOnly`, true); bool(o.accessReviewed, `${p}.accessReviewed`, true); bool(o.materialReadinessReviewed, `${p}.materialReadinessReviewed`, true); if (o.serviceEntries !== undefined) { const entries = array(o.serviceEntries, `${p}.serviceEntries`, 200); unique(entries, `${p}.serviceEntries`); entries.forEach((value, j) => { const ep = `${p}.serviceEntries.${j}`, entry = object(value, ep, ['id', 'category', 'label', 'quantity', 'unit', 'ratePence', 'rateReviewedOn', 'approved', 'itemIds']); id(entry.id, `${ep}.id`); text(entry.label, `${ep}.label`, 160); if (!['survey', 'management', 'preparation'].includes(String(entry.category))) fail(`${ep}.category`, 'Choose survey, management or additional preparation.'); if (!['hour', 'day', 'visit'].includes(String(entry.unit))) fail(`${ep}.unit`, 'Use hours, days or visits.'); const quantity = Number(entry.quantity); if (typeof entry.quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0 || quantity > 10000 || !Number.isSafeInteger(quantity * (entry.unit === 'visit' ? 1 : 4))) fail(`${ep}.quantity`, 'Use positive quarter-hours/days or whole visits within the supported range.'); number(entry.ratePence, `${ep}.ratePence`, 1, MAX_PENCE, false, true); bool(entry.approved, `${ep}.approved`); if (entry.rateReviewedOn !== undefined && !isCalendarDate(entry.rateReviewedOn)) fail(`${ep}.rateReviewedOn`, 'Record the current rate review date.'); if (entry.itemIds !== undefined) { const ids = array(entry.itemIds, `${ep}.itemIds`, 200); ids.forEach((value, n) => id(value, `${ep}.itemIds.${n}`)); if (new Set(ids).size !== ids.length) fail(`${ep}.itemIds`, 'Each linked scope is listed once.'); } if (entry.approved === true && (entry.ratePence === null || !isCalendarDate(entry.rateReviewedOn))) fail(ep, 'Approving a service requires its positive current rate and review date.'); if (entry.category === 'preparation' && (!Array.isArray(entry.itemIds) || entry.itemIds.length === 0)) fail(`${ep}.itemIds`, 'Additional preparation must identify the scope items it covers.'); }); } const roadKeys = new Set<string>(); if (o.roadCharges !== undefined) array(o.roadCharges, `${p}.roadCharges`, 732).forEach((v, j) => { const pp = `${p}.roadCharges.${j}`, a = object(v, pp, ['date', 'vehicleId', 'scheme', 'amountPence', 'source']); if (!isCalendarDate(a.date)) fail(`${pp}.date`, 'Use a valid date.'); id(a.vehicleId, `${pp}.vehicleId`); if (!['congestion', 'ulez'].includes(String(a.scheme))) fail(`${pp}.scheme`, 'Use a known charging scheme.'); number(a.amountPence, `${pp}.amountPence`, 0, 100000); text(a.source, `${pp}.source`, 500); const key = `${a.date}:${a.vehicleId}:${a.scheme}`; if (roadKeys.has(key)) fail(pp, 'Duplicate vehicle-day road charge.'); roadKeys.add(key); }); for (const k of ['managementHours', 'surveyHours']) if (o[k] !== undefined && (typeof o[k] !== 'number' || !Number.isFinite(o[k]) || Number(o[k]) < 0 || Number(o[k]) > 10_000 || !Number.isSafeInteger(Number(o[k]) * 4))) fail(`${p}.${k}`, 'Use quarter-hour increments within the supported range.'); for (const k of ['managementRatePence', 'surveyRatePence', 'deliveryPence', 'storagePence', 'accessEquipmentPence', 'wasteRemovalPence']) number(o[k], `${p}.${k}`, 0, MAX_PENCE, true); const parking = array(o.parking, `${p}.parking`, 366); const keys = new Set<string>(); parking.forEach((v, j) => { const pp = `${p}.parking.${j}`, a = object(v, pp, ['date', 'vehicleId', 'amountPence']); if (!isCalendarDate(a.date)) fail(`${pp}.date`, 'Use a valid calendar date.'); id(a.vehicleId, `${pp}.vehicleId`); number(a.amountPence, `${pp}.amountPence`, 0, 100_000); const key = `${a.date}:${a.vehicleId}`; if (keys.has(key)) fail(pp, 'Duplicate vehicle-day parking allowance.'); keys.add(key); }); });
  const l = object(c.logistics, 'logistics', ['congestionPence', 'ulezPence', 'reviewedOn', 'congestionSourceUrl', 'ulezSourceUrl', 'congestionEffectiveFrom', 'congestionEffectiveUntil', 'ulezEffectiveFrom', 'ulezEffectiveUntil']); number(l.congestionPence, 'logistics.congestionPence', 0, 100_000); number(l.ulezPence, 'logistics.ulezPence', 0, 100_000); if (!isCalendarDate(l.reviewedOn)) fail('logistics.reviewedOn', 'Record a valid tariff review date.'); for (const k of ['congestionSourceUrl', 'ulezSourceUrl']) { text(l[k], `logistics.${k}`, 500); if (typeof l[k] === 'string') { try { if (new URL(l[k]).protocol !== 'https:') fail(`logistics.${k}`, 'Use an HTTPS source.'); } catch { fail(`logistics.${k}`, 'Use a valid source URL.'); } } }
  for (const scheme of ['congestion', 'ulez']) { const from = l[`${scheme}EffectiveFrom`], until = l[`${scheme}EffectiveUntil`]; if (from !== undefined && !isCalendarDate(from)) fail(`logistics.${scheme}EffectiveFrom`, 'Use a valid effective date.'); if (until !== undefined && until !== null && !isCalendarDate(until)) fail(`logistics.${scheme}EffectiveUntil`, 'Use a valid approved end date or leave unapproved.'); if (typeof from === 'string' && typeof until === 'string' && until < from) fail(`logistics.${scheme}EffectiveUntil`, 'The approved end date must follow the effective date.'); }
  return issues.length ? { ok: false, issues } : { ok: true, value: structuredClone(input) as PricingConfig };
}

function roundedDivision(value: bigint, divisor: bigint): number { const amount = (value + divisor / 2n) / divisor; if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Estimate exceeds the safe money range.'); return Number(amount); }
export function priceAreaPence(areaMm2: number, ratePencePerM2: number): number { if (!Number.isSafeInteger(areaMm2) || areaMm2 < 0 || !Number.isSafeInteger(ratePencePerM2) || ratePencePerM2 < 0) throw new RangeError('Area and price must be nonnegative safe integers.'); return roundedDivision(BigInt(areaMm2) * BigInt(ratePencePerM2), 1_000_000n); }
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

/** Exact private scope, not a lossy hash. Only wall widths may vary under bounded quantity approval. */
export function computeApprovalScope(project: ProjectDraft, itemId?: string, config?: PricingConfig): string {
  const items = project.items.filter(x => !itemId || x.id === itemId).map(x => ({ id: x.id, roomId: x.roomId, floor: project.rooms.find(r => r.id === x.roomId)?.floor, scopeKind: x.scopeKind, material: x.material, preparation: x.preparation, access: x.access, packageId: x.packageId, surfaceKind: x.surfaceKind ?? 'wall', ceilings: x.ceilings, geometryContext: x.walls.map(w => ({ id: w.id, heightMm: w.heightMm, count: w.count, openings: [...w.openings].sort((a, b) => a.id.localeCompare(b.id)), reveals: [...w.reveals].sort((a, b) => a.id.localeCompare(b.id)) })).sort((a, b) => a.id.localeCompare(b.id)) })).sort((a, b) => a.id.localeCompare(b.id));
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
  const selectedItems = project.items.filter(x => !itemId || x.id === itemId);
  const productIds = new Set(selectedItems.map(x => x.material.productId).filter(Boolean));
  const productSpecifications = [...productIds].sort().map(id => config?.products?.find(p => p.id === id) ?? { id, unverified: true });
  const profileIds = new Set(selectedItems.flatMap(item => {
    const product = config?.products?.find(p => p.id === item.material.productId);
    return (config?.profiles ?? []).filter(p => product ? product.installationProfileId ? p.id === product.installationProfileId : !!product.verifiedTypeId && p.verifiedTypeId === product.verifiedTypeId : !!item.material.verifiedTypeId && p.verifiedTypeId === item.material.verifiedTypeId).map(p => p.id);
  }));
  const installationSpecifications = (config?.profiles ?? []).filter(p => profileIds.has(p.id)).map(({ ratePencePerM2: _price, label: _label, ...technical }) => technical).sort((a, b) => a.id.localeCompare(b.id));
  return `scope-v4:${JSON.stringify(canonical({ items, productSpecifications, installationSpecifications, address: project.address, programme: project.programme, logistics: project.logistics, buildingType: project.buildingType, resources: project.resources, propertyValuePence: project.propertyValuePence }))}`;
}
function approvalMatches(approval: { projectRevision: number; scopeFingerprint?: string; minNetAreaMm2?: number; maxNetAreaMm2?: number }, project: ProjectDraft, revision: number, itemId?: string, config?: PricingConfig): boolean {
  if (!approval.scopeFingerprint) return !project.items.some(x => (!itemId || x.id === itemId) && x.material.productId) && approval.projectRevision === revision;
  const area = project.items.filter(x => !itemId || x.id === itemId).reduce((sum, item) => sum + measureScopeArea(item).netMm2, 0);
  return approval.scopeFingerprint === computeApprovalScope(project, itemId, config) && approval.minNetAreaMm2 !== undefined && approval.maxNetAreaMm2 !== undefined && area >= approval.minNetAreaMm2 && area <= approval.maxNetAreaMm2;
}

export function createEstimate(draft: ProjectDraft, rawConfig: PricingConfig | null | undefined, context: EstimateContext): EstimateSnapshot {
  const validation = validateProjectDraft(draft);
  if (!validation.ok) throw new TypeError(`Invalid project draft: ${validation.issues.map(x => x.path).join(', ')}`);
  for (const k of ['id', 'projectId'] as const) if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(context[k])) throw new TypeError('Invalid estimate identity.');
  if (!Number.isSafeInteger(context.projectRevision) || context.projectRevision < 1 || context.projectRevision > 1_000_000 || !Number.isFinite(Date.parse(context.createdAt))) throw new TypeError('Invalid estimate revision or date.');
  const created = new Date(context.createdAt), project = validation.value;
  const configValidation = validatePricingConfig(rawConfig);
  const config = configValidation.ok ? configValidation.value : undefined;
  const lines: EstimateLine[] = [], reviewReasons: EstimateReviewReason[] = [];
  let informationMissing = false;
  const review = (code: string, message: string, itemId?: string, information = false) => { reviewReasons.push({ code, message, ...(itemId ? { itemId } : {}) }); if (information) informationMissing = true; };
  if (!config || !config.active) review('configuration-required', 'An active owner-approved pricing configuration is required.');
  if (!project.name.trim() || !project.contact.name.trim() || !project.contact.email.trim() || !project.address.line1.trim() || !project.address.town.trim() || !project.address.postcode.trim()) review('project-details-required', 'Complete the project, contact and site details.', undefined, true);
  if (!project.buildingType || project.buildingType === 'unknown') review('building-type-required', 'Confirm the building type so the installation and service scope can be assessed.', undefined, true);
  if (!project.items.length || !project.rooms.length) review('scope-required', 'Add the rooms and installation scope.', undefined, true);
  if (!project.programme.startDate || !project.programme.endDate || project.programme.occupied === 'unknown' || project.programme.outOfHours === 'unknown') review('programme-required', 'Confirm the programme dates, occupation and working-hours requirements.', undefined, true);
  const plans = config?.servicePlans.filter(x => x.approved && x.projectId === context.projectId && approvalMatches(x, project, context.projectRevision, undefined, config)) ?? [];
  const plan = plans.length === 1 ? plans[0] : undefined;
  if (plan && !plan.programmeReviewed) review('programme-review-required', 'The service plan must account for the project programme.');
  if (project.propertyValuePence !== undefined && (!plan || !plan.propertyContextReviewed)) review('private-context-review-required', 'The declared private project context needs owner service-plan review.');
  const readiness = project.programme.materialReadiness;
  const readinessAssumptions: string[] = [];
  const resourceAssumptions: string[] = [];
  if (project.resources?.sampleApprovals.some(sample => sample.status !== 'approved')) resourceAssumptions.push('Sample or setting-out approvals remain outstanding. This budget assumes the stated specification; approval changes require a revised assessment before installation.');
  const readinessKnown = readiness && readiness.status !== 'unknown';
  const readinessHasDate = readiness?.readyDate && (!project.programme.startDate || readiness.readyDate <= project.programme.startDate);
  if (readiness?.readyDate && project.programme.startDate && readiness.readyDate > project.programme.startDate && !plan?.materialReadinessReviewed) review('material-programme-conflict', 'The expected material-ready date falls after the planned start; revise the programme or obtain an owner provisional assessment.', undefined, true);
  if (!readinessKnown || (!['checked-ready', 'delivered'].includes(readiness!.status) && !readinessHasDate)) {
    if (!plan?.materialReadinessReviewed) review('material-readiness-required', 'Confirm material readiness and its expected date, or obtain an owner-reviewed provisional allowance.', undefined, true);
    else readinessAssumptions.push('Material availability is provisional under the owner-reviewed programme; this budget does not confirm readiness or reserve installation dates.');
  } else {
    readinessAssumptions.push(`Material status: ${readiness!.status.replaceAll('-', ' ')}${readiness?.readyDate ? `; expected ready ${readiness.readyDate}` : ''}. The client must supply the complete specified materials; physical readiness is checked before installation.`);
  }
  if (readiness?.scopeItemIds.length && project.items.some(item => !readiness.scopeItemIds.includes(item.id)) && !plan?.materialReadinessReviewed) review('material-readiness-scope-required', 'The material-readiness assessment must cover every installation scope or have an owner-reviewed provisional assessment.', undefined, true);
  const approvedPreparation = (itemId: string) => plan?.serviceEntries?.some(entry => entry.category === 'preparation' && entry.approved && entry.ratePence !== null && !!entry.rateReviewedOn && entry.itemIds?.includes(itemId));
  const roomCount = new Set(project.items.map(x => x.roomId)).size;
  const packageGroups = new Map<string, { template: ApprovedPackage; items: ProjectDraft['items'] }>();
  const packagedItems = new Set<string>();
  for (const item of project.items) {
    const area = measureScopeArea(item);
    const surfaceKind = item.surfaceKind ?? 'wall';
    const completeGeometry = hasCompleteScopeGeometry(item);
    if (!item.label.trim() || !project.rooms.find(x => x.id === item.roomId)?.label.trim() || !project.rooms.find(x => x.id === item.roomId)?.floor.trim() || !item.confirmedMeasurements || !completeGeometry || area.netMm2 <= 0) { review('measurements-required', 'Confirm the room, floor and every measured wall or ceiling face, uncovered opening and covered reveal. Measure or remove zero-sized rectangles.', item.id, true); continue; }
    if (!item.material.clientProvided) { review('client-materials-required', 'All wallcovering, lining, adhesives and primers must be client provided for these guide profiles.', item.id); continue; }
    if (item.access === 'unknown' || (item.access !== 'standard' && !plan?.accessReviewed)) { review('access-review-required', 'Access requirements need an owner-approved assessment for this project scope.', item.id, item.access === 'unknown'); continue; }
    if (item.preparation === 'unknown') { review('preparation-required', 'Confirm the substrate and preparation scope.', item.id, true); continue; }
    if (item.preparation === 'removal-or-repair' && !approvedPreparation(item.id)) { review('preparation-service-required', 'Removal or repair needs a separately approved preparation service linked to this scope.', item.id); continue; }
    const unresolvedPreparation = project.resources?.preparationChecklist.some(check => ['action-required', 'needs-review'].includes(check.status) && (!check.scopeItemIds.length || check.scopeItemIds.includes(item.id)));
    if (unresolvedPreparation) {
      if (item.preparation !== 'removal-or-repair' || !approvedPreparation(item.id)) { review('preparation-check-review-required', 'The preparation checklist records unresolved actions for this scope. Confirm removal or repair and its separately approved preparation allowance before completing the budget.', item.id); continue; }
      resourceAssumptions.push(`Planned preparation actions for ${item.label} are covered by the separately approved additional preparation service. The substrate must be checked ready before installation; this budget does not assert that repair work is finished.`);
    }
    const product = item.material.productId ? config?.products?.find(p => p.id === item.material.productId) : undefined;
    if (item.material.productId && (!product || !product.approved || !product.verified)) { review('product-verification-required', 'The exact product needs a verified, owner-approved registry entry and installation mapping.', item.id); continue; }
    const effectiveTraits = { acoustic: item.material.acoustic, velvet: item.material.velvet, specialist: item.material.specialist };
    if (product) {
      if (product.groupId !== item.material.groupId) { review('material-conflict', 'The selected material group conflicts with the verified product construction.', item.id); continue; }
      for (const key of ['acoustic', 'velvet', 'specialist'] as const) {
        const authoritative = product.traits?.[key];
        if (authoritative === undefined || authoritative === null) effectiveTraits[key] = 'unknown';
        else if (item.material[key] !== 'unknown' && (item.material[key] === 'yes') !== authoritative) { review('material-conflict', 'The declared construction conflicts with the verified product record.', item.id); effectiveTraits[key] = 'unknown'; }
        else effectiveTraits[key] = authoritative ? 'yes' : 'no';
      }
    }
    if (Object.values(effectiveTraits).some(x => x === 'unknown')) { review('material-information-required', 'Confirm the exact material construction and handling requirements.', item.id, true); continue; }
    const hasUnresolvedProduct = !item.material.productId && [item.material.manufacturer, item.material.productName, item.material.productCode].some(x => x?.trim());
    const profiles = hasUnresolvedProduct ? [] : config?.profiles.filter(p => product ? product.installationProfileId ? p.id === product.installationProfileId : !!product.verifiedTypeId && p.verifiedTypeId === product.verifiedTypeId : !!item.material.verifiedTypeId && p.verifiedTypeId === item.material.verifiedTypeId) ?? [];
    if (profiles.length !== 1) { review('material-profile-required', 'An exact product or verified material type must resolve to one approved installation profile.', item.id); continue; }
    const profile = profiles[0], normal = (value: string) => value.trim().toLowerCase();
    if ((item.material.verifiedTypeId && item.material.verifiedTypeId !== profile.verifiedTypeId) || (product?.verifiedTypeId && product.verifiedTypeId !== profile.verifiedTypeId) || (product && ((item.material.manufacturer && normal(item.material.manufacturer) !== normal(product.manufacturer)) || (item.material.productName && normal(item.material.productName) !== normal(product.name)) || (item.material.productCode && normal(item.material.productCode) !== normal(product.code ?? ''))))) { review('material-conflict', 'The exact product and material classification conflict; confirm the specification.', item.id); continue; }
    if (!profile.approved || profile.reviewRequired || profile.materialGroupId !== item.material.groupId || !(profile.preparations.includes(item.preparation) || (item.preparation === 'removal-or-repair' && approvedPreparation(item.id) && profile.preparations.includes('normal-prep-lining-hanging'))) || !(profile.surfaceKinds ?? ['wall']).includes(surfaceKind as 'wall' | 'ceiling') || (['acoustic', 'velvet', 'specialist'] as const).some(k => profile.traits[k] !== (effectiveTraits[k] === 'yes'))) { review('profile-review-required', 'The selected product, preparation or specialist characteristics require review.', item.id); continue; }
    const agreements = config?.agreements.filter(a => a.approved && a.projectId === context.projectId && approvalMatches(a, project, context.projectRevision, a.itemId, config) && (!a.itemId || a.itemId === item.id) && (!a.profileId || a.profileId === profile.id) && (!a.packageId || a.packageId === item.packageId)) ?? [];
    if (agreements.length > 1) { review('agreement-conflict', 'Multiple project agreements conflict for this item.', item.id); continue; }
    const agreement = agreements[0];
    if (profile.requiresProjectAgreement && (!agreement || agreement.profileId !== profile.id)) { review('profile-approval-required', 'This installation profile requires an approved project agreement.', item.id); continue; }
    if (profile.materialGroupId === 'wide-contract-vinyl' && item.preparation === 'contract-ready' && (!agreement || agreement.profileId !== profile.id || !agreement.readyWallsVerified)) { review('contract-approval-required', 'Prepared-wall wide vinyl requires the project agreement to verify wall readiness for this scope.', item.id); continue; }
    if (item.scopeKind === 'feature_wall' || item.scopeKind === 'single_room') {
      const packages = config?.packages.filter(p => (!item.packageId || p.id === item.packageId) && p.approved && p.scopeKind === item.scopeKind && p.profileIds.includes(profile.id)) ?? [];
      if (packages.length !== 1) { review('small-scope-package-required', 'One eligible approved feature-wall or single-room package is required; no area-price fallback applies.', item.id); continue; }
      const template = packages[0], key = item.scopeKind === 'single_room' ? `room:${item.roomId}` : `feature:${item.id}`;
      const group = packageGroups.get(key);
      if (group && group.template.id !== template.id) { review('package-conflict', 'A room has conflicting package selections.', item.id); continue; }
      if (group) group.items.push(item); else packageGroups.set(key, { template, items: [item] });
      continue;
    }
    if (profile.materialGroupId === 'wide-contract-vinyl' && (!agreement || agreement.profileId !== profile.id || !agreement.readyWallsVerified || !agreement.allowAreaPricing || item.preparation !== 'contract-ready' || item.scopeKind !== 'commercial')) { review('contract-approval-required', 'Wide contract vinyl requires an approved large commercial package and verified ready walls for this revision.', item.id); continue; }
    if ((item.scopeKind === 'multiple_rooms' && roomCount < 2) || (item.scopeKind === 'commercial' && !agreement?.allowAreaPricing)) { review('scope-approval-required', 'Confirm the multi-room scope or obtain project approval for area pricing.', item.id); continue; }
    const rate = agreement?.agreedRatePencePerM2 ?? profile.ratePencePerM2;
    if (rate === null || rate === undefined) { review('rate-required', 'No approved price is configured for this installation profile.', item.id); continue; }
    const amountPence = priceAreaPence(area.netMm2, rate);
    if (amountPence <= 0) { review('positive-installation-price-required', 'The installation scope needs a positive approved price.', item.id); continue; }
    const roomLabel = project.rooms.find(room => room.id === item.roomId)!.label;
    const inclusion = item.preparation === 'normal-prep-lining-hanging' ? 'Labour for normal preparation, lining and hanging; all materials client provided.' : item.preparation === 'contract-ready' ? 'Hanging on project-verified ready walls; all materials client provided.' : 'Installation labour under the approved profile; separately approved removal or repair is shown as additional preparation. All materials client provided.';
    lines.push({ id: `installation-${lines.length + 1}`, itemId: item.id, profileId: profile.id, label: `${roomLabel} · ${item.label} · ${profile.label}`, category: 'installation', quantity: area.netM2, unit: 'm2', amountPence, inclusion });
  }
  for (const { template, items } of packageGroups.values()) {
    const area = items.reduce((sum, item) => sum + measureScopeArea(item).netMm2, 0);
    const walls = items.filter(item => (item.surfaceKind ?? 'wall') === 'wall').flatMap(item => item.walls);
    const ceilings = items.filter(item => item.surfaceKind === 'ceiling').flatMap(item => item.ceilings ?? []);
    const ceilingCount = ceilings.reduce((sum, ceiling) => sum + ceiling.count, 0);
    const surfaces = template.surfaceKinds ?? ['wall'];
    const ceilingBoundsMissing = ceilings.length > 0 && (template.maxCeilings === undefined || template.maxCeilingWidthMm === undefined || template.maxCeilingLengthMm === undefined);
    const ceilingOutsideBounds = ceilings.some(ceiling => ceiling.widthMm > (template.maxCeilingWidthMm ?? 0) || ceiling.lengthMm > (template.maxCeilingLengthMm ?? 0)) || ceilingCount > (template.maxCeilings ?? 0);
    const wallCount = walls.reduce((sum, wall) => sum + wall.count, 0);
    const openingCount = walls.reduce((sum, wall) => sum + wall.count * wall.openings.reduce((n, x) => n + x.count, 0), 0) + ceilings.reduce((sum, ceiling) => sum + ceiling.count * ceiling.openings.reduce((n, x) => n + x.count, 0), 0);
    if (items.some(item => !surfaces.includes((item.surfaceKind ?? 'wall') as 'wall' | 'ceiling')) || ceilingBoundsMissing || ceilingOutsideBounds || template.maxWallHeightMm === undefined || template.maxWalls === undefined || template.maxOpenings === undefined || area > template.maxNetAreaMm2 || walls.some(w => w.heightMm > template.maxWallHeightMm!) || wallCount > template.maxWalls || openingCount > template.maxOpenings) {
      review('package-scope-review-required', 'The package surface kind, area, wall or ceiling dimensions, surface count or openings require review.', items[0].id); continue;
    }
    const hasComponents = template.setupPence !== undefined && template.labourHours !== undefined && template.labourRatePencePerHour !== undefined && template.surveyAllowancePence !== undefined && template.managementAllowancePence !== undefined;
    if (!hasComponents) { review('package-price-required', 'The package needs approved setup, labour time, survey and management allowances. A legacy fixed amount is a reference only.', items[0].id); continue; }
    const price = template.setupPence! + roundedDivision(BigInt(template.labourRatePencePerHour!) * BigInt(template.labourHours! * 4), 4n) + template.surveyAllowancePence! + template.managementAllowancePence!;
    if (price <= 0 || !template.labourHours || !template.labourRatePencePerHour) { review('positive-package-price-required', 'The package needs a positive approved labour allowance and installation price.', items[0].id); continue; }
    const roomLabel = project.rooms.find(room => room.id === items[0].roomId)!.label;
    const scopeLabel = template.scopeKind === 'feature_wall' ? `${items[0].label} · ` : '';
    lines.push({ id: `package-${lines.length + 1}`, itemId: items.length === 1 ? items[0].id : undefined, packageTemplateId: template.id, label: `${roomLabel} · ${scopeLabel}${template.label}`, category: 'package', quantity: 1, unit: 'package', amountPence: price, inclusion: `${template.inclusion}${template.routineServiceApproved ? ' Includes the approved routine survey and management allowances.' : ''}` });
    items.forEach(item => packagedItems.add(item.id));
  }
  const routinePackages = project.items.length > 0 && project.items.every(x => packagedItems.has(x.id)) && [...packageGroups.values()].every(x => x.template.routineServiceApproved && x.template.surveyAllowancePence !== undefined && x.template.managementAllowancePence !== undefined);
  const routineProgramme = project.programme.occupied === 'no' && project.programme.outOfHours === 'no' && project.programme.phases === 1 && project.propertyValuePence === undefined;
  const noExtraLogistics = project.logistics.vehicleDaysConfirmed && project.logistics.vehicleDays.length === 0 && ['deliveriesRequired', 'storageRequired', 'accessEquipmentRequired', 'wasteRemovalRequired'].every(k => project.logistics[k as keyof ProjectDraft['logistics']] === 'no');
  if (!plan && !(routinePackages && routineProgramme && noExtraLogistics)) review('service-plan-required', 'An approved survey, management and logistics plan is required for this project revision.');
  if (plan) {
    const includedInPackages = packagedItems.size > 0 && [...packageGroups.values()].some(x => x.template.routineServiceApproved);
    const entries = plan.serviceEntries ?? [];
    for (const [key, label, category] of [['management', 'Project management', 'management'], ['survey', 'Survey allowance', 'survey']] as const) {
      const hours = plan[`${key}Hours`], rate = plan[`${key}RatePence`];
      const structured = entries.filter(entry => entry.category === category);
      if (structured.length) {
        if (hours !== undefined && hours > 0) review('duplicate-service-basis', `Use either structured ${label.toLowerCase()} services or the legacy time allowance, not both.`);
        continue;
      }
      if (includedInPackages && hours !== undefined && hours > 0 && !plan.additionalServicesOnly) { review('duplicate-service-allowance', 'Package survey or management is already included; explicitly approve any additional service time.'); continue; }
      if (hours === undefined || (hours > 0 && rate === undefined)) review('service-price-required', `Confirm the approved ${label.toLowerCase()} time plan and allowance.`);
      else if (hours > 0 && rate !== undefined) lines.push({ id: `service-${key}`, label: includedInPackages ? `Additional ${label.toLowerCase()}` : label, category, quantity: 1, unit: 'item', amountPence: roundedDivision(BigInt(rate) * BigInt(hours * 4), 4n), inclusion: 'Approved project time-plan allowance.' });
    }
    for (const entry of entries) {
      if (!entry.approved || entry.ratePence === null || !entry.rateReviewedOn) { review('service-approval-required', `Approve the scope, current rate and rate review date for ${entry.label}.`); continue; }
      if (entry.rateReviewedOn > created.toISOString().slice(0, 10)) { review('service-rate-date-required', `The reviewed rate date for ${entry.label} cannot be in the future.`); continue; }
      if (entry.itemIds?.some(id => !project.items.some(item => item.id === id))) { review('service-scope-required', `The linked scope for ${entry.label} is unavailable in this project revision.`); continue; }
      if (entry.category === 'preparation' && entry.itemIds?.some(id => project.items.find(item => item.id === id)?.preparation !== 'removal-or-repair')) { review('preparation-service-conflict', `The additional preparation service ${entry.label} does not match the selected preparation scope.`); continue; }
      if (includedInPackages && entry.category !== 'preparation' && !plan.additionalServicesOnly) { review('duplicate-service-allowance', 'Package survey or management is already included; explicitly approve any additional service time.'); continue; }
      const amountPence = roundedDivision(BigInt(entry.ratePence) * BigInt(entry.quantity * 4), 4n);
      const linked = entry.itemIds?.map(id => project.items.find(item => item.id === id)!.label).join(', ');
      lines.push({ id: `service-entry-${entry.id}`, label: `${entry.category === 'preparation' ? 'Additional preparation · ' : includedInPackages ? 'Additional ' : ''}${entry.label}`, category: entry.category, quantity: entry.quantity, unit: entry.unit, amountPence, inclusion: `Owner-approved ${entry.unit} allowance; current rate reviewed ${entry.rateReviewedOn}.${linked ? ` Scope: ${linked}.` : ''}` });
    }
  }
  if (config) { const logistics = priceLogistics(project, config.logistics, plan); lines.push(...logistics.lines); for (const reason of logistics.reviewReasons) review(reason.code, reason.message, undefined, reason.code.includes('unknown') || reason.code.includes('information') || reason.code.includes('unconfirmed')); }
  if (config?.vatRateBps !== 2000) review('vat-review-required', 'Exceptional or unconfirmed VAT treatment needs owner review.');
  const status = informationMissing ? 'information_required' : reviewReasons.length ? 'review_required' : 'ready';
  const subtotalPence = lines.reduce((sum, line) => { const value = sum + line.amountPence; if (!Number.isSafeInteger(value)) throw new RangeError('Estimate total exceeds the safe money range.'); return value; }, 0);
  const vatPence = status === 'ready' && config?.vatRateBps !== null && config?.vatRateBps !== undefined ? roundedDivision(BigInt(subtotalPence) * BigInt(config.vatRateBps), 10_000n) : null;
  return freeze({ schemaVersion: 1, id: context.id, projectId: context.projectId, projectRevision: context.projectRevision, configVersion: config?.version ?? 'unconfigured', createdAt: created.toISOString(), validUntil: new Date(created.valueOf() + 30 * 86_400_000).toISOString(), status, currency: 'GBP', lines, subtotalPence, vatRateBps: config?.vatRateBps ?? null, vatPence, totalPence: vatPence === null ? null : subtotalPence + vatPence, vatStatus: config?.vatRateBps === null || !config ? 'unconfirmed' : config.vatRateBps === 0 ? 'not-applicable' : 'exclusive', reviewReasons, assumptions: ['This is an indicative installation estimate, subject to the stated scope and survey.', 'All materials, including wallcovering, lining paper, adhesives and primers, are client provided.', 'Normal preparation excludes removal, major repairs and unforeseen substrate defects.', 'Logistics, survey and management follow the approved project plan.', ...readinessAssumptions, ...resourceAssumptions, 'Vehicle charges use declared vehicle-day eligibility and charging-time flags; the address is not used to infer them.', 'Prices remain valid for 30 days from this snapshot; revised scope requires a new estimate.'], project });
}

/** Explicit client share allowlist: project name/address authorised for sharing; no contacts, property value, configuration, agreement or internal rate. */
export function toSharedEstimate(snapshot: EstimateSnapshot): SharedEstimate {
  const address = snapshot.project.address;
  return freeze({ schemaVersion: 1, estimateId: snapshot.id, projectName: snapshot.project.name, projectAddress: { line1: address.line1, ...(address.line2 ? { line2: address.line2 } : {}), town: address.town, postcode: address.postcode, country: address.country }, createdAt: snapshot.createdAt, validUntil: snapshot.validUntil, status: snapshot.status, currency: 'GBP', lines: snapshot.lines.map((x, i) => ({ id: `line-${i + 1}`, label: x.label, category: x.category, quantity: x.quantity, unit: x.unit, amountPence: x.amountPence, inclusion: x.inclusion })), subtotalPence: snapshot.subtotalPence, vatRateBps: snapshot.vatRateBps, vatPence: snapshot.vatPence, totalPence: snapshot.totalPence, vatStatus: snapshot.vatStatus, reviewReasons: snapshot.reviewReasons.map(x => ({ code: x.code, message: x.message })), assumptions: [...snapshot.assumptions] });
}
