import type { FinishAsset, Point2, RoomDefinition, RoomProject, ValidationIssue, WallFinishAssignment } from './types.ts';

export const ROOM_LIMITS = { vertices: 12, openings: 24, maxDimensionMm: 30000, maxHeightMm: 6000, maxArtworkPixels: 25000000 } as const;
export const TEXTURE_LIMITS = { maxPixels: ROOM_LIMITS.maxArtworkPixels, maxEdge: 8192 } as const;
export const PROJECT_LIMITS = { schemes: 3, finishes: 48, assignments: 96, cameras: 8, nameLength: 120, revision: 100000 } as const;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const integer = (n: unknown): n is number => finite(n) && Number.isSafeInteger(n);
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9_-]{1,100}$/i.test(value);
const name = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= PROJECT_LIMITS.nameLength && !/[\u0000-\u001f\u007f]/.test(value);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const knownKeys = (value: unknown, keys: string[]) => record(value) && Object.keys(value).every(key => keys.includes(key));
function timestamp(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
/** Source links in imported projects can only point to the official UK product route. */
export function isBauwerkProductUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 300 && /^https:\/\/www\.bauwerkcolour\.com\/en-gb\/product\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
export const signedPlanArea = (points: Point2[]): number => points.reduce((a, p, i) => {
  const q = points[(i + 1) % points.length]; return a + p.x * q.z - q.x * p.z;
}, 0) / 2;
export function wallLength(room: RoomDefinition, wallId: string): number {
  const i = room.vertices.findIndex(v => v.wallId === wallId);
  if (i < 0) return 0;
  const a = room.vertices[i], b = room.vertices[(i + 1) % room.vertices.length];
  return Math.hypot(b.x - a.x, b.z - a.z);
}
const cross = (a: Point2, b: Point2, p: Point2) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
const onSegment = (p: Point2, a: Point2, b: Point2) => Math.abs(cross(a, b, p)) < 0.00001 && p.x >= Math.min(a.x, b.x) - 0.00001 && p.x <= Math.max(a.x, b.x) + 0.00001 && p.z >= Math.min(a.z, b.z) - 0.00001 && p.z <= Math.max(a.z, b.z) + 0.00001;
export function pointInsideRoom(room: RoomDefinition, point: Point2): boolean {
  if (!room || !Array.isArray(room.vertices) || room.vertices.some(v => !v || !finite(v.x) || !finite(v.z)) || !finite(point.x) || !finite(point.z)) return false;
  let inside = false;
  for (let i = 0, j = room.vertices.length - 1; i < room.vertices.length; j = i++) {
    const a = room.vertices[i], b = room.vertices[j];
    if (onSegment(point, a, b)) return false; // Cameras must be strictly inside, never on a wall.
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
function intersects(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return (abC * abD < 0 && cdA * cdB < 0) || onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
}
export function validateRoom(room: RoomDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path: `room.${path}`, message });
  if (!record(room)) return [{ path: 'room', message: 'Supply a room definition.' }];
  if (!knownKeys(room, ['vertices', 'heightMm', 'openings', 'skirtingMm', 'corniceMm', 'confirmed'])) add('', 'Room data contains unsupported fields.');
  if (typeof room.confirmed !== 'boolean') add('confirmed', 'Record whether the room measurements are confirmed.');
  if (!Array.isArray(room.vertices) || room.vertices.length < 3 || room.vertices.length > ROOM_LIMITS.vertices) return [{ path: 'room.vertices', message: 'Use one simple room with 3–12 corners.' }];
  const validPoints = room.vertices.every(v => v && integer(v.x) && integer(v.z) && Math.abs(v.x) <= ROOM_LIMITS.maxDimensionMm && Math.abs(v.z) <= ROOM_LIMITS.maxDimensionMm);
  if (!validPoints) add('vertices', 'Corner coordinates must be integer millimetres within 30 metres of the origin.');
  const ids = room.vertices.map(v => v?.wallId);
  if (ids.some(id => !identifier(id)) || new Set(ids).size !== ids.length || room.vertices.some(v => !knownKeys(v, ['x', 'z', 'wallId']))) add('vertices', 'Every wall needs a unique safe identifier and supported corner coordinates.');
  if (!integer(room.heightMm) || room.heightMm < 1200 || room.heightMm > ROOM_LIMITS.maxHeightMm) add('heightMm', 'Enter a ceiling height between 1,200 and 6,000 mm.');
  for (const field of ['skirtingMm', 'corniceMm'] as const) if (!integer(room[field]) || room[field] < 0 || room[field] > 400) add(field, 'Enter a trim height from 0 to 400 mm.');
  if (finite(room.skirtingMm) && finite(room.corniceMm) && room.skirtingMm + room.corniceMm >= room.heightMm) add('skirtingMm', 'Trim must leave a visible wall surface.');
  if (validPoints) {
    if (signedPlanArea(room.vertices) <= 10000) add('vertices', 'Draw a non-zero room in counter-clockwise plan order.');
    for (let i = 0; i < room.vertices.length; i++) {
      const a = room.vertices[i], b = room.vertices[(i + 1) % room.vertices.length];
      if (Math.hypot(b.x - a.x, b.z - a.z) < 100) add(`vertices.${i}`, 'Each wall must be at least 100 mm long.');
      for (let j = i + 1; j < room.vertices.length; j++) {
        if (j === i + 1 || (i === 0 && j === room.vertices.length - 1)) continue;
        if (intersects(a, b, room.vertices[j], room.vertices[(j + 1) % room.vertices.length])) add('vertices', 'Walls cannot cross or touch other walls except at their shared corner.');
      }
    }
    if (Math.max(...room.vertices.map(v => v.x)) - Math.min(...room.vertices.map(v => v.x)) > ROOM_LIMITS.maxDimensionMm || Math.max(...room.vertices.map(v => v.z)) - Math.min(...room.vertices.map(v => v.z)) > ROOM_LIMITS.maxDimensionMm) add('vertices', 'Room width and depth must each stay within 30 metres.');
  }
  if (!Array.isArray(room.openings) || room.openings.length > ROOM_LIMITS.openings) { add('openings', 'Use at most 24 doors and windows.'); return issues; }
  const openingIds = new Set<string>();
  room.openings.forEach((o, i) => {
    const p = `openings.${i}`;
    if (!o || typeof o !== 'object') { add(p, 'Supply a door or window definition.'); return; }
    if (!knownKeys(o, ['id', 'wallId', 'kind', 'offsetMm', 'widthMm', 'heightMm', 'sillMm', 'revealMm'])) add(p, 'Opening data contains unsupported fields.');
    if (!identifier(o.id) || openingIds.has(o.id)) add(`${p}.id`, 'Each opening needs a unique safe identifier.'); openingIds.add(o.id);
    if (!ids.includes(o.wallId)) add(`${p}.wallId`, 'Choose an existing wall for this opening.');
    if (!['door', 'window'].includes(o.kind)) add(`${p}.kind`, 'Choose door or window.');
    for (const key of ['offsetMm', 'widthMm', 'heightMm', 'sillMm', 'revealMm'] as const) if (!integer(o[key])) add(`${p}.${key}`, 'Opening dimensions must be integer millimetres.');
    if (o.widthMm < 100 || o.heightMm < 100 || o.offsetMm < 0 || o.sillMm < 0 || o.revealMm < 0 || o.revealMm > 600) add(p, 'Use positive opening sizes, a non-negative position and a reveal no deeper than 600 mm.');
    if (o.kind === 'door' && o.sillMm !== 0) add(`${p}.sillMm`, 'A door starts at finished floor level.');
    if (validPoints && o.offsetMm + o.widthMm > wallLength(room, o.wallId) + 0.001) add(p, 'The opening extends past the end of its wall.');
    if (o.sillMm + o.heightMm > room.heightMm) add(p, 'The opening extends above the ceiling.');
    for (let j = 0; j < i; j++) {
      const a = room.openings[j];
      if (a && a.wallId === o.wallId && o.offsetMm < a.offsetMm + a.widthMm && o.offsetMm + o.widthMm > a.offsetMm && o.sillMm < a.sillMm + a.heightMm && o.sillMm + o.heightMm > a.sillMm) add(p, 'Doors and windows on the same wall cannot overlap.');
    }
  });
  return issues;
}
function validateFinishSet(finishes: FinishAsset[], assignments: WallFinishAssignment[], room: RoomDefinition, issues: ValidationIssue[], prefix: string, textureIdentities: Map<string, string>): void {
  const add = (path: string, message: string) => issues.push({ path: `${prefix}${path}`, message });
  if (!Array.isArray(finishes) || finishes.length > PROJECT_LIMITS.finishes) { add('finishes', 'Use at most 48 finish assets.'); return; }
  const finishIds = new Set<string>();
  finishes.forEach((f, i) => {
    const path = `finishes.${i}`;
    if (!f || !identifier(f.id) || f.id.startsWith('neutral-') || finishIds.has(f.id)) { add(path, 'Finishes need unique safe identifiers outside the reserved neutral- namespace.'); return; }
    finishIds.add(f.id);
    if (!name(f.name)) add(`${path}.name`, 'Give each finish a name of 1–120 characters without control characters.');
    if (!['paint', 'bauwerk', 'wallpaper', 'mural'].includes(f.type)) { add(path, 'Unsupported finish type.'); return; }
    if (f.type === 'paint' || f.type === 'bauwerk') {
      const fields = f.type === 'paint' ? ['sheen'] : ['shadeId', 'catalogueVersion', 'productUrl', 'colourProvenance', 'seed'];
      if (!knownKeys(f, ['id', 'type', 'name', 'colour', ...fields])) add(path, 'Finish data contains unsupported fields.');
      if (typeof f.colour !== 'string' || !/^#[0-9a-f]{6}$/i.test(f.colour)) add(`${path}.colour`, 'Use an sRGB hex colour.');
      if (f.type === 'paint' && !['matte', 'eggshell'].includes(f.sheen)) add(`${path}.sheen`, 'Choose matte or eggshell paint.');
      if (f.type === 'bauwerk') {
        if (!integer(f.seed) || f.seed < 0 || f.seed > 4294967295) add(`${path}.seed`, 'Limewash needs a fixed unsigned 32-bit material seed.');
        if (!identifier(f.shadeId)) add(`${path}.shadeId`, 'Keep the source shade identifier.');
        if (typeof f.catalogueVersion !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(f.catalogueVersion)) add(`${path}.catalogueVersion`, 'Keep a bounded source catalogue version.');
        if (!['manufacturer', 'derived-preview'].includes(f.colourProvenance)) add(`${path}.colourProvenance`, 'Record the screen colour provenance.');
        if (!isBauwerkProductUrl(f.productUrl)) add(`${path}.productUrl`, 'Use the official Bauwerk UK HTTPS product link.');
      }
      return;
    }
    if (!knownKeys(f, ['id', 'type', 'name', 'texture', 'calibration'])) add(path, 'Artwork data contains unsupported fields.');
    const c = f.calibration, t = f.texture;
    if (!t || typeof t.id !== 'string' || !/^[a-z0-9_-]{1,100}$/i.test(t.id) || typeof t.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(t.sha256) || !['image/png', 'image/jpeg', 'image/webp'].includes(t.mime) || !integer(t.widthPx) || !integer(t.heightPx) || t.widthPx < 1 || t.heightPx < 1 || t.widthPx > TEXTURE_LIMITS.maxEdge || t.heightPx > TEXTURE_LIMITS.maxEdge || t.widthPx * t.heightPx > TEXTURE_LIMITS.maxPixels) add(`${path}.texture`, 'Use an identified artwork image up to 8,192 px per side and 25 megapixels.');
    if (t) {
      if (!knownKeys(t, ['id', 'sha256', 'mime', 'widthPx', 'heightPx', 'dataUrl', 'storagePath'])) add(`${path}.texture`, 'Artwork references contain unsupported fields.');
      if (t.dataUrl !== undefined && (typeof t.dataUrl !== 'string' || t.dataUrl.length > Math.ceil(20 * 1024 * 1024 / 3) * 4 + 40 || !t.dataUrl.startsWith(`data:${t.mime};base64,`) || !/^[A-Za-z0-9+/]+={0,2}$/.test(t.dataUrl.slice(t.dataUrl.indexOf(',') + 1)))) add(`${path}.texture.dataUrl`, 'Embed a PNG, JPEG or WebP file of at most 20 MB; remote image URLs are not accepted.');
      if (t.storagePath !== undefined && (typeof t.storagePath !== 'string' || t.storagePath.length > 250 || !/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\.(?:png|jpg|webp)$/.test(t.storagePath))) add(`${path}.texture.storagePath`, 'Use a private artwork reference from this room service.');
      if (!t.dataUrl && !t.storagePath) add(`${path}.texture`, 'Include the artwork file or its private storage reference.');
    }
    if (t && typeof t.id === 'string') {
      const identity = JSON.stringify([t.sha256, t.mime, t.widthPx, t.heightPx]);
      if (textureIdentities.has(t.id) && textureIdentities.get(t.id) !== identity) add(`${path}.texture.id`, 'A texture identifier must always refer to the same artwork file.');
      textureIdentities.set(t.id, identity);
    }
    if (!c || !integer(c.widthMm) || !integer(c.heightMm) || c.widthMm < 1 || c.heightMm < 1 || c.widthMm > 30000 || c.heightMm > 30000) { add(`${path}.calibration`, 'Calibrate the prepared artwork width and height in millimetres.'); return; }
    if (!knownKeys(c, ['widthMm', 'heightMm', 'crop', 'rotation', 'repeatKind', 'match', 'offsetAlreadyIncluded', 'proofAccepted'])) add(`${path}.calibration`, 'Artwork calibration contains unsupported fields.');
    if (![0, 90, 180, 270].includes(c.rotation)) add(`${path}.calibration.rotation`, 'Use a 0°, 90°, 180° or 270° rotation.');
    if (!['tile', 'strip'].includes(c.repeatKind) || !['straight', 'half-drop'].includes(c.match)) add(`${path}.calibration`, 'Choose a supported repeat and match.');
    if (typeof c.offsetAlreadyIncluded !== 'boolean' || typeof c.proofAccepted !== 'boolean') add(`${path}.calibration`, 'Record whether the repeat offset is already included and whether its proof is accepted.');
    const crop = c.crop;
    if (!knownKeys(crop, ['x', 'y', 'width', 'height']) || ![crop.x, crop.y, crop.width, crop.height].every(finite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 1.000001 || crop.y + crop.height > 1.000001) add(`${path}.calibration.crop`, 'Keep the normalized crop wholly inside the artwork.');
    else if (f.type === 'mural' && t && finite(t.widthPx) && finite(t.heightPx)) {
      const cropWidth = Math.max(1, Math.round(t.widthPx * crop.width)), cropHeight = Math.max(1, Math.round(t.heightPx * crop.height));
      const width = c.rotation % 180 ? cropHeight : cropWidth, height = c.rotation % 180 ? cropWidth : cropHeight;
      if (Math.abs(c.widthMm * height - c.heightMm * width) > Math.max(width, height)) add(`${path}.calibration`, 'Mural dimensions must preserve the cropped artwork proportions. Reopen its crop and proof to resize it.');
    }
  });
  if (!Array.isArray(assignments) || assignments.length > PROJECT_LIMITS.assignments) { add('assignments', 'Use at most 96 wall finish bands.'); return; }
  const assignmentIds = new Set<string>();
  assignments.forEach((a, i) => {
    const path = `assignments.${i}`;
    if (!a || !identifier(a.id) || assignmentIds.has(a.id)) { add(path, 'Finish bands need unique safe identifiers.'); return; }
    assignmentIds.add(a.id);
    if (!knownKeys(a, ['id', 'wallId', 'finishId', 'fromMm', 'toMm', 'offsetXmm', 'offsetYmm'])) add(path, 'Finish bands contain unsupported fields.');
    if (!Array.isArray(room?.vertices) || !room.vertices.some(v => v?.wallId === a.wallId)) add(`${path}.wallId`, 'Choose an existing wall.');
    if (!finishIds.has(a.finishId)) add(`${path}.finishId`, 'Choose an existing finish.');
    if (!integer(a.fromMm) || a.fromMm < 0 || (a.toMm !== null && (!integer(a.toMm) || a.toMm > room?.heightMm)) || (a.toMm ?? room?.heightMm) <= a.fromMm) add(path, 'Finish bands must have a positive height within the room.');
    if (!integer(a.offsetXmm) || !integer(a.offsetYmm) || Math.abs(a.offsetXmm) > 60000 || Math.abs(a.offsetYmm) > 60000) add(path, 'Set-out offsets must be integer millimetres within 60 metres.');
    for (let j = 0; j < i; j++) {
      const b = assignments[j];
      if (b && a.wallId === b.wallId && a.fromMm < (b.toMm ?? room?.heightMm) && (a.toMm ?? room?.heightMm) > b.fromMm) add(path, 'Finish bands on the same wall cannot overlap.');
    }
  });
}
export function validateProject(project: RoomProject): ValidationIssue[] {
  if (!record(project)) return [{ path: 'project', message: 'Supply a room project.' }];
  const issues = validateRoom(project.room);
  const add = (path: string, message: string) => issues.push({ path, message });
  if (!knownKeys(project, ['schemaVersion', 'id', 'ownerId', 'name', 'room', 'finishes', 'assignments', 'cameras', 'lighting', 'schemes', 'revision', 'updatedAt'])) add('project', 'Room project data contains unsupported fields.');
  if (project.schemaVersion !== 1) add('schemaVersion', 'Unsupported room project version.');
  if (!identifier(project.id) || !integer(project.revision) || project.revision < 1 || project.revision > PROJECT_LIMITS.revision) add('revision', 'Supply a safe project identifier and a positive revision number up to 100,000.');
  if (project.ownerId !== null && !identifier(project.ownerId)) add('ownerId', 'Use a valid owner identifier or null for a local room.');
  if (!name(project.name)) add('name', 'Give the room a name of 1–120 characters without control characters.');
  if (!timestamp(project.updatedAt)) add('updatedAt', 'Record a valid ISO room update timestamp.');
  if (!['daylight', 'warm'].includes(project.lighting)) add('lighting', 'Choose daylight or warm lighting.');
  const textureIdentities = new Map<string, string>();
  validateFinishSet(project.finishes, project.assignments, project.room, issues, '', textureIdentities);
  if (!Array.isArray(project.schemes) || project.schemes.length > PROJECT_LIMITS.schemes) add('schemes', 'Keep up to three saved finish schemes.');
  else {
    const schemeIds = new Set<string>();
    project.schemes.forEach((scheme, i) => {
      const path = `schemes.${i}`;
      if (!scheme || !identifier(scheme.id) || schemeIds.has(scheme.id)) { add(path, 'Finish schemes need unique safe identifiers.'); return; }
      schemeIds.add(scheme.id);
      if (!knownKeys(scheme, ['id', 'name', 'finishes', 'assignments'])) add(path, 'Finish schemes contain unsupported fields.');
      if (!name(scheme.name)) add(`${path}.name`, 'Give each scheme a name of 1–120 characters without control characters.');
      validateFinishSet(scheme.finishes, scheme.assignments, project.room, issues, `${path}.`, textureIdentities);
    });
  }
  if (!Array.isArray(project.cameras) || project.cameras.length > PROJECT_LIMITS.cameras) { add('cameras', 'Use at most eight saved camera views.'); return issues; }
  const cameraIds = new Set<string>();
  project.cameras.forEach((c, i) => {
    const path = `cameras.${i}`;
    if (!c || !['perspective', 'panorama'].includes(c.kind) || !Array.isArray(c.position) || !Array.isArray(c.target) || c.position.length !== 3 || c.target.length !== 3 || ![...c.position, ...c.target, c.fov].every(finite)) { add(path, 'Supply finite camera coordinates and a supported camera type.'); return; }
    if (!identifier(c.id) || cameraIds.has(c.id)) add(`${path}.id`, 'Camera views need unique safe identifiers.');
    cameraIds.add(c.id);
    if (!knownKeys(c, ['id', 'kind', 'position', 'target', 'fov'])) add(path, 'Camera data contains unsupported fields.');
    if ([...c.position, ...c.target].some(v => Math.abs(v) >= 100)) add(path, 'Keep camera positions and targets within 100 metres of the room origin.');
    if (c.fov < 25 || c.fov > 110) add(`${path}.fov`, 'Choose a lens field of view from 25° to 110°.');
    if (c.position[1] <= 0.1 || c.position[1] >= project.room?.heightMm / 1000 - 0.1 || !pointInsideRoom(project.room, { x: c.position[0] * 1000, z: c.position[2] * 1000 })) add(path, 'Place the camera inside the room, clear of the floor, ceiling and walls.');
    if (Math.hypot(...c.position.map((n, k) => n - c.target[k])) < 0.001) add(path, 'Aim the camera away from its own position.');
  });
  return issues;
}
