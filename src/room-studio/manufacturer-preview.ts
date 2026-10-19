import { createExampleProject } from './examples.ts';
import { continueWallpaperAroundCorners } from './finishes.ts';
import { wallLength } from './geometry.ts';
import { getManufacturerSelection } from './manufacturer-selections.ts';
import type { ManufacturerSelection, ManufacturerSelectionId } from './manufacturer-selections.ts';
import type { ArtworkFinish, RoomProject, TextureAsset } from './types.ts';
import { validateProject } from './validation.ts';

export interface ManufacturerPreviewOptions {
  /** The private runner supplies local embedded pixels. This helper never fetches. */
  texture: TextureAsset;
  coverage?: {
    widthMm: number;
    heightMm: number;
    status: 'assumed' | 'verified-full-image';
    /** Identify the assumption or the source supporting this complete image area. */
    evidence: string;
  };
}
export interface ManufacturerPreview {
  project: RoomProject;
  assumptions: string[];
  selection: ManufacturerSelection;
}

/** PRIVATE CONCEPT helper, deliberately not imported by the public example UI.
 * Keeps product dimensions separate from a caller's assumed image coverage.
 * Returning a concept does not establish artwork permission or material accuracy. */
export function createManufacturerPreviewProject(id: ManufacturerSelectionId, options: ManufacturerPreviewOptions): ManufacturerPreview {
  const selection = getManufacturerSelection(id), texture = structuredClone(options.texture);
  if (!texture.dataUrl?.startsWith(`data:${texture.mime};base64,`) || texture.storagePath)
    throw new Error('A private concept requires locally embedded artwork; remote and storage references are not fetched.');
  const project = createExampleProject(selection.layoutId), dimensions = selection.dimensions;
  const assumptions = [
    'Private concept only. Product specifications do not verify this image crop, installation set-out or material appearance.',
    selection.assets.calibrationLabel,
    selection.assets.materialLabel,
    'Artwork permission status is unchanged. This helper does not authorise public images, textures or editable-room redistribution.',
    'The room and artwork proof remain unconfirmed.',
  ];
  const coverage = options.coverage;
  if (dimensions.kind === 'vertical-repeat-panels' && !coverage)
    throw new Error('Record the full PJ source image coverage explicitly; panel dimensions and the approximate repeat do not establish a swatch crop scale.');
  if (coverage && (!Number.isFinite(coverage.widthMm) || !Number.isFinite(coverage.heightMm) || coverage.widthMm < 1 || coverage.heightMm < 1 || coverage.widthMm > 30000 || coverage.heightMm > 30000 || !['assumed', 'verified-full-image'].includes(coverage.status) || typeof coverage.evidence !== 'string' || !coverage.evidence.trim()))
    throw new Error('Record positive image-coverage dimensions up to 30 metres and their explicit evidence or assumption.');
  const heightMm = Math.round(coverage?.heightMm ?? (dimensions.kind === 'finite-panels' ? project.room.heightMm - project.room.corniceMm : dimensions.kind === 'vertical-repeat-panels' ? dimensions.panelHeightMm : dimensions.heightMm));
  const widthMm = Math.round(coverage?.widthMm ?? (dimensions.kind === 'repeatable-tiles' ? dimensions.widthMm : heightMm * texture.widthPx / texture.heightPx));
  if (coverage) assumptions.push(`${coverage.status === 'verified-full-image' ? 'Caller-supplied full-image coverage evidence (not independently verified by this helper)' : 'Assumed full-image coverage'}: ${coverage.evidence}`);
  else assumptions.push(dimensions.kind === 'repeatable-tiles'
    ? 'Assumed that the supplied image covers exactly one complete 900 × 800 mm tile; this has not been verified.'
    : `Assumed full-image height ${heightMm} mm and native image proportions; this is not a verified manufacturer panel crop.`);
  assumptions.push(`Private editor image coverage: ${widthMm} × ${heightMm} mm. Manufacturer fractional dimensions remain exact in selection metadata; editor values use whole millimetres.`);
  if (coverage && (coverage.widthMm !== widthMm || coverage.heightMm !== heightMm))
    assumptions.push(`Image coverage rounded from ${coverage.widthMm} × ${coverage.heightMm} mm to ${widthMm} × ${heightMm} mm for the integer-millimetre editor.`);

  const productName = id === 'phillip-jeffries-3163' ? 'Phillip Jeffries Metallic Ombre Gold on Horsehair 3163' : id === 'arte-adobe-97031' ? 'Arte Adobe Ecru 97031' : 'de Gournay Plum Blossom';
  const finish: ArtworkFinish = {
    id: `manufacturer-${id}`, type: dimensions.kind === 'repeatable-tiles' ? 'wallpaper' : 'mural',
    name: `${productName} · private concept`, texture,
    calibration: { widthMm, heightMm, crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, repeatKind: 'tile', match: 'straight', offsetAlreadyIncluded: false, proofAccepted: false },
  };
  const paint = { id: 'manufacturer-concept-paint', type: 'paint' as const, name: 'Private concept neutral paint', colour: '#d7d3cc', sheen: 'matte' as const };
  project.name = `Private concept · ${id === 'phillip-jeffries-3163' ? 'PJ Gold on Horsehair 3163' : productName}`;
  project.ownerId = null; project.room.confirmed = false; project.schemes = []; project.finishes = [finish, paint];
  project.assignments = project.room.vertices.map(vertex => ({ id: `concept-${vertex.wallId}`, wallId: vertex.wallId, finishId: paint.id, fromMm: 0, toMm: null, offsetXmm: 0, offsetYmm: 0 }));
  if (dimensions.kind === 'finite-panels') {
    // One finite image is cropped across the measured chimney front and returns. It never tiles
    // to fill the rest of the room or invents missing neighbouring panels.
    const walls = ['willow-chimney-right', 'willow-chimney-front', 'willow-chimney-left'];
    const run = walls.reduce((sum, wall) => sum + wallLength(project.room, wall), 0), start = Math.round((run - widthMm) / 2);
    const offsetYmm = project.room.heightMm - project.room.corniceMm - heightMm;
    let cumulative = 0;
    for (const wall of walls) {
      const assignment = project.assignments.find(item => item.wallId === wall)!;
      assignment.finishId = finish.id; assignment.offsetXmm = Math.round(start - cumulative); assignment.offsetYmm = offsetYmm;
      cumulative += wallLength(project.room, wall);
    }
    assumptions.push(`One finite artwork image centred and cropped across the ${run} mm chimney front and two returns, reaching below the skirting and up to the cornice (${offsetYmm} mm image origin). The alcoves and other walls stay painted. Full-image coverage is an explicit composition assumption, not the manufacturer's design height or a verified panel sequence.`);
  } else if (dimensions.kind === 'vertical-repeat-panels') {
    const wall = 'ochre-return-north', assignment = project.assignments.find(item => item.wallId === wall)!;
    assignment.finishId = finish.id; assignment.offsetXmm = Math.round((wallLength(project.room, wall) - widthMm) / 2);
    assignment.offsetYmm = project.room.heightMm - project.room.corniceMm - heightMm;
    assumptions.push('Only one finite image crop on the L-shaped return is shown. The approximate vertical repeat does not prove that this source image is a repeat, and no horizontal repeat is inferred.');
  } else {
    if (widthMm !== dimensions.widthMm || heightMm !== dimensions.heightMm)
      throw new Error('Adobe must keep its specified 900 × 800 mm tile dimensions.');
    if (coverage?.status === 'verified-full-image' && Math.abs(widthMm * texture.heightPx - heightMm * texture.widthPx) > Math.max(texture.widthPx, texture.heightPx))
      throw new Error('The claimed full-tile image proportions do not match the specified 900 × 800 mm tile.');
    project.assignments.forEach((assignment, index) => { if (index > 0) assignment.finishId = finish.id; });
    const continued = continueWallpaperAroundCorners(project, finish.id, project.room.vertices[1].wallId);
    project.assignments = continued.assignments;
    assumptions.push('Only the declared tile pattern is repeated. No measured relief amplitude, acoustic performance or physically measured material maps are inferred.');
  }
  const issues = validateProject(project);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join(' '));
  return { project, assumptions, selection };
}
