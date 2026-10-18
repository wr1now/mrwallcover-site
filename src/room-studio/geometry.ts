import type { ArtworkFinish, CompiledMaterial, CompiledMesh, FinishAsset, Point2, RenderPackage, RoomDefinition, RoomRevision, StudioCamera, Vec3 } from './types.ts';
import { pointInsideRoom, validateProject, validateRoom, wallLength } from './validation.ts';
export { pointInsideRoom, wallLength } from './validation.ts';

export const COMPILER_VERSION = 'room-studio-geometry/1.0.0';
const mm = (value: number) => value / 1000;
const EPS = 0.00001;
type Pair = [number, number];
const quadIndices = [0, 1, 2, 0, 2, 3];

export function createRectangle(widthMm = 4200, depthMm = 3600, heightMm = 2600): RoomDefinition {
  return { vertices: [{ x: 0, z: 0, wallId: 'wall-south' }, { x: widthMm, z: 0, wallId: 'wall-east' }, { x: widthMm, z: depthMm, wallId: 'wall-north' }, { x: 0, z: depthMm, wallId: 'wall-west' }], heightMm, openings: [], skirtingMm: 100, corniceMm: 80, confirmed: false };
}
export function createLShape(widthMm = 5200, depthMm = 4200, heightMm = 2600, notchWidthMm = 1800, notchDepthMm = 1600): RoomDefinition {
  return { ...createRectangle(widthMm, depthMm, heightMm), vertices: [{ x: 0, z: 0, wallId: 'wall-south' }, { x: widthMm, z: 0, wallId: 'wall-east' }, { x: widthMm, z: depthMm - notchDepthMm, wallId: 'wall-return-north' }, { x: widthMm - notchWidthMm, z: depthMm - notchDepthMm, wallId: 'wall-return-east' }, { x: widthMm - notchWidthMm, z: depthMm, wallId: 'wall-north' }, { x: 0, z: depthMm, wallId: 'wall-west' }] };
}

function cross(a: Point2, b: Point2, c: Point2): number { return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x); }
/** Ear clipping keeps concave rooms closed; all calculations remain floating point. */
export function triangulateRoom(points: Point2[]): number[] {
  const remaining = points.map((_, i) => i), triangles: number[] = [];
  let guard = points.length * points.length;
  const inTriangle = (p: Point2, a: Point2, b: Point2, c: Point2) => cross(a, b, p) >= -EPS && cross(b, c, p) >= -EPS && cross(c, a, p) >= -EPS;
  while (remaining.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let j = 0; j < remaining.length; j++) {
      const ia = remaining[(j + remaining.length - 1) % remaining.length], ib = remaining[j], ic = remaining[(j + 1) % remaining.length];
      if (cross(points[ia], points[ib], points[ic]) <= EPS) continue;
      if (remaining.some(i => i !== ia && i !== ib && i !== ic && inTriangle(points[i], points[ia], points[ib], points[ic]))) continue;
      triangles.push(ia, ib, ic); remaining.splice(j, 1); clipped = true; break;
    }
    if (!clipped) {
      const collinear = remaining.findIndex((ib, j) => Math.abs(cross(points[remaining[(j + remaining.length - 1) % remaining.length]], points[ib], points[remaining[(j + 1) % remaining.length]])) <= EPS);
      if (collinear >= 0) remaining.splice(collinear, 1); else throw new Error('Room triangulation failed; check the wall outline.');
    }
  }
  if (remaining.length === 3) triangles.push(...remaining);
  if (!triangles.length) throw new Error('Room has no triangulatable floor.');
  return triangles;
}

