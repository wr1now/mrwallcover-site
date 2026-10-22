import type { FinishAsset, TextureAsset, ValidationIssue } from './types.ts';
import type { PhotoProject, PhotoSurface } from './photo-types.ts';
import { PHOTO_LIMITS } from './photo-types.ts';
import { quadError } from './photo-math.ts';
import { validateFinishAssets } from './validation.ts';
import { portableJsonBytes, PORTABLE_DOCUMENT_BUDGET_BYTES } from './portable.ts';

const record = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: unknown, allowed: string[]) => record(value) && Object.keys(value).every(key => allowed.includes(key));
const identifier = (value: unknown) => typeof value === 'string' && /^[a-z0-9_-]{1,100}$/i.test(value);
const name = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 120 && !/[\u0000-\u001f]/.test(value);
const timestamp = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
function validateTexture(texture: TextureAsset, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [], add = (message: string) => issues.push({ path, message });
  if (!keys(texture, ['id', 'sha256', 'mime', 'widthPx', 'heightPx', 'dataUrl', 'storagePath']) || !identifier(texture?.id) || !/^[a-f0-9]{64}$/i.test(texture?.sha256 || '') || !['image/png', 'image/jpeg', 'image/webp'].includes(texture?.mime) || ![texture?.widthPx, texture?.heightPx].every(n => Number.isInteger(n) && n > 0 && n <= 8192) || texture.widthPx * texture.heightPx > 25000000) { add('Use a complete PNG, JPEG or WebP photograph up to 8,192 pixels per side and 25 megapixels.'); return issues; }
  if (texture.dataUrl !== undefined && (typeof texture.dataUrl !== 'string' || texture.dataUrl.length > Math.ceil(20 * 1024 * 1024 / 3) * 4 + 40 || !texture.dataUrl.startsWith(`data:${texture.mime};base64,`) || !/^[A-Za-z0-9+/]+={0,2}$/.test(texture.dataUrl.slice(texture.dataUrl.indexOf(',') + 1)))) add('Embed an image up to 20 MB; remote image links are not opened.');
  if (texture.storagePath !== undefined && (typeof texture.storagePath !== 'string' || texture.storagePath.length > 250 || !/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\.(?:png|jpg|webp)$/.test(texture.storagePath))) add('Use a project-owned private image reference.');
  if (!texture.dataUrl && !texture.storagePath) add('Attach the photograph or its private storage reference.');
  return issues;
}
function validateSurfaces(surfaces: PhotoSurface[], finishes: FinishAsset[], path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [], add = (suffix: string, message: string) => issues.push({ path: `${path}${suffix}`, message });
  if (!Array.isArray(surfaces) || surfaces.length > PHOTO_LIMITS.surfaces) { add('', 'Use up to six wall surfaces per photograph.'); return issues; }
  const ids = new Set<string>(); let points = 0;
  surfaces.forEach((surface, i) => {
    const p = `.${i}`;
    if (!keys(surface, ['id', 'name', 'corners', 'strokes', 'finishId', 'widthMm', 'heightMm', 'scale', 'offsetXmm', 'offsetYmm', 'shading']) || !identifier(surface?.id) || ids.has(surface.id) || !name(surface?.name)) { add(p, 'Give each wall a unique identifier and name.'); return; } ids.add(surface.id);
    if (!Array.isArray(surface.corners) || surface.corners.length !== 4 || surface.corners.some(c => !keys(c, ['x', 'y']))) add(`${p}.corners`, 'Mark exactly four wall corners.');
    else { const error = quadError(surface.corners); if (error) add(`${p}.corners`, error); }
    for (const key of ['widthMm', 'heightMm'] as const) if (surface[key] !== null && (!Number.isInteger(surface[key]) || surface[key]! < 1 || surface[key]! > 30000)) add(`${p}.${key}`, 'Set a measured whole-millimetre wall size up to 30,000 mm, or leave it unknown.');
    if (![surface.scale, surface.shading, surface.offsetXmm, surface.offsetYmm].every(Number.isFinite) || surface.scale < .1 || surface.scale > 10 || surface.shading < 0 || surface.shading > 1 || Math.abs(surface.offsetXmm) > 60000 || Math.abs(surface.offsetYmm) > 60000) add(p, 'Keep scale, shading and placement within the supported controls.');
    if (surface.finishId !== null && !finishes.some(f => f?.id === surface.finishId)) add(`${p}.finishId`, 'Choose an existing finish.');
    if (!Array.isArray(surface.strokes) || surface.strokes.length > PHOTO_LIMITS.strokes) { add(`${p}.strokes`, 'Use up to 500 protection brush strokes per wall.'); return; }
    const strokeIds = new Set<string>(); surface.strokes.forEach((stroke, j) => {
      if (!keys(stroke, ['id', 'mode', 'radius', 'points']) || !identifier(stroke?.id) || strokeIds.has(stroke.id) || !['erase', 'restore'].includes(stroke?.mode) || !Number.isFinite(stroke.radius) || stroke.radius < .001 || stroke.radius > .15 || !Array.isArray(stroke.points) || stroke.points.length < 1 || stroke.points.some(point => !keys(point, ['x', 'y']) || ![point.x, point.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1))) add(`${p}.strokes.${j}`, 'Use bounded protection strokes within the photograph.');
      else { strokeIds.add(stroke.id); points += stroke.points.length; }
    });
  });
  if (points > PHOTO_LIMITS.strokePoints) add('', 'This comparison has too many brush points. Simplify the protection mask.');
  return issues;
}

