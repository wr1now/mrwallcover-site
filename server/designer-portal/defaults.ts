import type { PricingConfig } from './pricing.ts';

/** Public-safe seed configuration. Unapproved rates and service plans remain absent. */
export function createDefaultPricingConfig(): PricingConfig {
  return {
    version: 'owner-guide-2026-10-18-v1', active: true, vatRateBps: 2000,
    profiles: [
      { id: 'standard-fabric', label: 'Standard fabric installation', materialGroupId: 'standard-fabric', verifiedTypeId: 'standard-fabric', approved: true, ratePencePerM2: 12000, preparations: ['normal-prep-lining-hanging'], requiresProjectAgreement: false, reviewRequired: false, traits: { acoustic: false, velvet: false, specialist: false } },
      { id: 'contract-ready-vinyl', label: 'Approved ready-wall contract installation', materialGroupId: 'wide-contract-vinyl', verifiedTypeId: 'contract-ready-vinyl', approved: true, ratePencePerM2: 2600, preparations: ['contract-ready'], requiresProjectAgreement: true, reviewRequired: false, traits: { acoustic: false, velvet: false, specialist: false } },
      { id: 'arte-grandeur-44001', label: 'Arte Grandeur 44001 installation', materialGroupId: 'formed-acoustic', productId: 'arte-grandeur-44001', approved: false, ratePencePerM2: null, preparations: ['normal-prep-lining-hanging'], requiresProjectAgreement: true, reviewRequired: true, traits: { acoustic: false, velvet: false, specialist: true } },
    ],
    products: [{ id: 'arte-grandeur-44001', manufacturer: 'Arte', name: 'Grandeur', code: '44001', collection: 'Objet', groupId: 'formed-acoustic', approved: false, verified: true, construction: '3D textile on nonwoven backing', backingMaterial: 'Nonwoven', suppliedFormat: 'panel', widthMm: 1200, heightMm: 2980, thicknessMm: null, sourceUrl: 'https://www.arte-international.com/en/collections/objet/grandeur/44001', instructionsUrl: 'https://www.arte-international.com/en/hanging-instructions/installing-3d-wallcovering-on-non-woven-backing', sourceReviewedOn: '2026-10-18', installationProfileId: 'arte-grandeur-44001', traits: { acoustic: null, velvet: null, specialist: true }, notes: 'Exact thickness and unverified handling characteristics remain unknown. Product-specific review is required; no price is approved.' }],
    packages: [], agreements: [], servicePlans: [],
    logistics: { congestionPence: 1800, ulezPence: 1250, reviewedOn: '2026-10-18', congestionSourceUrl: 'https://tfl.gov.uk/modes/driving/congestion-charge', ulezSourceUrl: 'https://tfl.gov.uk/modes/driving/ultra-low-emission-zone', congestionEffectiveFrom: '2026-01-02', congestionEffectiveUntil: null, ulezEffectiveFrom: '2026-10-18', ulezEffectiveUntil: null },
  };
}