function distanceToEdge(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
export function suggestCameras(room: RoomDefinition): StudioCamera[] {
  if (validateRoom(room).length) return [];
  const xs = room.vertices.map(v => v.x), zs = room.vertices.map(v => v.z), minX = Math.min(...xs), minZ = Math.min(...zs), width = Math.max(...xs) - minX, depth = Math.max(...zs) - minZ;
  const candidates: (Point2 & { clearance: number })[] = [];
  for (let x = 1; x < 12; x++) for (let z = 1; z < 12; z++) {
    const p = { x: minX + width * x / 12, z: minZ + depth * z / 12 };
    if (pointInsideRoom(room, p)) candidates.push({ ...p, clearance: Math.min(...room.vertices.map((a, i) => distanceToEdge(p, a, room.vertices[(i + 1) % room.vertices.length]))) });
  }
  if (!candidates.length) {
    const tri = triangulateRoom(room.vertices).slice(0, 3).map(i => room.vertices[i]);
    const p = { x: tri.reduce((s, v) => s + v.x, 0) / 3, z: tri.reduce((s, v) => s + v.z, 0) / 3 };
    candidates.push({ ...p, clearance: 1 });
  }
  const centre = candidates.reduce((a, b) => b.clearance > a.clearance ? b : a);
  const safe = candidates.filter(p => p.clearance >= Math.min(250, centre.clearance * 0.7));
  const first = safe.reduce((a, b) => Math.hypot(b.x - centre.x, b.z - centre.z) > Math.hypot(a.x - centre.x, a.z - centre.z) ? b : a, centre);
  const second = safe.reduce((a, b) => Math.hypot(b.x - first.x, b.z - first.z) > Math.hypot(a.x - first.x, a.z - first.z) ? b : a, centre);
  const eye = mm(Math.min(1550, room.heightMm - 200));
  const aim = (p: Point2): Vec3 => Math.hypot(p.x - centre.x, p.z - centre.z) < 1 ? [mm(centre.x + 100), eye, mm(centre.z)] : [mm(centre.x), eye, mm(centre.z)];
  return [{ id: 'still-1', kind: 'perspective', position: [mm(first.x), eye, mm(first.z)], target: aim(first), fov: 65 }, { id: 'still-2', kind: 'perspective', position: [mm(second.x), eye, mm(second.z)], target: aim(second), fov: 65 }, { id: 'panorama-1', kind: 'panorama', position: [mm(centre.x), eye, mm(centre.z)], target: [mm(centre.x), eye, mm(centre.z + 1000)], fov: 90 }];
}

function material(f: FinishAsset): CompiledMaterial {
  if (f.type === 'paint') return { id: f.id, type: f.type, colour: f.colour, roughness: f.sheen === 'matte' ? 0.92 : 0.66 };
  if (f.type === 'bauwerk') return { id: f.id, type: f.type, colour: f.colour, roughness: 0.98, seed: f.seed };
  return { id: f.id, type: f.type, colour: '#ffffff', roughness: 0.88, textureId: f.texture.id, repeat: f.type === 'wallpaper', texturePreparation: { crop: { ...f.calibration.crop }, rotation: f.calibration.rotation } };
}
function addQuad(meshes: CompiledMesh[], id: string, surface: CompiledMesh['surface'], materialId: string, points: Vec3[], normal: Vec3, uv: Pair[] = [[0, 0], [1, 0], [1, 1], [0, 1]], wallId?: string): void {
  if (meshes.length >= 30000) throw new Error('Room geometry is too complex. Reduce the number of openings or finish bands.');
  meshes.push({ id, surface, materialId, ...(wallId ? { wallId } : {}), positions: points.flat(), normals: Array(4).fill(normal).flat(), uvs: uv.flat(), indices: [...quadIndices] });
}
function unique(values: number[]): number[] { return [...new Set(values.map(v => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b); }
function isArtwork(f: FinishAsset | undefined): f is ArtworkFinish { return !!f && (f.type === 'wallpaper' || f.type === 'mural'); }

/** Meshes and UVs are the authority for all renderers. No renderer reapplies set-out. */
export function compileRoom(revision: RoomRevision): RenderPackage {
  if (!revision || typeof revision.id !== 'string' || !revision.id || revision.id.length > 200 || !revision.project || revision.projectId !== revision.project.id || !Number.isInteger(revision.number) || revision.number < 1 || revision.number !== revision.project.revision || typeof revision.createdAt !== 'string' || !Number.isFinite(Date.parse(revision.createdAt))) throw new Error('revision: Supply an identified snapshot with matching project ID and revision number.');
  const project = revision.project, issues = validateProject(project);
  if (issues.length) throw new Error(issues.map(i => `${i.path}: ${i.message}`).join('\n'));
  const room = project.room, meshes: CompiledMesh[] = [];
  const assignedIds = new Set(project.assignments.map(a => a.finishId));
  const usedFinishes = project.finishes.filter(f => assignedIds.has(f.id));
  const materials: CompiledMaterial[] = [
    { id: 'neutral-wall', type: 'neutral', colour: '#e9e4dc', roughness: 0.92 },
    { id: 'neutral-floor', type: 'neutral', colour: '#b4a18a', roughness: 0.78 },
    { id: 'neutral-ceiling', type: 'neutral', colour: '#f6f3ec', roughness: 0.98 },
    { id: 'neutral-trim', type: 'neutral', colour: '#f2eee5', roughness: 0.72 },
    { id: 'neutral-door', type: 'neutral', colour: '#d7d0c2', roughness: 0.7 },
    ...usedFinishes.map(material),
  ];
  const byId = new Map(project.finishes.map(f => [f.id, f]));
  const floorTriangles = triangulateRoom(room.vertices);
  meshes.push({ id: 'room-floor', surface: 'floor', materialId: 'neutral-floor', positions: room.vertices.flatMap(p => [mm(p.x), 0, mm(p.z)]), normals: room.vertices.flatMap(() => [0, 1, 0]), uvs: room.vertices.flatMap(p => [mm(p.x), mm(p.z)]), indices: floorTriangles.flatMap((v, i) => i % 3 === 0 ? [floorTriangles[i + 2], floorTriangles[i + 1], v] : []) });
  meshes.push({ id: 'room-ceiling', surface: 'ceiling', materialId: 'neutral-ceiling', positions: room.vertices.flatMap(p => [mm(p.x), mm(room.heightMm), mm(p.z)]), normals: room.vertices.flatMap(() => [0, -1, 0]), uvs: room.vertices.flatMap(p => [mm(p.x), mm(p.z)]), indices: [...floorTriangles] });
  room.vertices.forEach((a, wallIndex) => {
    const b = room.vertices[(wallIndex + 1) % room.vertices.length], length = wallLength(room, a.wallId), dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
    const inward: Vec3 = [-dz, 0, dx], outward: Vec3 = [dz, 0, -dx];
    const point = (s: number, y: number, inset = 0): Vec3 => [mm(a.x + dx * s - dz * inset), mm(y), mm(a.z + dz * s + dx * inset)];
    const openings = room.openings.filter(o => o.wallId === a.wallId), assignments = project.assignments.filter(v => v.wallId === a.wallId);
    // The inner survey line is authoritative. A wall with openings backs onto
    // its deepest supplied reveal; each opening keeps its own exact depth.
    const thickness = openings.length ? Math.max(...openings.map(o => o.revealMm)) : 120;
    const xCuts = [0, length, ...openings.flatMap(o => [o.offsetMm, o.offsetMm + o.widthMm])];
    const yCuts = [0, room.heightMm, room.skirtingMm, room.heightMm - room.corniceMm, ...openings.flatMap(o => [o.sillMm, o.sillMm + o.heightMm]), ...assignments.flatMap(v => [v.fromMm, v.toMm ?? room.heightMm])];
    assignments.forEach(assignment => {
      const f = byId.get(assignment.finishId);
      if (!isArtwork(f)) return;
      if (f.type === 'mural') {
        xCuts.push(Math.max(0, Math.min(length, assignment.offsetXmm)), Math.max(0, Math.min(length, assignment.offsetXmm + f.calibration.widthMm)));
        yCuts.push(Math.max(0, Math.min(room.heightMm, assignment.offsetYmm)), Math.max(0, Math.min(room.heightMm, assignment.offsetYmm + f.calibration.heightMm)));
      } else if (f.calibration.repeatKind === 'strip' && f.calibration.match === 'half-drop' && !f.calibration.offsetAlreadyIncluded) {
        const width = f.calibration.widthMm, start = Math.floor(-assignment.offsetXmm / width), end = Math.ceil((length - assignment.offsetXmm) / width);
        if (end - start > 512) throw new Error('This half-drop calibration produces more than 512 strips on one wall. Check its physical width.');
        for (let n = start; n <= end; n++) { const x = assignment.offsetXmm + n * width; if (x > 0 && x < length) xCuts.push(x); }
      }
    });
    const xx = unique(xCuts), yy = unique(yCuts);
    for (let i = 0; i < xx.length - 1; i++) for (let j = 0; j < yy.length - 1; j++) {
      const x0 = xx[i], x1 = xx[i + 1], y0 = yy[j], y1 = yy[j + 1], mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      if (x1 - x0 < EPS || y1 - y0 < EPS || openings.some(o => mx > o.offsetMm - EPS && mx < o.offsetMm + o.widthMm + EPS && my > o.sillMm - EPS && my < o.sillMm + o.heightMm + EPS)) continue;
      const assignment = assignments.find(v => my >= v.fromMm && my < (v.toMm ?? room.heightMm)), finish = assignment ? byId.get(assignment.finishId) : undefined;
      let materialId = finish?.id ?? 'neutral-wall';
      const uvAt = (x: number, y: number): Pair => {
        if (!isArtwork(finish) || !assignment) return [mm(x), mm(y)];
        const c = finish.calibration;
        const strip = Math.floor((mx - assignment.offsetXmm) / c.widthMm);
        const shift = finish.type === 'wallpaper' && c.repeatKind === 'strip' && c.match === 'half-drop' && !c.offsetAlreadyIncluded && ((strip % 2 + 2) % 2) === 1 ? c.heightMm / 2 : 0;
        return [(x - assignment.offsetXmm) / c.widthMm, (y - assignment.offsetYmm - shift) / c.heightMm];
      };
      if (finish?.type === 'mural' && assignment && (mx < assignment.offsetXmm || mx > assignment.offsetXmm + finish.calibration.widthMm || my < assignment.offsetYmm || my > assignment.offsetYmm + finish.calibration.heightMm)) materialId = 'neutral-wall';
      const cell = `${a.wallId}-${i}-${j}`;
      addQuad(meshes, `${cell}-inside`, 'wall', materialId, [point(x0, y0), point(x1, y0), point(x1, y1), point(x0, y1)], inward, [uvAt(x0, y0), uvAt(x1, y0), uvAt(x1, y1), uvAt(x0, y1)], a.wallId);
      if (thickness > 0) addQuad(meshes, `${cell}-outside`, 'wall', 'neutral-wall', [point(x1, y0, -thickness), point(x0, y0, -thickness), point(x0, y1, -thickness), point(x1, y1, -thickness)], outward, undefined, a.wallId);
      if (y1 <= room.skirtingMm + EPS || y0 >= room.heightMm - room.corniceMm - EPS) {
        const skirting = y1 <= room.skirtingMm + EPS, surface = skirting ? 'skirting' : 'cornice', inset = skirting ? 14 : 22;
        addQuad(meshes, `${cell}-${surface}`, surface, 'neutral-trim', [point(x0, y0, inset), point(x1, y0, inset), point(x1, y1, inset), point(x0, y1, inset)], inward, undefined, a.wallId);
        const edgeY = skirting ? y1 : y0;
        addQuad(meshes, `${cell}-${surface}-edge`, surface, 'neutral-trim', skirting ? [point(x0, edgeY), point(x0, edgeY, inset), point(x1, edgeY, inset), point(x1, edgeY)] : [point(x0, edgeY), point(x1, edgeY), point(x1, edgeY, inset), point(x0, edgeY, inset)], skirting ? [0, 1, 0] : [0, -1, 0], undefined, a.wallId);
      }
    }
    // Close the wall thickness and the opening reveals. UV is already baked above.
    if (thickness > 0) addQuad(meshes, `${a.wallId}-top`, 'reveal', 'neutral-wall', [point(0, room.heightMm), point(length, room.heightMm), point(length, room.heightMm, -thickness), point(0, room.heightMm, -thickness)], [0, 1, 0], undefined, a.wallId);
    openings.forEach(o => {
      const x0 = o.offsetMm, x1 = x0 + o.widthMm, y0 = o.sillMm, y1 = y0 + o.heightMm, depth = o.revealMm;
      if (depth > 0) {
        addQuad(meshes, `${o.id}-reveal-left`, 'reveal', 'neutral-trim', [point(x0, y0), point(x0, y0, -depth), point(x0, y1, -depth), point(x0, y1)], [dx, 0, dz], undefined, a.wallId);
        addQuad(meshes, `${o.id}-reveal-right`, 'reveal', 'neutral-trim', [point(x1, y1), point(x1, y1, -depth), point(x1, y0, -depth), point(x1, y0)], [-dx, 0, -dz], undefined, a.wallId);
        addQuad(meshes, `${o.id}-reveal-top`, 'reveal', 'neutral-trim', [point(x0, y1), point(x0, y1, -depth), point(x1, y1, -depth), point(x1, y1)], [0, -1, 0], undefined, a.wallId);
        if (y0 > 0) addQuad(meshes, `${o.id}-sill`, 'reveal', 'neutral-trim', [point(x0, y0), point(x1, y0), point(x1, y0, -depth), point(x0, y0, -depth)], [0, 1, 0], undefined, a.wallId);
        if (o.kind === 'door') addQuad(meshes, `${o.id}-threshold`, 'floor', 'neutral-floor', [point(x0, 0), point(x1, 0), point(x1, 0, -depth), point(x0, 0, -depth)], [0, 1, 0], undefined, a.wallId);
      }
      if (o.kind === 'door') addQuad(meshes, `${o.id}-door`, 'reveal', 'neutral-door', [point(x0, y0, -depth), point(x1, y0, -depth), point(x1, y1, -depth), point(x0, y1, -depth)], inward, undefined, a.wallId);
    });
  });
  if (meshes.length > 30000) throw new Error('Room geometry is too complex. Reduce the number of openings or finish bands.');
  const textures = new Map<string, ArtworkFinish['texture']>();
  usedFinishes.filter(isArtwork).forEach(f => textures.set(f.texture.id, structuredClone(f.texture)));
  return { schemaVersion: 1, compilerVersion: COMPILER_VERSION, revisionId: revision.id, projectId: project.id, units: 'metres', meshes, materials, textures: [...textures.values()], cameras: project.cameras.length ? structuredClone(project.cameras) : suggestCameras(room), lighting: project.lighting, outputs: { stills: [1920, 1080], panorama: [4096, 2048] } };
}
