import type { ArtworkCalibration, ArtworkFinish, FinishAsset, RoomProject, TextureAsset, WallFinishAssignment } from './types.ts';
import { ROOM_LIMITS, TEXTURE_LIMITS } from './validation.ts';

export const MAX_ARTWORK_BYTES = 20 * 1024 * 1024;
export const MAX_ARTWORK_EDGE = TEXTURE_LIMITS.maxEdge;
export const MAX_ARTWORK_PIXELS = TEXTURE_LIMITS.maxPixels;
export const ARTWORK_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const normaliseHex = (value: string): string | null => /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : null;

export function calibrationErrors(calibration: ArtworkCalibration): string[] {
  const errors: string[] = [];
  if (![calibration.widthMm, calibration.heightMm].every(value => Number.isInteger(value) && value > 0 && value <= ROOM_LIMITS.maxDimensionMm)) errors.push('Enter the real width and height as whole millimetres, up to 30,000 mm.');
  const { x, y, width, height } = calibration.crop;
  if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001) errors.push('The crop must stay inside the uploaded image.');
  if (![0, 90, 180, 270].includes(calibration.rotation)) errors.push('Choose a quarter-turn orientation.');
  if (!['tile', 'strip'].includes(calibration.repeatKind) || !['straight', 'half-drop'].includes(calibration.match)) errors.push('Choose the repeat layout.');
  if (calibration.repeatKind === 'tile' && calibration.match === 'half-drop' && !calibration.offsetAlreadyIncluded) errors.push('For half-drop, use a single strip or confirm that the complete tile already includes the stagger.');
  return errors;
}

export function rotatedCropSize(widthPx: number, heightPx: number, calibration: Pick<ArtworkCalibration, 'crop' | 'rotation'>) {
  const width = Math.max(1, Math.round(widthPx * calibration.crop.width));
  const height = Math.max(1, Math.round(heightPx * calibration.crop.height));
  return calibration.rotation % 180 ? { width: height, height: width } : { width, height };
}

/** Mural sizing follows the prepared crop, with only whole-mm rounding. */
export function proportionalMuralCalibration(texture: Pick<TextureAsset, 'widthPx' | 'heightPx'>, current: ArtworkCalibration, patch: Partial<ArtworkCalibration> = {}): ArtworkCalibration {
  const next = { ...current, ...patch, proofAccepted: false };
  const size = rotatedCropSize(texture.widthPx, texture.heightPx, next);
  if (![size.width, size.height, next.widthMm, next.heightMm].every(Number.isFinite)) return next;
  if (patch.heightMm !== undefined && patch.widthMm === undefined) next.widthMm = Math.round(next.heightMm * size.width / size.height);
  else {
    if (patch.rotation !== undefined && patch.rotation % 180 !== current.rotation % 180) next.widthMm = current.heightMm;
    next.heightMm = Math.round(next.widthMm * size.height / size.width);
  }
  return next;
}

/** Millimetres added to the vertical texture origin for alternate strips. Full
 * tiles containing the stagger already must never receive a second offset. */
export function halfDropOffset(stripIndex: number, calibration: ArtworkCalibration): number {
  return calibration.repeatKind === 'strip' && calibration.match === 'half-drop' && !calibration.offsetAlreadyIncluded && Math.abs(stripIndex % 2) === 1 ? calibration.heightMm / 2 : 0;
}

export function artworkUVAt(xMm: number, yMm: number, calibration: ArtworkCalibration, offsetXmm = 0, offsetYmm = 0) {
  const x = xMm - offsetXmm;
  const strip = Math.floor(x / calibration.widthMm);
  return { u: x / calibration.widthMm, v: (yMm - offsetYmm - halfDropOffset(strip, calibration)) / calibration.heightMm };
}

