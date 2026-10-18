import type { EstimateLine, EstimateReviewReason, ProjectDraft } from '../../src/designer-portal/types.ts';

export interface LogisticsConfig {
  congestionPence: number;
  ulezPence: number;
  reviewedOn: string;
  congestionSourceUrl: string;
  ulezSourceUrl: string;
  congestionEffectiveFrom?: string;
  congestionEffectiveUntil?: string | null;
  ulezEffectiveFrom?: string;
  ulezEffectiveUntil?: string | null;
}
export interface ServiceEntry {
  id: string;
  category: 'survey' | 'management' | 'preparation';
  label: string;
  quantity: number;
  unit: 'hour' | 'day' | 'visit';
  ratePence: number | null;
  rateReviewedOn?: string;
  approved: boolean;
  /** Preparation work must identify the scope it adds to the installation. */
  itemIds?: string[];
}
export interface ServicePlan {
  id: string;
  projectId: string;
  projectRevision: number;
  scopeFingerprint?: string;
  minNetAreaMm2?: number;
  maxNetAreaMm2?: number;
  approved: boolean;
  programmeReviewed: boolean;
  propertyContextReviewed: boolean;
  /** Owner assessment of the declared stairs, high-level or restricted access. */
  accessReviewed?: boolean;
  /** Explicit provisional assessment; does not assert physical material readiness. */
  materialReadinessReviewed?: boolean;
  serviceEntries?: ServiceEntry[];
  managementHours?: number;
  managementRatePence?: number;
  surveyHours?: number;
  surveyRatePence?: number;
  deliveryPence?: number;
  storagePence?: number;
  accessEquipmentPence?: number;
  wasteRemovalPence?: number;
  parking: { date: string; vehicleId: string; amountPence: number }[];
  additionalServicesOnly?: boolean;
  roadCharges?: { date: string; vehicleId: string; scheme: 'congestion' | 'ulez'; amountPence: number; source: string }[];
}
export function priceLogistics(project: ProjectDraft, config: LogisticsConfig, plan?: ServicePlan) {
  const lines: EstimateLine[] = [], reviewReasons: EstimateReviewReason[] = [];
  const review = (code: string, message: string) => reviewReasons.push({ code, message });
  const add = (id: string, label: string, amountPence: number, inclusion: string) => lines.push({ id, label, category: 'logistics', quantity: 1, unit: 'vehicle-day', amountPence, inclusion });
  if (project.logistics.arrangement === 'not-established') review('logistics-information-required', 'Choose and confirm the delivery, parking, storage and team-travel arrangement.');
  if (!project.logistics.vehicleDaysConfirmed) review('vehicle-days-unconfirmed', 'Confirm the actual vehicle attendance days, including deliveries and return visits.');
  const days = new Map<string, typeof project.logistics.vehicleDays[number]>();
  for (const day of project.logistics.vehicleDays) {
    const key = `${day.date}:${day.vehicleId}`;
    const existing = days.get(key);
    if (existing) {
      if (['congestionZone', 'congestionChargeApplies', 'congestionTariff', 'ulezZone', 'ulezChargeApplies', 'ulezTariff', 'parkingRequired'].some(k => existing[k as keyof typeof existing] !== day[k as keyof typeof day])) review('vehicle-day-conflict', 'Conflicting vehicle-day information needs review.');
      continue; // One charge per actual vehicle per calendar day, including multiple visits.
    }
    days.set(key, day);
  }
  let n = 0;
  for (const day of days.values()) {
    n++;
    for (const [zone, applies, price, label, tariff, scheme] of [
      [day.congestionZone, day.congestionChargeApplies, config.congestionPence, 'Congestion Charge', day.congestionTariff, 'congestion'],
      [day.ulezZone, day.ulezChargeApplies, config.ulezPence, 'ULEZ charge', day.ulezTariff, 'ulez'],
    ] as const) {
      if (zone === 'unknown' || applies === 'unknown') { review('vehicle-charge-unknown', `Confirm the vehicle, zone and charging-time applicability for ${label}.`); continue; }
      if (zone === 'no' && applies === 'yes') { review('vehicle-charge-conflict', `The ${label} applicability conflicts with the declared zone.`); continue; }
      if (zone === 'yes' && applies === 'yes') {
        if (!tariff || tariff === 'unknown') { review('vehicle-tariff-unknown', `Confirm the standard or discounted tariff class for ${label}.`); continue; }
        const overrides = plan?.roadCharges?.filter(x => x.date === day.date && x.vehicleId === day.vehicleId && x.scheme === scheme) ?? [];
        if (overrides.length > 1 || (tariff === 'discounted' && overrides.length !== 1)) { review('vehicle-discount-review-required', 'A discounted vehicle charge requires one approved, sourced vehicle-day override.'); continue; }
        const from = scheme === 'congestion' ? config.congestionEffectiveFrom : config.ulezEffectiveFrom;
        const until = scheme === 'congestion' ? config.congestionEffectiveUntil : config.ulezEffectiveUntil;
        if (!overrides.length && (!from || !until || day.date < from || day.date > until)) { review('vehicle-tariff-date-review-required', `No approved effective-dated ${label} tariff covers this vehicle-day.`); continue; }
        const charge = overrides.length === 1 ? overrides[0].amountPence : price;
        add(`logistics-${n}-${scheme}`, label, charge, overrides.length ? 'Approved, sourced vehicle-day charge; counted once.' : 'One public standard tariff per chargeable vehicle-day; eligibility and charging time explicitly confirmed.');
      }
    }
    if (day.parkingRequired === 'unknown') review('parking-unknown', 'Confirm parking requirements for each vehicle-day.');
    if (day.parkingRequired === 'yes') {
      const matches = plan?.parking.filter(x => x.date === day.date && x.vehicleId === day.vehicleId) ?? [];
      if (matches.length !== 1) review('parking-price-required', 'An approved parking allowance is required for this vehicle-day.');
      else add(`logistics-${n}-parking`, 'Parking allowance', matches[0].amountPence, 'Approved allowance for one vehicle-day.');
    }
  }
  for (const [flag, price, label] of [
    [project.logistics.deliveriesRequired, plan?.deliveryPence, 'Deliveries'],
    [project.logistics.storageRequired, plan?.storagePence, 'Storage'],
    [project.logistics.accessEquipmentRequired, plan?.accessEquipmentPence, 'Access equipment'],
    [project.logistics.wasteRemovalRequired, plan?.wasteRemovalPence, 'Waste removal'],
  ] as const) {
    if (flag === 'unknown') review('logistics-information-required', `Confirm ${label.toLowerCase()} requirements.`);
    else if (flag === 'yes' && price === undefined) review('logistics-price-required', `An approved ${label.toLowerCase()} allowance is required.`);
    else if (flag === 'yes' && price !== undefined) lines.push({ id: `logistics-extra-${lines.length}`, label, category: 'logistics', quantity: 1, unit: 'item', amountPence: price, inclusion: 'Approved project allowance, charged once.' });
  }
  return { lines, reviewReasons };
}
