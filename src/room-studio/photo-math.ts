import { artworkUVAt } from './finishes.ts';
import type { FinishAsset } from './types.ts';
import type { PhotoPoint, PhotoQuad, PhotoSurface } from './photo-types.ts';

export const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
export function quadError(q: PhotoQuad): string | null {
  if (q.length !== 4 || q.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return 'Keep all four corners inside the photograph.';
  const crosses = q.map((a, i) => { const b = q[(i + 1) % 4], c = q[(i + 2) % 4]; return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); });
  if (crosses.some(c => c <= .00001)) return 'Use clockwise corners: top left, top right, bottom right, bottom left. Edges cannot cross.';
  const area = Math.abs(q.reduce((sum, p, i) => { const next = q[(i + 1) % 4]; return sum + p.x * next.y - next.x * p.y; }, 0)) / 2;
  return area < .001 ? 'Make this wall larger before applying a finish.' : null;
}

/** Eight-equation homography; maps photograph positions to wall UV coordinates. */
export function inversePhotoHomography(q: PhotoQuad): number[] {
  const error = quadError(q); if (error) throw new Error(error);
  const target = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const rows: number[][] = [];
  q.forEach((p, i) => { const [u, v] = target[i]; rows.push([p.x, p.y, 1, 0, 0, 0, -u * p.x, -u * p.y, u]); rows.push([0, 0, 0, p.x, p.y, 1, -v * p.x, -v * p.y, v]); });
  for (let c = 0; c < 8; c++) {
    let pivot = c; for (let r = c + 1; r < 8; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[pivot][c])) pivot = r;
    if (Math.abs(rows[pivot][c]) < 1e-12) throw new Error('These corners cannot form a perspective wall.');
    [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
    const n = rows[c][c]; for (let k = c; k < 9; k++) rows[c][k] /= n;
    for (let r = 0; r < 8; r++) if (r !== c) { const f = rows[r][c]; for (let k = c; k < 9; k++) rows[r][k] -= f * rows[c][k]; }
  }
  return [...rows.map(r => r[8]), 1];
}
export function photoWallPoint(h: number[], p: PhotoPoint): PhotoPoint {
  const d = h[6] * p.x + h[7] * p.y + 1;
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / d, y: (h[3] * p.x + h[4] * p.y + h[5]) / d };
}
export function photoExportSize(width: number, height: number, maxEdge = 4096) {
  if (![width, height].every(v => Number.isInteger(v) && v > 0)) throw new Error('Invalid photograph dimensions.');
  if (!Number.isFinite(maxEdge) || maxEdge < 1) throw new Error('Invalid photo output limit.');
  const scale = Math.min(1, Math.min(4096, Math.floor(maxEdge)) / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function isPhysicalPhotoScale(surface: PhotoSurface, finish?: FinishAsset): boolean {
  return Boolean(surface.widthMm && surface.heightMm && surface.scale === 1 && finish && (finish.type === 'wallpaper' || finish.type === 'mural') && finish.calibration.proofAccepted);
}
/** Uses precisely the same strip/half-drop coordinate function as measured 3D. */
export function photoArtworkUV(surface: PhotoSurface, finish: Extract<FinishAsset, { type: 'wallpaper' | 'mural' }>, u: number, v: number) {
  const width = surface.widthMm || 3000, height = surface.heightMm || 2400;
  return artworkUVAt(u * width / surface.scale, (1 - v) * height / surface.scale, finish.calibration, surface.offsetXmm, surface.offsetYmm);
}
export function photoSourceDetailWarning(surface: PhotoSurface, finish: FinishAsset | undefined, outputWidth: number, outputHeight: number): string | null {
  if (!finish || (finish.type !== 'wallpaper' && finish.type !== 'mural')) return null;
  const edge = (a: PhotoPoint, b: PhotoPoint) => Math.hypot((b.x - a.x) * outputWidth, (b.y - a.y) * outputHeight);
  const wallWidthPx = Math.max(edge(surface.corners[0], surface.corners[1]), edge(surface.corners[3], surface.corners[2])), wallHeightPx = Math.max(edge(surface.corners[0], surface.corners[3]), edge(surface.corners[1], surface.corners[2]));
  const sources = finish.panels?.length ? finish.panels.map(p => ({ widthPx: p.texture.widthPx, heightPx: p.texture.heightPx, widthMm: p.widthMm, heightMm: p.heightMm })) : [{ widthPx: finish.texture.widthPx * finish.calibration.crop.width, heightPx: finish.texture.heightPx * finish.calibration.crop.height, widthMm: finish.calibration.widthMm, heightMm: finish.calibration.heightMm }].map(p => finish.calibration.rotation % 180 ? { ...p, widthPx: p.heightPx, heightPx: p.widthPx } : p);
  return sources.some(p => p.widthPx < wallWidthPx * p.widthMm * surface.scale / (surface.widthMm || 3000) || p.heightPx < wallHeightPx * p.heightMm * surface.scale / (surface.heightMm || 2400)) ? 'Artwork detail warning: this placement needs more pixels than the source provides in at least one direction. The exported pattern may look soft. Upload a larger original or reduce its displayed scale.' : null;
}
