/**
 * Room preview renderer. Lays a wallpaper tile over one wall of a photograph at true
 * scale: the wall's four corners and its real size give a homography from photo pixels
 * to millimetres, the tile repeats in millimetres (roll width × repeat, straight or
 * half-drop) and the photograph's own light and shade are kept by scaling the pattern
 * with the wall's relative luminance. WebGL2 when available, otherwise a CPU loop at
 * the same maths. No dependencies; everything stays on the device.
 */
import { type Matrix3, type Point, wallMapping } from './homography';

type Bitmap = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

const VERT = `#version 300 es
in vec2 aUv; out vec2 vUv;
void main(){ vUv = aUv; gl_Position = vec4(aUv.x * 2.0 - 1.0, 1.0 - aUv.y * 2.0, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPhoto, uPattern, uMask;
uniform mat3 uToWall;        // photo px -> wall mm (column-major)
uniform vec2 uPhotoSize;     // px
uniform vec2 uTileMm;        // what the image covers: width, height
uniform vec2 uDropMm;        // roll width, vertical repeat (the half-drop pitch)
uniform vec2 uOffsetMm;      // horizontal / vertical pattern shift
uniform float uHalfDrop;     // 1.0 for a half-drop match
uniform float uLightStrength;
uniform float uBaseLum;      // mean luminance of the bare wall
in vec2 vUv; out vec4 outColor;
void main(){
  vec4 photo = texture(uPhoto, vUv);
  float m = texture(uMask, vUv).a;
  if (m <= 0.002) { outColor = photo; return; }
  vec3 p = uToWall * vec3(vUv * uPhotoSize, 1.0);
  vec2 mm = p.xy / p.z + uOffsetMm;
  float col = floor(mm.x / uDropMm.x);
  float yShift = uHalfDrop * mod(col, 2.0) * uDropMm.y * 0.5;
  vec2 tuv = vec2(mm.x / uTileMm.x, (mm.y + yShift) / uTileMm.y);
  vec4 pat = texture(uPattern, tuv);
  float lum = dot(photo.rgb, vec3(0.299, 0.587, 0.114));
  float shade = clamp(lum / max(uBaseLum, 0.05), 0.0, 1.7);
  vec3 lit = pat.rgb * mix(1.0, shade, uLightStrength);
  outColor = vec4(mix(photo.rgb, lit, m), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('No shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader failed');
  return shader;
}

const sizeOf = (image: Bitmap) => ({ width: (image as HTMLImageElement).naturalWidth || image.width, height: (image as HTMLImageElement).naturalHeight || image.height });

export interface WallSpec { corners?: Point[]; widthMm?: number; heightMm?: number }
/** widthMm × repeatMm is the roll (drop pitch and half-drop); imageWidthMm × imageHeightMm is what the picture covers, when it is not one roll width by one repeat. */
export interface PatternSpec { widthMm?: number; repeatMm?: number; halfDrop?: boolean; imageWidthMm?: number; imageHeightMm?: number }

export class WallpaperRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly mode: 'webgl2' | 'cpu';
  photo: Bitmap | null = null;
  pattern: Bitmap | null = null;
  /** Photo pixels: top-left, top-right, bottom-right, bottom-left. */
  corners: Point[] | null = null;
  wallMm = { width: 3600, height: 2400 };
  /** The roll: width and vertical repeat. */
  dropMm = { width: 530, repeat: 640 };
  /** What the pattern image covers; equal to the roll unless told otherwise. */
  tileMm = { width: 530, height: 640 };
  offsetMm = { x: 0, y: 0 };
  halfDrop = false;
  lightStrength = 0.85;
  baseLum = 0.6;
  /** Optional occlusion: a canvas whose alpha is the wall, any size. */
  segMask: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null;
  private program: WebGLProgram | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private textures: { photo: WebGLTexture; pattern: WebGLTexture; mask: WebGLTexture } | null = null;
  private maskCanvas = document.createElement('canvas');
  private dirtyMask = true;

  constructor(canvas: HTMLCanvasElement, options: { forceCpu?: boolean } = {}) {
    this.canvas = canvas;
    // The shaders are proved on a throwaway canvas first: a canvas that has handed out a WebGL context can
    // never give a 2D one, so a failed WebGL start must not touch the real canvas.
    this.gl = null;
    if (!options.forceCpu && WallpaperRenderer.webglWorks()) {
      this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false });
      if (this.gl) {
        try {
          this.initGl(this.gl);
        } catch {
          this.gl = null;
        }
      }
    }
    this.mode = this.gl ? 'webgl2' : 'cpu';
  }

  private static webglOk: boolean | null = null;
  /** Compile the shaders once on a scratch canvas; remembered for the page's life. */
  static webglWorks(): boolean {
    if (WallpaperRenderer.webglOk !== null) return WallpaperRenderer.webglOk;
    try {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) throw new Error('no webgl2');
      compile(probe, probe.VERTEX_SHADER, VERT);
      compile(probe, probe.FRAGMENT_SHADER, FRAG);
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      WallpaperRenderer.webglOk = true;
    } catch {
      WallpaperRenderer.webglOk = false;
    }
    return WallpaperRenderer.webglOk;
  }

  private initGl(gl: WebGL2RenderingContext) {
    const program = gl.createProgram();
    if (!program) throw new Error('No program');
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Link failed');
    this.program = program;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, 'aUv');
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    for (const name of ['uPhoto', 'uPattern', 'uMask', 'uToWall', 'uPhotoSize', 'uTileMm', 'uDropMm', 'uOffsetMm', 'uHalfDrop', 'uLightStrength', 'uBaseLum']) this.uniforms[name] = gl.getUniformLocation(program, name);
    const texture = () => {
      const t = gl.createTexture();
      if (!t) throw new Error('No texture');
      return t;
    };
    this.textures = { photo: texture(), pattern: texture(), mask: texture() };
  }

  private upload(texture: WebGLTexture, source: Bitmap, { repeat = false, mip = false } = {}) {
    const gl = this.gl;
    if (!gl) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mip) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  setPhoto(image: Bitmap) {
    this.photo = image;
    const { width, height } = sizeOf(image);
    this.canvas.width = width;
    this.canvas.height = height;
    this.maskCanvas.width = width;
    this.maskCanvas.height = height;
    if (!this.corners) this.corners = [[width * 0.2, height * 0.15], [width * 0.8, height * 0.15], [width * 0.8, height * 0.8], [width * 0.2, height * 0.8]];
    if (this.textures) this.upload(this.textures.photo, image);
    this.dirtyMask = true;
  }

  setPattern(image: Bitmap, spec: PatternSpec = {}) {
    const changed = image !== this.pattern;
    this.pattern = image;
    if (spec.widthMm) this.dropMm.width = spec.widthMm;
    if (spec.repeatMm) this.dropMm.repeat = spec.repeatMm;
    this.tileMm.width = spec.imageWidthMm || this.dropMm.width;
    this.tileMm.height = spec.imageHeightMm || this.dropMm.repeat;
    if (spec.halfDrop !== undefined) this.halfDrop = spec.halfDrop;
    if (changed && this.textures) this.upload(this.textures.pattern, image, { repeat: true, mip: true });
  }

  setWall(spec: WallSpec) {
    if (spec.corners) {
      const same = this.corners && this.corners.every((c, i) => c[0] === spec.corners![i][0] && c[1] === spec.corners![i][1]);
      if (!same) {
        this.corners = spec.corners.map(([x, y]) => [x, y]);
        this.dirtyMask = true;
      }
    }
    if (spec.widthMm) this.wallMm.width = spec.widthMm;
    if (spec.heightMm) this.wallMm.height = spec.heightMm;
  }

  setSegmentationMask(mask: HTMLCanvasElement | null) {
    this.segMask = mask;
    this.dirtyMask = true;
  }

  mapping(): { toPhoto: Matrix3; toWall: Matrix3 } {
    if (!this.corners) throw new Error('No wall');
    return wallMapping(this.corners, this.wallMm.width, this.wallMm.height);
  }

  private buildMask() {
    const mask = this.maskCanvas;
    const ctx = mask.getContext('2d');
    if (!ctx || !this.corners || !this.photo) return;
    ctx.clearRect(0, 0, mask.width, mask.height);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    this.corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    if (this.segMask) {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(this.segMask, 0, 0, mask.width, mask.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Mean luminance of the bare wall under the mask, from a small copy.
    const small = document.createElement('canvas');
    small.width = 160;
    small.height = Math.max(1, Math.round((160 * mask.height) / mask.width));
    const sctx = small.getContext('2d', { willReadFrequently: true });
    if (sctx) {
      sctx.drawImage(this.photo, 0, 0, small.width, small.height);
      const px = sctx.getImageData(0, 0, small.width, small.height).data;
      sctx.clearRect(0, 0, small.width, small.height);
      sctx.drawImage(mask, 0, 0, small.width, small.height);
      const mk = sctx.getImageData(0, 0, small.width, small.height).data;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < mk.length; i += 4) {
        if (mk[i + 3] > 128) {
          sum += (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
          n++;
        }
      }
      this.baseLum = n ? sum / n : 0.6;
    }
    if (this.textures) this.upload(this.textures.mask, mask);
    this.dirtyMask = false;
  }

  render() {
    if (!this.photo || !this.pattern || !this.corners) return;
    if (this.dirtyMask) this.buildMask();
    if (this.gl) this.renderGl(this.gl);
    else this.renderCpu();
  }

  private renderGl(gl: WebGL2RenderingContext) {
    const u = this.uniforms;
    const { toWall } = this.mapping();
    if (!this.textures) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.photo);
    gl.uniform1i(u.uPhoto, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.pattern);
    gl.uniform1i(u.uPattern, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.mask);
    gl.uniform1i(u.uMask, 2);
    // GLSL mat3 is column-major, so the row-major matrix is transposed here.
    gl.uniformMatrix3fv(u.uToWall, false, new Float32Array([toWall[0], toWall[3], toWall[6], toWall[1], toWall[4], toWall[7], toWall[2], toWall[5], toWall[8]]));
    gl.uniform2f(u.uPhotoSize, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uTileMm, this.tileMm.width, this.tileMm.height);
    gl.uniform2f(u.uDropMm, this.dropMm.width, this.dropMm.repeat);
    gl.uniform2f(u.uOffsetMm, this.offsetMm.x, this.offsetMm.y);
    gl.uniform1f(u.uHalfDrop, this.halfDrop ? 1 : 0);
    gl.uniform1f(u.uLightStrength, this.lightStrength);
    gl.uniform1f(u.uBaseLum, this.baseLum);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private renderCpu() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    const mctx = this.maskCanvas.getContext('2d');
    if (!ctx || !mctx || !this.photo || !this.pattern) return;
    ctx.drawImage(this.photo, 0, 0, W, H);
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const mk = mctx.getImageData(0, 0, W, H).data;
    const { width: pw, height: ph } = sizeOf(this.pattern);
    const pc = document.createElement('canvas');
    pc.width = pw;
    pc.height = ph;
    const pctx = pc.getContext('2d');
    if (!pctx) return;
    pctx.drawImage(this.pattern, 0, 0);
    const pd = pctx.getImageData(0, 0, pw, ph).data;
    const { toWall } = this.mapping();
    const tw = this.tileMm.width;
    const th = this.tileMm.height;
    const dw = this.dropMm.width;
    const dr = this.dropMm.repeat;
    const ls = this.lightStrength;
    const bl = Math.max(this.baseLum, 0.05);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const m = mk[i + 3] / 255;
        if (m <= 0.002) continue;
        const w = toWall[6] * x + toWall[7] * y + toWall[8];
        const mx = (toWall[0] * x + toWall[1] * y + toWall[2]) / w + this.offsetMm.x;
        let my = (toWall[3] * x + toWall[4] * y + toWall[5]) / w + this.offsetMm.y;
        const col = Math.floor(mx / dw);
        if (this.halfDrop && col & 1) my += dr / 2;
        const u = (((mx / tw) % 1) + 1) % 1;
        const v = (((my / th) % 1) + 1) % 1;
        const pi = ((Math.floor(v * ph) % ph) * pw + (Math.floor(u * pw) % pw)) * 4;
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        const shade = 1 + (Math.min(1.7, lum / bl) - 1) * ls;
        for (let k = 0; k < 3; k++) d[i + k] = d[i + k] * (1 - m) + Math.min(255, pd[pi + k] * shade) * m;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** The current render as a JPEG with the illustrative label burnt in. */
  toBlob({ type = 'image/jpeg', quality = 0.9, label = 'Illustrative preview, not a colour match. Order a sample. mrwallcover.com' } = {}): Promise<Blob | null> {
    const out = document.createElement('canvas');
    out.width = this.canvas.width;
    out.height = this.canvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(this.canvas, 0, 0);
    if (label) {
      const fs = Math.max(14, Math.round(out.width / 60));
      ctx.font = `${fs}px system-ui, sans-serif`;
      const pad = fs * 0.6;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(35,17,11,0.78)';
      ctx.fillRect(pad, out.height - fs - pad * 2.2, tw + pad * 2, fs + pad * 1.4);
      ctx.fillStyle = '#f4eee7';
      ctx.fillText(label, pad * 2, out.height - pad * 1.6);
    }
    return new Promise((resolve) => out.toBlob(resolve, type, quality));
  }
}

/**
 * Crop a plain border (white card, a page background) off a product image so it
 * tiles without bands. A row or column is plain when nearly all its pixels sit
 * close to the corner colour. Returns the image itself when nothing was trimmed.
 */
export function trimPlainBorder(image: Bitmap, { tolerance = 14, minPlainShare = 0.97 } = {}): { image: Bitmap; trimmed: boolean } {
  const { width, height } = sizeOf(image);
  const scale = Math.min(1, 400 / Math.max(width, height));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));
  const sample = document.createElement('canvas');
  sample.width = sw;
  sample.height = sh;
  const sctx = sample.getContext('2d', { willReadFrequently: true });
  if (!sctx) return { image, trimmed: false };
  sctx.drawImage(image, 0, 0, sw, sh);
  const d = sctx.getImageData(0, 0, sw, sh).data;
  const [r0, g0, b0] = [d[0], d[1], d[2]];
  // Only a card or page background is trimmed: near-white or near-black, and never more than a third of a side.
  const lum = (0.299 * r0 + 0.587 * g0 + 0.114 * b0) / 255;
  if (lum > 0.12 && lum < 0.88) return { image, trimmed: false };
  const plain = (i: number) => Math.abs(d[i] - r0) <= tolerance && Math.abs(d[i + 1] - g0) <= tolerance && Math.abs(d[i + 2] - b0) <= tolerance;
  const rowPlain = (y: number) => {
    let n = 0;
    for (let x = 0; x < sw; x++) if (plain((y * sw + x) * 4)) n++;
    return n / sw >= minPlainShare;
  };
  const colPlain = (x: number) => {
    let n = 0;
    for (let y = 0; y < sh; y++) if (plain((y * sw + x) * 4)) n++;
    return n / sh >= minPlainShare;
  };
  let top = 0;
  let bottom = sh - 1;
  let left = 0;
  let right = sw - 1;
  while (top < bottom && rowPlain(top)) top++;
  while (bottom > top && rowPlain(bottom)) bottom--;
  while (left < right && colPlain(left)) left++;
  while (right > left && colPlain(right)) right--;
  const keptW = right - left + 1;
  const keptH = bottom - top + 1;
  if (left > sw / 3 || sw - 1 - right > sw / 3 || top > sh / 3 || sh - 1 - bottom > sh / 3) return { image, trimmed: false };
  if (keptW < sw * 0.2 || keptH < sh * 0.2 || keptW * keptH > sw * sh * 0.985) return { image, trimmed: false };
  const out = document.createElement('canvas');
  const sx = Math.round(left / scale);
  const sy = Math.round(top / scale);
  out.width = Math.max(1, Math.round(keptW / scale));
  out.height = Math.max(1, Math.round(keptH / scale));
  out.getContext('2d')?.drawImage(image, sx, sy, out.width, out.height, 0, 0, out.width, out.height);
  return { image: out, trimmed: true };
}

/** Patterns drawn in code for the illustrative set: scale and layout only, never a product. */
export type TileKind = 'stripe' | 'trellis' | 'sprig' | 'damask';
export const TILE_KINDS: { kind: TileKind; label: string }[] = [
  { kind: 'stripe', label: 'Stripe' },
  { kind: 'trellis', label: 'Trellis' },
  { kind: 'sprig', label: 'Sprig' },
  { kind: 'damask', label: 'Damask' },
];

export function makeProceduralTile(kind: TileKind, { size = 512, ink = '#2b2420', paper = '#efe7da', accent = '#7d8c6b' } = {}): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return c;
  const s = size;
  g.fillStyle = paper;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = s / 90;
  if (kind === 'stripe') {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? accent : ink;
      g.globalAlpha = 0.85;
      g.fillRect((i * s) / 4 + s / 16, 0, s / 10, s);
    }
  } else if (kind === 'trellis') {
    g.globalAlpha = 0.9;
    g.beginPath();
    for (const [x0, y0, x1, y1] of [[0, s / 2, s / 2, 0], [s / 2, 0, s, s / 2], [s, s / 2, s / 2, s], [s / 2, s, 0, s / 2]]) {
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
    }
    g.stroke();
    g.beginPath();
    g.arc(s / 2, s / 2, s / 14, 0, Math.PI * 2);
    g.fillStyle = accent;
    g.fill();
  } else if (kind === 'sprig') {
    g.globalAlpha = 0.9;
    const leaf = (cx: number, cy: number, r: number, a: number) => {
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.beginPath();
      g.ellipse(0, 0, r, r / 2.6, 0, 0, Math.PI * 2);
      g.fillStyle = accent;
      g.fill();
      g.restore();
    };
    for (const [cx, cy, a] of [[s / 4, s / 4, 0.6], [(3 * s) / 4, (3 * s) / 4, 0.6], [(3 * s) / 4, s / 4, -0.8], [s / 4, (3 * s) / 4, -0.8]]) {
      g.beginPath();
      g.moveTo(cx - s / 10, cy + s / 10);
      g.quadraticCurveTo(cx, cy, cx + s / 10, cy - s / 10);
      g.stroke();
      leaf(cx - s / 20, cy, s / 16, a);
      leaf(cx + s / 20, cy - s / 20, s / 16, a + 1.2);
    }
  } else {
    g.globalAlpha = 0.8;
    const motif = (cx: number, cy: number) => {
      g.fillStyle = ink;
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const r = k % 2 ? s / 7 : s / 4;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      g.beginPath();
      g.arc(cx, cy, s / 12, 0, Math.PI * 2);
      g.fillStyle = paper;
      g.fill();
    };
    motif(s / 2, s / 2);
    motif(0, 0);
    motif(s, 0);
    motif(0, s);
    motif(s, s);
  }
  g.globalAlpha = 1;
  return c;
}
