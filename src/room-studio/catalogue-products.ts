import { exampleArtwork } from './example-artwork.generated.ts';
import { roomStudioExamples } from './example-metadata.ts';
import { fixtureArtwork } from './fixtures.ts';
import type { FinishAsset } from './types.ts';

export interface CatalogueProductVersion {
  productId: string; version: string; name: string; maker: string; productUrl: string | null;
  provenance: string; sourceHashes: string[];
  permissions: { browserPreview: boolean; privateRenders: boolean; portableExport: boolean };
  finish: FinishAsset;
}
const original = fixtureArtwork();
/** Only rights-cleared assets belong in this browser bundle. Supplier studies remain private. */
export const catalogueProducts: readonly CatalogueProductVersion[] = [{
  productId: 'mrwallcover-geometric-study', version: '2026-10-19.1', name: 'Geometric set-out study', maker: 'Mr Wallcover', productUrl: null,
  provenance: 'Original generated geometric test artwork. Illustrative design, not a manufacturer product or completed installation.',
  sourceHashes: [original.texture.sha256], permissions: { browserPreview: true, privateRenders: true, portableExport: true },
  finish: { ...original, name: 'Original geometric study', catalogue: { productId: 'mrwallcover-geometric-study', version: '2026-10-19.1', verification: 'approved' } },
}, ...roomStudioExamples.map(metadata => {
  const productId = `mrwallcover-${metadata.id}`, version = '2026-10-19.1';
  return {
    productId, version, name: metadata.name, maker: 'Mr Wallcover', productUrl: null,
    provenance: `${metadata.artworkLabel}. Original generated illustration, not a manufacturer product or completed installation.`,
    sourceHashes: [exampleArtwork[metadata.id].sha256], permissions: { browserPreview: true, privateRenders: true, portableExport: true },
    finish: {
      id: `catalogue-${metadata.id}`, type: 'wallpaper' as const, name: metadata.artworkLabel,
      texture: { id: `example-${metadata.id}-artwork`, ...exampleArtwork[metadata.id] },
      calibration: { widthMm: metadata.repeatMm.width, heightMm: metadata.repeatMm.height, crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0 as const, repeatKind: metadata.id === 'ochre-lshape' ? 'strip' as const : 'tile' as const, match: metadata.id === 'willow-chimney' ? 'straight' as const : 'half-drop' as const, offsetAlreadyIncluded: metadata.id === 'indigo-bay', proofAccepted: true },
      catalogue: { productId, version, verification: 'approved' as const },
    },
  };
})];
// Immutable source versions are never edited through per-project controls.
function freeze(value: unknown): void { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } }
freeze(catalogueProducts);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function selectCatalogueFinish(productId: string, version: string, instanceId: string): FinishAsset {
  const product = catalogueProducts.find(value => value.productId === productId && value.version === version);
  if (!product || !Object.values(product.permissions).every(Boolean)) throw new Error('This catalogue version is not approved for the complete customer workflow.');
  return { ...structuredClone(product.finish), id: instanceId };
}
/** The server calls this before saving/processing. A client cannot assert approved parameters. */
export function resolveCatalogueFinish(finish: FinishAsset): FinishAsset {
  if (!finish.catalogue || finish.catalogue.verification === 'custom') return structuredClone(finish);
  const approved = selectCatalogueFinish(finish.catalogue.productId, finish.catalogue.version, finish.id);
  // Private storage locations are assigned by the server after canonical product selection.
  const portable = (value: FinishAsset) => {
    const copy = structuredClone(value);
    if (copy.type === 'wallpaper' || copy.type === 'mural') {
      delete copy.texture.storagePath; delete copy.texture.dataUrl;
      copy.panels?.forEach(panel => { delete panel.texture.storagePath; delete panel.texture.dataUrl; });
    }
    return copy;
  };
  if (canonical(portable(finish)) !== canonical(portable(approved))) throw new Error('This catalogue finish was edited. Save it as a custom finish before processing.');
  return approved;
}