/** Replace only the requested vertical band. Existing adjacent bands survive. */
export function assignFinishBand(project: RoomProject, assignment: WallFinishAssignment): RoomProject {
  if (!project.room.vertices.some(vertex => vertex.wallId === assignment.wallId)) throw new Error('Select a wall first.');
  if (!project.finishes.some(finish => finish.id === assignment.finishId)) throw new Error('Select a saved finish.');
  const start = assignment.fromMm;
  const end = assignment.toMm ?? project.room.heightMm;
  if (![start, end, assignment.offsetXmm, assignment.offsetYmm].every(Number.isInteger) || start < 0 || end > project.room.heightMm || end <= start) throw new Error('The finish band must fit between the floor and ceiling, in whole millimetres.');
  if (Math.abs(assignment.offsetXmm) > 60000 || Math.abs(assignment.offsetYmm) > 60000) throw new Error('Keep artwork offsets within 60,000 mm.');
  const assignments = project.assignments.flatMap(existing => {
    const existingEnd = existing.toMm ?? project.room.heightMm;
    if (existing.wallId !== assignment.wallId || existingEnd <= start || existing.fromMm >= end) return [existing];
    const pieces: WallFinishAssignment[] = [];
    // A band may be split repeatedly. Ancestry in its identifier would grow
    // beyond the document's 100-character limit after just a few edits.
    if (existing.fromMm < start) pieces.push({ ...existing, id: crypto.randomUUID(), toMm: start });
    if (existingEnd > end) pieces.push({ ...existing, id: crypto.randomUUID(), fromMm: end });
    return pieces;
  });
  return { ...project, assignments: [...assignments, { ...assignment }] };
}

export function saveFinish(project: RoomProject, finish: FinishAsset): RoomProject {
  if (!project.finishes.some(existing => existing.id === finish.id) && project.finishes.length >= 48) throw new Error('This room has 48 saved finishes. Remove an unused finish before adding another.');
  return { ...project, finishes: [...project.finishes.filter(existing => existing.id !== finish.id), finish] };
}

export function detectArtworkMime(bytes: Uint8Array): TextureAsset['mime'] | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

/** Read dimensions before invoking a browser decoder, so a highly compressed
 * image cannot bypass the graphics-memory limit merely by being a small file. */
export function artworkHeaderDimensions(bytes: Uint8Array, mime: TextureAsset['mime']): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png' && bytes.length >= 24) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (mime === 'image/jpeg') {
    let offset = 2;
    const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) return null;
      if (marker === 0xd8 || marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > bytes.length) return null;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) return null;
      if (sof.has(marker) && length >= 7) return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      offset += length;
    }
  }
  if (mime === 'image/webp') {
    const uint24 = (offset: number) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const chunk = String.fromCharCode(...bytes.slice(offset, offset + 4));
      const size = view.getUint32(offset + 4, true), start = offset + 8;
      if (size > bytes.length - start) return null;
      if (chunk === 'VP8X' && size >= 10) return { width: uint24(start + 4) + 1, height: uint24(start + 7) + 1 };
      if (chunk === 'VP8L' && size >= 5 && bytes[start] === 0x2f) { const bits = view.getUint32(start + 1, true); return { width: (bits & 0x3fff) + 1, height: (bits >>> 14 & 0x3fff) + 1 }; }
      if (chunk === 'VP8 ' && size >= 10 && bytes[start + 3] === 0x9d && bytes[start + 4] === 1 && bytes[start + 5] === 0x2a) return { width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff };
      offset = start + size + size % 2;
    }
  }
  return null;
}

export function artworkIsAnimated(bytes: Uint8Array, mime: TextureAsset['mime']): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png') {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = view.getUint32(offset), type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') return true;
      if (size > bytes.length - offset - 12) return false;
      offset += 12 + size;
    }
  }
  if (mime === 'image/webp') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = String.fromCharCode(...bytes.slice(offset, offset + 4)), size = view.getUint32(offset + 4, true), start = offset + 8;
      if (type === 'ANIM' || type === 'ANMF' || type === 'VP8X' && size >= 1 && start < bytes.length && (bytes[start] & 2) !== 0) return true;
      if (size > bytes.length - start) return false;
      offset = start + size + size % 2;
    }
  }
  return false;
}

export function checkArtworkDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_ARTWORK_EDGE || height > MAX_ARTWORK_EDGE || width * height > MAX_ARTWORK_PIXELS) throw new Error('Export the image at no more than 8,192 px per side and 25 megapixels before uploading.');
}

