import type { RoomStudioExampleId } from './example-metadata.ts';

/** Product facts only. These records contain no supplier artwork or material maps.
 * Product dimensions do not establish the physical area covered by a web image. */
export type ManufacturerSelectionId = 'degournay-plum-blossom' | 'phillip-jeffries-3163' | 'arte-adobe-97031';
export interface ManufacturerSource { label: string; url: string; }
export type ManufacturerDimensions =
  | { kind: 'finite-panels'; panelWidthMm: number; panelHeightMm: number; designHeightMm: number; stockSetCode: string; repeat: 'none'; }
  | { kind: 'vertical-repeat-panels'; trimmedWidthMm: number; panelHeightMm: number; verticalRepeatMm: number; verticalRepeatAccuracy: 'approximate'; horizontalRepeatMm: null; match: 'straight'; }
  | { kind: 'repeatable-tiles'; widthMm: number; heightMm: number; verticalRepeatMm: number; match: 'straight'; };
export interface ManufacturerSelection {
  id: ManufacturerSelectionId;
  manufacturer: string;
  design: string;
  colourway: string;
  productCode: string;
  layoutId: RoomStudioExampleId;
  reviewedOn: string;
  dimensions: ManufacturerDimensions;
  verifiedImageCoverage?: { widthMm: number; heightMm: number; representation: 'finite-four-drop-sheet'; evidence: string; sourceUrl: string; };
  sources: ManufacturerSource[];
  assets: {
    referenceArtworkAvailable: boolean;
    artworkMappingVerified: boolean;
    manufacturerPbrVerified: false;
    embeddedSupplierAssets: false;
    calibrationLabel: string;
    materialLabel: string;
    permission: { status: 'unresolved' | 'restricted'; observation: string; sourceUrl: string; };
  };
}

export const manufacturerSelections: readonly ManufacturerSelection[] = [
  {
    id: 'degournay-plum-blossom', manufacturer: 'de Gournay', design: 'Plum Blossom',
    colourway: 'Original on Tarnished Silver gilded paper with désargenter pearlescent antiquing',
    productCode: '792575', layoutId: 'willow-chimney', reviewedOn: '2026-10-19',
    dimensions: { kind: 'finite-panels', panelWidthMm: 915, panelHeightMm: 3048, designHeightMm: 2150, stockSetCode: '961463', repeat: 'none' },
    sources: [
      { label: 'Plum Blossom colourway and made-to-measure specification', url: 'https://degournay.com/product-details/originalontarnishedsilvergildedpaperwithpearlescentantiquing5' },
      { label: 'Stock set 961463 panel and design dimensions', url: 'https://degournay.com/shop-product-details/plumblossom961463' },
      { label: '2026 sequential mural panel installation guidance', url: 'https://degournay.com/uploads/technical/document/2026_Hanging_Instructions-After-2025.pdf' },
    ],
    assets: {
      referenceArtworkAvailable: true, artworkMappingVerified: false, manufacturerPbrVerified: false, embeddedSupplierAssets: false,
      calibrationLabel: 'Finite mural panels. The web preview does not identify its panel sequence or physical image coverage.',
      materialLabel: 'Gilded ground appearance is not a measured material simulation.',
      permission: { status: 'unresolved', observation: 'No permission for website textures, rendered views or editable-room asset redistribution was established in this review.', sourceUrl: 'https://degournay.com/product-details/originalontarnishedsilvergildedpaperwithpearlescentantiquing5' },
    },
  },
  {
    id: 'phillip-jeffries-3163', manufacturer: 'Phillip Jeffries', design: 'Metallic Ombre',
    colourway: 'Gold on Horsehair', productCode: '3163', layoutId: 'ochre-lshape', reviewedOn: '2026-10-19',
    dimensions: { kind: 'vertical-repeat-panels', trimmedWidthMm: 863.6, panelHeightMm: 3352.8, verticalRepeatMm: 1066.8, verticalRepeatAccuracy: 'approximate', horizontalRepeatMm: null, match: 'straight' },
    verifiedImageCoverage: { widthMm: 3454.4, heightMm: 3352.8, representation: 'finite-four-drop-sheet', evidence: 'Official renderer filename 3163_Metallic Ombre_11ft_4pnl.jpg identifies four 11-foot drops; four published 34-inch trimmed widths give 136 × 132 inches, matching the original image aspect exactly.', sourceUrl: 'https://www.phillipjeffries.com/shop/CARD-AG-METALUXEII/3163' },
    sources: [
      { label: 'Metallic Ombre 3163 product tear sheet', url: 'https://www.phillipjeffries.com/shop/CARD-AG-METALUXEII/3163/tear-sheet' },
      { label: 'Manufacturer legal information', url: 'https://www.phillipjeffries.com/legal' },
    ],
    assets: {
      referenceArtworkAvailable: true, artworkMappingVerified: true, manufacturerPbrVerified: false, embeddedSupplierAssets: false,
      calibrationLabel: 'The identified renderer sheet covers four finite drops, 3454.4 × 3352.8 mm. The vertical repeat is approximate; no horizontal product repeat is specified. Other swatch crops remain uncalibrated.',
      materialLabel: 'The four-drop sheet retains natural panel variation. Metallic and horsehair response is not a measured material simulation.',
      permission: { status: 'restricted', observation: 'The observed website terms restrict commercial and public web reuse; no permission for texture embedding or editable-room redistribution was obtained in this review.', sourceUrl: 'https://www.phillipjeffries.com/legal' },
    },
  },
  {
    id: 'arte-adobe-97031', manufacturer: 'Arte', design: 'Adobe',
    colourway: 'Ecru', productCode: '97031', layoutId: 'indigo-bay', reviewedOn: '2026-10-19',
    dimensions: { kind: 'repeatable-tiles', widthMm: 900, heightMm: 800, verticalRepeatMm: 800, match: 'straight' },
    sources: [
      { label: 'Babylon Adobe 97031 product and tile specification', url: 'https://www.arte-international.com/en/collections/babylon/adobe/97031' },
      { label: 'Professional download access', url: 'https://www.arte-international.com/en/professional-area' },
    ],
    assets: {
      referenceArtworkAvailable: true, artworkMappingVerified: false, manufacturerPbrVerified: false, embeddedSupplierAssets: false,
      calibrationLabel: '900 × 800 mm repeatable tiles. Source image coverage needs its own confirmation.',
      materialLabel: 'No measured relief height, displacement field or manufacturer PBR maps were established.',
      permission: { status: 'restricted', observation: 'The manufacturer states that commercial copying, publication and use require prior express written permission; none was obtained in this review.', sourceUrl: 'https://www.arte-international.com/en/legal' },
    },
  },
];

/** Return detached metadata so a private prototype cannot change the public facts. */
export function getManufacturerSelection(id: ManufacturerSelectionId): ManufacturerSelection {
  const selection = manufacturerSelections.find(item => item.id === id);
  if (!selection) throw new RangeError('Choose one of the three selected manufacturer designs.');
  return structuredClone(selection);
}
