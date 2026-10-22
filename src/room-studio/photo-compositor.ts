import { checkEmbeddedArtwork, createLimewashCanvas, loadTextureImage, prepareArtworkCanvas, readArtworkFile } from './finishes.ts';
import { clamp, inversePhotoHomography, photoArtworkUV, photoExportSize, photoWallPoint, quadError } from './photo-math.ts';
import type { FinishAsset, TextureAsset } from './types.ts';
import type { PhotoProject, PhotoSurface } from './photo-types.ts';
import { orderedPanels } from './wall-runs.ts';

/** Image decoding applies EXIF orientation. Re-encoding canvas pixels removes
 * camera/location metadata; no original source metadata enters the project. */
export async function readRoomPhoto(file: File): Promise<TextureAsset> {
  const original = await readArtworkFile(file), image = await loadTextureImage(original);
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Photo preparation is unavailable in this browser.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('This photograph could not be prepared.')), 'image/jpeg', .95));
  return readArtworkFile(new File([blob], 'room-photo.jpg', { type: 'image/jpeg' }));
}

export interface PixelImage { width: number; height: number; data: Uint8ClampedArray; }
function sample(image: PixelImage, x: number, y: number, repeat: boolean): number[] {
  const wrap = (n: number, limit: number) => repeat ? (n % limit + limit) % limit : clamp(n, 0, limit - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const result = [0, 0, 0, 0];
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy), index = (wrap(y0 + dy, image.height) * image.width + wrap(x0 + dx, image.width)) * 4;
    for (let c = 0; c < 4; c++) result[c] += image.data[index + c] * weight;
  }
  return result;
}
export function photoPixelColour(surface: PhotoSurface, finish: FinishAsset, wallU: number, wallV: number, texture?: PixelImage, panelTextures?: Map<string, PixelImage>): number[] | null {
  if (finish.type === 'paint') return [...[1, 3, 5].map(offset => parseInt(finish.colour.slice(offset, offset + 2), 16)), 255];
  if (finish.type === 'mural' && finish.panels?.length) {
    const x = wallU * (surface.widthMm || 3000) / surface.scale - surface.offsetXmm, y = (1 - wallV) * (surface.heightMm || 2400) / surface.scale - surface.offsetYmm;
    const entry = orderedPanels(finish).find(p => x >= p.startMm && x < p.endMm), image = entry && panelTextures?.get(entry.panel.id);
    if (!entry || !image || y < 0 || y > entry.panel.heightMm) return null;
    return sample(image, (x - entry.startMm) / entry.panel.widthMm * image.width - .5, (1 - y / entry.panel.heightMm) * image.height - .5, false);
  }
  if (!texture) return null;
  if (finish.type === 'bauwerk') return sample(texture, wallU * (surface.widthMm || 3000) / 1000 * texture.width, wallV * (surface.heightMm || 2400) / 1000 * texture.height, true);
  const uv = photoArtworkUV(surface, finish, wallU, wallV);
  if (finish.type === 'mural' && (uv.u < 0 || uv.u > 1 || uv.v < 0 || uv.v > 1)) return null;
  return sample(texture, uv.u * texture.width - .5, (1 - uv.v) * texture.height - .5, finish.type === 'wallpaper');
}

/** Exact same compositing kernel for on-screen preview and downloaded PNG.
 * Mask zero leaves the photograph's original decoded pixel untouched. */
