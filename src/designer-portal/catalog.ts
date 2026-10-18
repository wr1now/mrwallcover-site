import type { MaterialGroupId } from './types.ts';

export interface PublicPriceGuide { amountPence: number; unit: 'm2'; qualification: string }
export interface PublicPriceGroup { id: MaterialGroupId; label: string; description: string; priceGuide?: PublicPriceGuide }
export interface PublicProduct { id: string; manufacturer: string; name: string; code?: string; collection?: string; groupId: MaterialGroupId; verifiedTypeId?: string; sourceUrl?: string; instructionsUrl?: string; sourceReviewedOn?: string; construction?: string | null; faceMaterial?: string | null; backingMaterial?: string | null; coating?: string | null; pile?: string | null; relief?: string | null; suppliedFormat?: 'roll' | 'panel' | 'sheet' | 'other' | 'unknown'; widthMm?: number | null; heightMm?: number | null; repeatMm?: number | null; thicknessMm?: number | null; weightGsm?: number | null; patternMatch?: string | null; hangingMethod?: string | null; hangingDirection?: string | null; pastingMethod?: string | null; trimmingMethod?: string | null; jointingMethod?: string | null; cornerTreatment?: string | null; handlingRequirements?: string | null; notes?: string }
/** Public guide facts only. Packages, agreements, internal costs and private rates are server-only. */
export const PUBLIC_PRICE_GROUPS: readonly PublicPriceGroup[] = Object.freeze([
  { id: 'printed-paper', label: 'Conventional printed paper', description: 'Paper-backed printed wallcoverings. Exact product, preparation and access determine the review.' },
  { id: 'printed-nonwoven', label: 'Printed nonwoven', description: 'Printed nonwoven wallcoverings; confirm the exact maker and product instructions.' },
  { id: 'vinyl-coated-paper', label: 'Vinyl-coated paper', description: 'A coated paper product; confirm its backing and hanging instructions.' },
  { id: 'domestic-vinyl', label: 'Domestic vinyl', description: 'Domestic vinyl products require a product-specific scope.' },
  { id: 'wide-contract-vinyl', label: 'Wide contract vinyl', description: 'Large contract packages with verified ready walls and an approved project agreement.', priceGuide: { amountPence: 2600, unit: 'm2', qualification: 'Approximately £26/m² applies only to an approved large contract package with verified ready walls. It is not a general wallpaper rate or a small-job price. All materials are client provided.' } },
  { id: 'standard-fabric', label: 'Standard fabric', description: 'Eligible standard fabric wallcoverings with normal preparation, lining and hanging.', priceGuide: { amountPence: 12000, unit: 'm2', qualification: '£120/m² for eligible standard fabric, including normal preparation, lining and hanging. Specialist, velvet, flock, pile, formed and acoustic products need review. All materials, including wallcovering, lining, adhesives and primers, are client provided. Logistics and management are additional; small scopes require an approved package. VAT is shown separately.' } },
  { id: 'velvet-flock-pile', label: 'Velvet, flock and pile', description: 'Special handling and the precise construction need review; no automatic premium is stacked onto another profile.' },
  { id: 'formed-acoustic', label: 'Thick, formed, 3D and acoustic', description: 'Product construction and required system determine the installation profile. No universal thickness or acoustic performance is assumed.' },
  { id: 'specialists', label: 'Naturals, metallics, murals and other specialists', description: 'Natural weaves, silk, metallics, hand-painted panels and murals are reviewed against their exact specification.' },
]);
export const PUBLIC_PRODUCTS: readonly PublicProduct[] = Object.freeze([
  { id: 'arte-grandeur-44001', manufacturer: 'Arte', name: 'Grandeur', code: '44001', groupId: 'formed-acoustic', sourceUrl: 'https://www.arte-international.com/en/collections/objet/grandeur/44001', notes: '3D textile wallcovering on nonwoven backing; panel 2980 × 1200 mm. Actual thickness is not established. Product-specific installation review required; no automatic price is approved.' },
]);
export const PUBLIC_INSTALLATION_TYPES = Object.freeze([
  { id: 'standard-fabric', label: 'Verified standard fabric', groupId: 'standard-fabric' as MaterialGroupId },
  { id: 'contract-ready-vinyl', label: 'Contract vinyl on verified ready walls', groupId: 'wide-contract-vinyl' as MaterialGroupId },
]);
export const PUBLIC_GUIDE_REVIEWED_ON = '2026-10-18';