/** Closed, bounded document validation. No browser API or image decoding. */
export function validatePhotoProject(project: PhotoProject): ValidationIssue[] {
  if (!record(project)) return [{ path: 'photo', message: 'Supply a photo project.' }];
  const issues: ValidationIssue[] = [], add = (path: string, message: string) => issues.push({ path, message });
  if (!keys(project, ['kind', 'schemaVersion', 'id', 'ownerId', 'name', 'source', 'surfaces', 'finishes', 'comparisons', 'revision', 'updatedAt']) || project.kind !== 'photo' || project.schemaVersion !== 1) add('photo', 'Unsupported photo project document.');
  if (!identifier(project.id) || (project.ownerId !== null && !identifier(project.ownerId))) add('id', 'Use safe project and owner identifiers.');
  if (!name(project.name) || !timestamp(project.updatedAt) || !Number.isInteger(project.revision) || project.revision < 1 || project.revision > 100000) add('revision', 'Supply a name, valid timestamp and revision from 1 to 100,000.');
  issues.push(...validateTexture(project.source, 'source'));
  issues.push(...validateFinishAssets(project.finishes).map(issue => ({ ...issue, path: `photo.${issue.path}` })));
  const finishes = Array.isArray(project.finishes) ? project.finishes : [];
  issues.push(...validateSurfaces(project.surfaces, finishes, 'surfaces'));
  if (!Array.isArray(project.comparisons) || project.comparisons.length > PHOTO_LIMITS.comparisons) add('comparisons', 'Keep up to eight saved comparisons.');
  else { const ids = new Set<string>(); project.comparisons.forEach((comparison, i) => {
    const p = `comparisons.${i}`;
    if (!keys(comparison, ['id', 'name', 'createdAt', 'surfaces', 'finishes']) || !identifier(comparison?.id) || ids.has(comparison.id) || !name(comparison?.name) || !timestamp(comparison?.createdAt)) { add(p, 'Supply a named comparison with a unique identifier and timestamp.'); return; } ids.add(comparison.id);
    issues.push(...validateFinishAssets(comparison.finishes).map(issue => ({ ...issue, path: `${p}.${issue.path}` })));
    issues.push(...validateSurfaces(comparison.surfaces, Array.isArray(comparison.finishes) ? comparison.finishes : [], `${p}.surfaces`));
  }); }
  const identities = new Map<string, string>();
  for (const texture of collectPhotoTextures(project)) { const identity = JSON.stringify([texture.sha256, texture.widthPx, texture.heightPx, texture.mime]); if (identities.has(texture.id) && identities.get(texture.id) !== identity) add('textures', 'Each texture identifier must identify the same image everywhere.'); identities.set(texture.id, identity); }
  return issues;
}
export function collectPhotoTextures(project: PhotoProject): TextureAsset[] {
  const textures: TextureAsset[] = project?.source ? [project.source] : [];
  for (const finishes of [project?.finishes, ...(Array.isArray(project?.comparisons) ? project.comparisons.map(c => c?.finishes) : [])]) if (Array.isArray(finishes)) for (const finish of finishes) if (finish && (finish.type === 'wallpaper' || finish.type === 'mural')) {
    if (finish.texture) textures.push(finish.texture);
    if ('panels' in finish && Array.isArray(finish.panels)) for (const panel of finish.panels) if (panel?.texture) textures.push(panel.texture);
  }
  return textures;
}
/** Legacy saved drafts may exceed today's portable budget. Cleanup must be
 * possible without allowing further growth or silently deleting comparisons. */
export function assertPhotoEditBudget(before: PhotoProject, next: PhotoProject, maximum = PORTABLE_DOCUMENT_BUDGET_BYTES): void {
  const size = portableJsonBytes(next);
  if (size > maximum && size >= portableJsonBytes(before)) throw new Error('This edit would exceed the 160 MB editable-file limit. Remove saved comparisons or unused artwork first. Your previous photo project is unchanged.');
}