/** Local recovery drafts may be invalid. Never turn their metadata into a
 * remote request, active document or unbounded browser decode. */
export function checkEmbeddedArtwork(texture: TextureAsset): void {
  const value = texture.dataUrl;
  const prefix = `data:${texture.mime};base64,`;
  if (!value || !(ARTWORK_MIMES as readonly string[]).includes(texture.mime) || value.length > Math.ceil(MAX_ARTWORK_BYTES / 3) * 4 + 40 || !value.startsWith(prefix) || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.slice(prefix.length))) throw new Error('Reattach the original PNG, JPEG or WebP artwork. Remote image links are not opened.');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(value.slice(prefix.length)), character => character.charCodeAt(0)); }
  catch { throw new Error('Reattach the original artwork; its embedded image is damaged.'); }
  if (bytes.length > MAX_ARTWORK_BYTES || detectArtworkMime(bytes) !== texture.mime) throw new Error('Reattach the original PNG, JPEG or WebP artwork.');
  if (artworkIsAnimated(bytes, texture.mime)) throw new Error('Use a still PNG, JPEG or WebP image. Animated artwork cannot be used for a fixed room proof.');
  const dimensions = artworkHeaderDimensions(bytes, texture.mime);
  if (!dimensions) throw new Error('Reattach a complete PNG, JPEG or WebP image.');
  checkArtworkDimensions(dimensions.width, dimensions.height);
  if (texture.mime === 'image/png' && texture.widthPx > 0 && (dimensions.width !== texture.widthPx || dimensions.height !== texture.heightPx)) throw new Error('Artwork dimensions do not match the original image. Reattach it before calibrating.');
}

export function loadTextureImage(texture: TextureAsset): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!texture.dataUrl) { reject(new Error('Reattach the original artwork to edit its crop.')); return; }
    checkEmbeddedArtwork(texture);
    const image = new Image();
    image.onload = () => {
      if (texture.widthPx > 0 && (image.naturalWidth !== texture.widthPx || image.naturalHeight !== texture.heightPx)) { reject(new Error('Artwork dimensions do not match the original image. Reattach it before calibrating.')); return; }
      resolve(image);
    };
    image.onerror = () => reject(new Error('This image could not be decoded. Try a PNG, JPEG or WebP export.'));
    image.src = texture.dataUrl;
  });
}

export async function readArtworkFile(file: File): Promise<TextureAsset> {
  if (file.size <= 0 || file.size > MAX_ARTWORK_BYTES) throw new Error('Choose a PNG, JPEG or WebP image up to 20 MB.');
  const buffer = await file.arrayBuffer();
  const mime = detectArtworkMime(new Uint8Array(buffer));
  if (!mime) throw new Error('Only PNG, JPEG and WebP image contents are accepted. SVG is not supported.');
  if (artworkIsAnimated(new Uint8Array(buffer), mime)) throw new Error('Use a still PNG, JPEG or WebP image. Animated artwork cannot be used for a fixed room proof.');
  const dimensions = artworkHeaderDimensions(new Uint8Array(buffer), mime);
  if (dimensions) checkArtworkDimensions(dimensions.width, dimensions.height);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('The file could not be read.')); reader.readAsDataURL(new Blob([buffer], { type: mime }));
  });
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(value => value.toString(16).padStart(2, '0')).join('');
  const texture: TextureAsset = { id: `texture-${sha256.slice(0, 20)}`, sha256, mime, widthPx: 0, heightPx: 0, dataUrl };
  const image = await loadTextureImage(texture);
  checkArtworkDimensions(image.naturalWidth, image.naturalHeight);
  return { ...texture, widthPx: image.naturalWidth, heightPx: image.naturalHeight };
}

/** Crop in source coordinates, then rotate clockwise. Used by proof and scene;
 * half-drop belongs to wall UVs and must not be baked here. */
