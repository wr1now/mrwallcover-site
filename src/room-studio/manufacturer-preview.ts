import { createExampleProject } from './examples.ts';
import { continueWallpaperAroundCorners } from './finishes.ts';
import { getManufacturerSelection } from './manufacturer-selections.ts';
import type { ManufacturerSelection, ManufacturerSelectionId } from './manufacturer-selections.ts';
import type { ArtworkFinish, RoomProject, TextureAsset, Vec3 } from './types.ts';
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
export interface ManufacturerAssumptionGroup {
  id: 'scale' | 'layout' | 'appearance' | 'status';
  title: string;
  notes: string[];
}
export interface ManufacturerPreview {
  project: RoomProject;
  assumptions: string[];
  assumptionGroups: ManufacturerAssumptionGroup[];
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
  const assumptions: string[] = [];
  const assumptionNotes: Record<ManufacturerAssumptionGroup['id'], string[]> = { scale: [], layout: [], appearance: [], status: [] };
  const addAssumption = (group: ManufacturerAssumptionGroup['id'], note: string): void => {
    assumptions.push(note);
    assumptionNotes[group].push(note);
  };
  addAssumption('status', 'Private concept only. Product specifications do not verify this image crop, installation set-out or material appearance.');
  addAssumption('scale', selection.assets.calibrationLabel);
  addAssumption('appearance', selection.assets.materialLabel);
  addAssumption('status', 'Artwork permission status is unchanged. This helper does not authorise public images, textures or editable-room redistribution.');
  addAssumption('status', 'The room and artwork proof remain unconfirmed.');
  const coverage = options.coverage;
  if (dimensions.kind === 'vertical-repeat-panels' && !coverage)
    throw new Error('Record the full PJ source image coverage explicitly; panel dimensions and the approximate repeat do not establish a swatch crop scale.');
  if (dimensions.kind === 'textile-repeat' && !coverage)
    throw new Error('Record the assumed Caisson full-image coverage explicitly; product width does not establish the reference framing.');
  if (coverage && (!Number.isFinite(coverage.widthMm) || !Number.isFinite(coverage.heightMm) || coverage.widthMm < 1 || coverage.heightMm < 1 || coverage.widthMm > 30000 || coverage.heightMm > 30000 || !['assumed', 'verified-full-image'].includes(coverage.status) || typeof coverage.evidence !== 'string' || !coverage.evidence.trim()))
    throw new Error('Record positive image-coverage dimensions up to 30 metres and their explicit evidence or assumption.');
  const heightMm = Math.round(coverage?.heightMm ?? (dimensions.kind === 'finite-panels' ? project.room.heightMm - project.room.corniceMm : dimensions.kind === 'vertical-repeat-panels' ? dimensions.panelHeightMm : dimensions.verticalRepeatMm));
  const widthMm = Math.round(coverage?.widthMm ?? heightMm * texture.widthPx / texture.heightPx);
  if (coverage) addAssumption('scale', `${coverage.status === 'verified-full-image' ? 'Caller-supplied full-image coverage evidence (not independently verified by this helper)' : 'Assumed full-image coverage'}: ${coverage.evidence}`);
  else addAssumption('scale', `Assumed full-image height ${heightMm} mm and native image proportions; this is not a verified manufacturer panel crop.`);
  addAssumption('scale', `Private editor image coverage: ${widthMm} × ${heightMm} mm. Manufacturer fractional dimensions remain exact in selection metadata; editor values use whole millimetres.`);
  if (coverage && (coverage.widthMm !== widthMm || coverage.heightMm !== heightMm))
    addAssumption('scale', `Image coverage rounded from ${coverage.widthMm} × ${coverage.heightMm} mm to ${widthMm} × ${heightMm} mm for the integer-millimetre editor.`);
  if (dimensions.kind !== 'textile-repeat' && Math.abs(widthMm * texture.heightPx - heightMm * texture.widthPx) > Math.max(texture.widthPx, texture.heightPx))
    throw new Error('The source block must preserve the full artwork proportions after integer-millimetre rounding.');

