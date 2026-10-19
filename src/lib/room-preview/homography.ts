/**
 * Plane-to-plane mapping for the room preview: the wall is a real rectangle in
 * millimetres and a four-cornered shape in the photograph. A homography maps one
 * to the other. Pure functions, so the maths is tested in Node.
 */
export type Point = [number, number];
/** Row-major 3 × 3 matrix. */
export type Matrix3 = [number, number, number, number, number, number, number, number, number];

function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const pivot = M[c][c];
    if (Math.abs(pivot) < 1e-12) throw new Error('The four corners do not make a wall: two of them coincide or three are in a line.');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / pivot;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** The homography H with H·src[i] ≈ dst[i] for four point pairs (direct linear transform, h33 = 1). */
export function solveHomography(src: Point[], dst: Point[]): Matrix3 {
  if (src.length !== 4 || dst.length !== 4) throw new Error('Four corners are needed.');
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinear(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function applyHomography(H: Matrix3, [x, y]: Point): Point {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

export function invert3(m: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error('The wall shape cannot be mapped.');
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det) as Matrix3;
}

/** Wall millimetres → photo pixels, and the inverse, for a wall of widthMm × heightMm whose corners sit at `corners` (TL, TR, BR, BL). */
export function wallMapping(corners: Point[], widthMm: number, heightMm: number): { toPhoto: Matrix3; toWall: Matrix3 } {
  const toPhoto = solveHomography([[0, 0], [widthMm, 0], [widthMm, heightMm], [0, heightMm]], corners);
  return { toPhoto, toWall: invert3(toPhoto) };
}

/** Signed area of the corner polygon: positive when the corners run clockwise on screen, the order the handles keep. */
export function polygonArea(corners: Point[]): number {
  let area = 0;
  for (let i = 0; i < corners.length; i++) {
    const [x1, y1] = corners[i];
    const [x2, y2] = corners[(i + 1) % corners.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

/**
 * Four corners from a wall mask: the extreme points of the masked area (top-left is the
 * pixel with the smallest x + y, and so on). A seed for the handles, not a measurement.
 * `mask` is one byte per pixel, non-zero where the wall is.
 */
export function cornersFromMask(mask: Uint8Array | Uint8ClampedArray, width: number, height: number, minCoverage = 0.02): Point[] | null {
  let tl: Point | null = null;
  let tr: Point | null = null;
  let br: Point | null = null;
  let bl: Point | null = null;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      n++;
      const s = x + y;
      const d = x - y;
      if (!tl || s < tl[0] + tl[1]) tl = [x, y];
      if (!br || s > br[0] + br[1]) br = [x, y];
      if (!tr || d > tr[0] - tr[1]) tr = [x, y];
      if (!bl || d < bl[0] - bl[1]) bl = [x, y];
    }
  }
  if (n < width * height * minCoverage || !tl || !tr || !br || !bl) return null;
  return [tl, tr, br, bl];
}