export function photoShadingField(base: PixelImage, mask: Uint8ClampedArray): PixelImage {
  const cell = Math.max(4, Math.ceil(Math.min(base.width, base.height) / 32)), width = Math.ceil(base.width / cell), height = Math.ceil(base.height / cell);
  const sums = new Float64Array(width * height), counts = new Uint32Array(width * height); let total = 0, count = 0;
  for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) { const i = (y * base.width + x) * 4; if (!mask[i + 3]) continue; const luminance = .2126 * base.data[i] + .7152 * base.data[i + 1] + .0722 * base.data[i + 2], k = Math.floor(y / cell) * width + Math.floor(x / cell); sums[k] += luminance; counts[k]++; total += luminance; count++; }
  const average = count ? total / count : 160, data = new Uint8ClampedArray(width * height * 4);
  for (let k = 0; k < sums.length; k++) { const luminance = counts[k] ? sums[k] / counts[k] : average; data[k * 4] = data[k * 4 + 1] = data[k * 4 + 2] = luminance; data[k * 4 + 3] = 255; }
  return { width, height, data };
}
export async function compositePhotoSurface(base: PixelImage, output: PixelImage, mask: Uint8ClampedArray, surface: PhotoSurface, finish: FinishAsset, texture?: PixelImage, signal?: AbortSignal, panelTextures?: Map<string, PixelImage>): Promise<void> {
  if (base.width !== output.width || base.height !== output.height || mask.length !== base.data.length) throw new Error('Photo and mask dimensions must match.');
  const h = inversePhotoHomography(surface.corners), w = base.width, height = base.height;
  const left = Math.max(0, Math.floor(Math.min(...surface.corners.map(p => p.x)) * w)), right = Math.min(w, Math.ceil(Math.max(...surface.corners.map(p => p.x)) * w));
  const top = Math.max(0, Math.floor(Math.min(...surface.corners.map(p => p.y)) * height)), bottom = Math.min(height, Math.ceil(Math.max(...surface.corners.map(p => p.y)) * height));
  let total = 0, count = 0;
  for (let y = top; y < bottom; y += 6) for (let x = left; x < right; x += 6) { const i = (y * w + x) * 4; if (mask[i + 3] > 128) { total += .2126 * base.data[i] + .7152 * base.data[i + 1] + .0722 * base.data[i + 2]; count++; } }
  const average = Math.max(25, count ? total / count : 160);
  // A low-frequency luminance field retains broad light variation while
  // suppressing the photograph's existing wallpaper/paint texture.
  const shading = surface.shading ? photoShadingField(base, mask) : null;
  for (let y = top; y < bottom; y++) {
    if (signal?.aborted) throw new DOMException('Photo preview superseded', 'AbortError');
    for (let x = left; x < right; x++) {
      const i = (y * w + x) * 4, alpha = mask[i + 3] / 255; if (!alpha) continue;
      const uv = photoWallPoint(h, { x: (x + .5) / w, y: (y + .5) / height });
      if (uv.x < 0 || uv.y < 0 || uv.x > 1 || uv.y > 1) continue;
      const colour = photoPixelColour(surface, finish, uv.x, uv.y, texture, panelTextures); if (!colour) continue;
      const luminance = shading ? sample(shading, (x + .5) / w * shading.width - .5, (y + .5) / height * shading.height - .5, false)[0] : average;
      const gain = 1 + (clamp(luminance / average, .55, 1.4) - 1) * clamp(surface.shading, 0, 1), mix = alpha * colour[3] / 255;
      for (let c = 0; c < 3; c++) output.data[i + c] = Math.round(output.data[i + c] * (1 - mix) + clamp(colour[c] * gain, 0, 255) * mix);
    }
    if ((y - top) % 64 === 63) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
}

function canvasPixels(canvas: HTMLCanvasElement): PixelImage {
  const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Photo compositing is unavailable.');
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
export function photoSurfaceMask(surface: PhotoSurface, width: number, height: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Photo masking is unavailable.');
  ctx.beginPath(); surface.corners.forEach((p, i) => i ? ctx.lineTo(p.x * width, p.y * height) : ctx.moveTo(p.x * width, p.y * height)); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
  for (const stroke of surface.strokes) {
    ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over'; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = stroke.radius * Math.min(width, height) * 2;
    if (!stroke.points.length) continue;
    ctx.beginPath(); stroke.points.forEach((p, i) => i ? ctx.lineTo(p.x * width, p.y * height) : ctx.moveTo(p.x * width, p.y * height)); ctx.stroke();
    if (stroke.points.length === 1) { ctx.beginPath(); ctx.arc(stroke.points[0].x * width, stroke.points[0].y * height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
  }
  return canvasPixels(canvas).data;
}

export async function renderPhotoComposite(project: PhotoProject, options: { maxEdge?: number; original?: boolean; signal?: AbortSignal } = {}): Promise<HTMLCanvasElement> {
  checkEmbeddedArtwork(project.source);
  const image = await loadTextureImage(project.source), size = photoExportSize(image.naturalWidth, image.naturalHeight, options.maxEdge ?? 4096);
  const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Photo compositing is unavailable.');
  context.drawImage(image, 0, 0, size.width, size.height);
  if (options.original) return canvas;
  const base = canvasPixels(canvas), output = new ImageData(new Uint8ClampedArray(base.data), size.width, size.height);
  const textures = new Map<string, PixelImage>();
  for (const surface of project.surfaces) {
    const finish = project.finishes.find(f => f.id === surface.finishId); if (!finish || quadError(surface.corners)) continue;
    let texture = textures.get(finish.id);
    const panelTextures = new Map<string, PixelImage>();
    if (finish.type === 'mural' && finish.panels?.length) for (const panel of finish.panels) {
      let pixels = textures.get(panel.texture.id); if (!pixels) { pixels = canvasPixels(await prepareArtworkCanvas(panel.texture, { crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0 }, Math.min(4096, Math.max(1024, options.maxEdge || 4096)))); textures.set(panel.texture.id, pixels); } panelTextures.set(panel.id, pixels);
    }
    else if (!texture && (finish.type === 'wallpaper' || finish.type === 'mural')) texture = canvasPixels(await prepareArtworkCanvas(finish.texture, finish.calibration, Math.min(4096, Math.max(1024, options.maxEdge || 4096))));
    if (!texture && finish.type === 'bauwerk') texture = canvasPixels(createLimewashCanvas(finish.colour, finish.seed));
    if (texture) textures.set(finish.id, texture);
    await compositePhotoSurface(base, output, photoSurfaceMask(surface, size.width, size.height), surface, finish, texture, options.signal, panelTextures);
  }
  context.putImageData(output, 0, 0); return canvas;
}

export function photoPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The PNG could not be exported.')), 'image/png'));
}