  const productName = id === 'phillip-jeffries-3163' ? 'Phillip Jeffries Metallic Ombre Gold on Horsehair 3163' : id === 'arte-caisson-61533' ? 'Arte Caisson 61533' : 'de Gournay Plum Blossom';
  const appearance: ArtworkFinish['appearance'] = id === 'degournay-plum-blossom' ? { roughness: .65, metalness: .35 }
    : id === 'phillip-jeffries-3163' ? { roughness: .42, metalness: .7 }
      : { roughness: .85, metalness: 0, relief: { kind: 'coffered', depthMm: 8, columns: 9, rows: 5 } };
  const finish: ArtworkFinish = {
    id: `manufacturer-${id}`, type: 'wallpaper',
    name: `${productName} · private concept`, texture,
    calibration: { widthMm, heightMm, crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, repeatKind: 'tile', match: 'straight', offsetAlreadyIncluded: false, proofAccepted: false },
    appearance,
  };
  const paint = { id: 'manufacturer-concept-paint', type: 'paint' as const, name: 'Private concept neutral paint', colour: '#d7d3cc', sheen: 'matte' as const };
  project.name = `Private concept · ${id === 'phillip-jeffries-3163' ? 'PJ Gold on Horsehair 3163' : productName}`;
  project.ownerId = null; project.room.confirmed = false; project.schemes = []; project.finishes = [finish, paint];
  project.room.openings = project.room.openings.map(opening => opening.kind === 'window' ? { ...opening, frameMm: 45 } : opening);
  addAssumption('layout', 'Private window frames use an illustrative 45 mm width. Surveyed wall and opening dimensions remain unchanged.');
  const offsetYmm = dimensions.kind === 'vertical-repeat-panels' ? project.room.heightMm - project.room.corniceMm - heightMm : 0;
  project.assignments = project.room.vertices.map(vertex => ({ id: `concept-${vertex.wallId}`, wallId: vertex.wallId, finishId: finish.id, fromMm: 0, toMm: null, offsetXmm: 0, offsetYmm }));
  if (dimensions.kind === 'finite-panels') {
    addAssumption('layout', `PRIVATE full-room source preview: the exact supplied reference artwork is duplicated horizontally as a ${widthMm} × ${heightMm} mm source block to cover every wall. This does not represent a de Gournay product repeat or a verified tailored panel sequence. The assumed artwork scale stays fixed; no missing design is generated or stretched to the room perimeter.`);
    addAssumption('appearance', 'Silver appearance settings (roughness 0.65, metalness 0.35) soften glare in this illustrative study; they are not measured manufacturer PBR properties.');
  } else if (dimensions.kind === 'vertical-repeat-panels') {
    if (heightMm < project.room.heightMm)
      throw new Error('The PJ full-panel source height must cover the room without vertical source repetition.');
    addAssumption('layout', `PRIVATE full-room source preview: the supplied four-drop reference sheet is duplicated horizontally as a ${widthMm} × ${heightMm} mm source block. This is illustrative source reuse, not a product horizontal repeat. Only one full-panel height is used vertically; the approximate product vertical repeat is not substituted for the sheet height.`);
    addAssumption('layout', `The unchanged full-panel source is top-aligned below the cornice at ${project.room.heightMm - project.room.corniceMm} mm, with vertical set-out ${offsetYmm} mm. Excess artwork below the finished floor is cropped, preserving the gold upper area without resizing the source.`);
    addAssumption('appearance', 'Gold appearance settings (roughness 0.42, metalness 0.70) are illustrative study values, not measured manufacturer PBR properties.');
  } else {
    if (widthMm !== 3690 || heightMm !== 2300)
      throw new Error('This private Caisson full-image study must keep its explicitly inferred 3690 × 2300 mm coverage.');
    if (coverage?.status !== 'assumed')
      throw new Error('The Caisson source framing is assumed, not verified manufacturer artwork mapping.');
    const verticalAspectCorrection = (heightMm * texture.widthPx / (widthMm * texture.heightPx) - 1) * 100;
    addAssumption('layout', 'PRIVATE Caisson whole-image source preview repeats an inferred 3690 × 2300 mm block: three 1230 mm product widths, with nine columns and five rows inferred from the reference framing. Each analytic cell is 410 × 460 mm; the inferred cell width is not an official tile size.');
    addAssumption('scale', `The complete supplied image and all its pixels are retained. The inferred physical coverage applies an explicit ${verticalAspectCorrection.toFixed(2)}% vertical aspect correction relative to native image proportions; this is an assumed framing correction, not calibrated manufacturer artwork.`);
    addAssumption('appearance', 'The analytic coffered profile uses an illustrative 8 mm amplitude, nine columns and five rows per source block, roughness 0.85 and metalness 0. No measured relief amplitude, acoustic rating or manufacturer PBR properties are inferred from the photograph.');
  }
  project.assignments = continueWallpaperAroundCorners(project, finish.id, project.room.vertices[0].wallId).assignments;
  addAssumption('layout', 'All room walls receive the same source at continuous cumulative offsets. Openings remain true cut-outs. The closure seam is an illustrative start/end seam, not a claim of an exact manufacturer panel match.');
  const views: { position: Vec3; target: Vec3 }[] = id === 'degournay-plum-blossom'
    ? [{ position: [.9, 1.6, .9], target: [3.6, 1.4, 3.9] }, { position: [5.3, 1.6, 3.7], target: [1.8, 1.4, .9] }]
    : id === 'phillip-jeffries-3163'
      ? [{ position: [.75, 1.6, .7], target: [3.5, 1.35, 3.1] }, { position: [1.1, 1.6, 4], target: [4.3, 1.35, 1.8] }]
      : [{ position: [.9, 1.6, .75], target: [3.3, 1.4, 3.7] }, { position: [4.4, 1.6, 3.2], target: [1.6, 1.4, .9] }];
  let perspective = 0;
  project.cameras = project.cameras.map(camera => camera.kind === 'perspective' ? { ...camera, ...views[perspective++], fov: 75 } : camera);
  addAssumption('layout', 'Two wide interior viewpoints show complementary sides of the fully covered room; the saved panorama retains its full-room position.');
  const issues = validateProject(project);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join(' '));
  const assumptionGroups: ManufacturerAssumptionGroup[] = [
    { id: 'scale', title: 'Source and scale', notes: assumptionNotes.scale },
    { id: 'layout', title: 'Room set-out', notes: assumptionNotes.layout },
    { id: 'appearance', title: 'Material appearance', notes: assumptionNotes.appearance },
    { id: 'status', title: 'Review and permissions', notes: assumptionNotes.status },
  ];
  return { project, assumptions, assumptionGroups, selection };
}