export async function prepareArtworkCanvas(texture: TextureAsset, calibration: Pick<ArtworkCalibration, 'crop' | 'rotation'>, maxEdge = 4096): Promise<HTMLCanvasElement> {
  if (!Number.isInteger(maxEdge) || maxEdge < 128 || maxEdge > MAX_ARTWORK_EDGE) throw new Error('Choose a prepared texture edge from 128 to 8,192 pixels.');
  const errors = calibrationErrors({ widthMm: 1, heightMm: 1, repeatKind: 'tile', match: 'straight', offsetAlreadyIncluded: false, proofAccepted: false, ...calibration });
  if (errors.length) throw new Error(errors[0]);
  const image = await loadTextureImage(texture);
  const size = rotatedCropSize(texture.widthPx, texture.heightPx, calibration);
  const scale = Math.min(1, maxEdge / Math.max(size.width, size.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(size.width * scale)); canvas.height = Math.max(1, Math.round(size.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image preparation is unavailable in this browser.');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(calibration.rotation * Math.PI / 180);
  const w = calibration.rotation % 180 ? canvas.height : canvas.width;
  const h = calibration.rotation % 180 ? canvas.width : canvas.height;
  context.drawImage(image, calibration.crop.x * image.naturalWidth, calibration.crop.y * image.naturalHeight, calibration.crop.width * image.naturalWidth, calibration.crop.height * image.naturalHeight, -w / 2, -h / 2, w, h);
  return canvas;
}

export async function artworkProofDataUrl(finish: ArtworkFinish): Promise<string> {
  const tile = await prepareArtworkCanvas(finish.texture, finish.calibration, 1024);
  const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 420;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Preview is unavailable.');
  context.fillStyle = '#eee9dd'; context.fillRect(0, 0, 720, 420);
  if (finish.type === 'mural') {
    const ratio = Math.min(720 / tile.width, 420 / tile.height);
    context.drawImage(tile, (720 - tile.width * ratio) / 2, (420 - tile.height * ratio) / 2, tile.width * ratio, tile.height * ratio);
  } else {
    const w = 180; const h = Math.max(30, Math.min(1600, w * finish.calibration.heightMm / finish.calibration.widthMm));
    for (let column = 0; column < 4; column++) {
      const stagger = halfDropOffset(column, finish.calibration) / finish.calibration.heightMm * h;
      for (let y = -h; y < 420 + h; y += h) context.drawImage(tile, column * w, y + stagger, w, h);
    }
    context.strokeStyle = 'rgba(25,30,24,.25)'; context.setLineDash([4, 4]);
    for (let column = 1; column < 4; column++) { context.beginPath(); context.moveTo(column * w, 0); context.lineTo(column * w, 420); context.stroke(); }
  }
  return canvas.toDataURL('image/webp', .85);
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295;
}
function noise(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => hash2((a % periodX + periodX) % periodX, (b % periodY + periodY) % periodY, seed);
  const a = h(ix, iy) * (1 - fx) + h(ix + 1, iy) * fx;
  const b = h(ix, iy + 1) * (1 - fx) + h(ix + 1, iy + 1) * fx;
  return a * (1 - fy) + b * fy;
}

/** Original deterministic illustrative limewash; no manufacturer's photographs
 * or measured material maps are embedded. Same bytes may be baked for export. */
export function createLimewashPixels(colour: string, seed: number, size = 256): Uint8ClampedArray<ArrayBuffer> {
  const hex = normaliseHex(colour); if (!hex) throw new Error('Invalid paint colour.');
  if (!Number.isInteger(size) || size < 2 || size > 2048) throw new Error('Invalid texture size.');
  const base = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const cloud = noise(u * 7, v * 7, seed, 7, 7) - .5;
    const brush = (noise((u + v) * 16, (u - v) * 4, seed + 17, 16, 4) + noise((u - v) * 16, (u + v) * 4, seed + 41, 16, 4)) / 2 - .5;
    const grain = hash2(x, y, seed + 31) - .5;
    const shift = cloud * 15 + brush * 5 + grain * 1.2;
    const i = (y * size + x) * 4;
    for (let channel = 0; channel < 3; channel++) pixels[i + channel] = Math.max(0, Math.min(255, Math.round(base[channel] + shift)));
    pixels[i + 3] = 255;
  }
  return pixels;
}

export function createLimewashCanvas(colour: string, seed: number, size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Texture preparation unavailable.');
  context.putImageData(new ImageData(createLimewashPixels(colour, seed, size), size, size), 0, 0); return canvas;
}
