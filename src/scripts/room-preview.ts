/**
 * Mr Wallcover Atelier: the photo, the four corners, the pattern and the hand-offs.
 * Everything runs in the browser; the only network calls are the optional wall
 * detection model and, when a link is given and the private API is configured,
 * that API reading the linked page. See /atelier/ for the copy.
 */
import { TILE_KINDS, WallpaperRenderer, makeProceduralTile, trimPlainBorder, type TileKind } from '../lib/room-preview/engine';
import { cornersFromMask, polygonArea, type Point } from '../lib/room-preview/homography';
import { linkPreviewFromText, matchFromText, type LinkPreview } from '../lib/link-preview';

const BRIEF_KEY = 'mw-room-preview-brief';
const MAX_PHOTO_PX = 2000;
const MODEL = 'Xenova/segformer-b0-finetuned-ade-512-512';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2';

type SourceKind = 'tile' | 'sample' | 'link' | 'paste' | 'paint' | 'mural';
interface PatternSource { kind: SourceKind; label: string; image: ImageBitmap | HTMLCanvasElement; link?: string }

const root = document.querySelector<HTMLElement>('[data-room-preview]');
if (root) mount(root);

function mount(root: HTMLElement) {
  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const stage = q<HTMLElement>('[data-stage]');
  const canvas = q<HTMLCanvasElement>('[data-canvas]');
  const handles = q<SVGSVGElement>('[data-handles]');
  const statusEl = q<HTMLElement>('[data-status]');
  const stageActions = q<HTMLElement>('[data-stage-actions]');
  const photoInput = q<HTMLInputElement>('[data-photo]');
  const demoButton = q<HTMLButtonElement>('[data-demo]');
  const detectButton = q<HTMLButtonElement>('[data-detect]');
  const wallWidth = q<HTMLInputElement>('[data-wall-width]');
  const wallHeight = q<HTMLInputElement>('[data-wall-height]');
  const tilesList = q<HTMLElement>('[data-tiles]');
  const swatchInput = q<HTMLInputElement>('[data-swatch]');
  const linkInput = q<HTMLInputElement>('[data-link]');
  const linkButton = q<HTMLButtonElement>('[data-link-read]');
  const paintInput = q<HTMLInputElement>('[data-paint]');
  const typeSelect = q<HTMLSelectElement>('[data-type]');
  const rollWidth = q<HTMLInputElement>('[data-roll-width]');
  const repeat = q<HTMLInputElement>('[data-repeat]');
  const match = q<HTMLSelectElement>('[data-match]');
  const imageWidth = q<HTMLInputElement>('[data-image-width]');
  const imageHeight = q<HTMLInputElement>('[data-image-height]');
  const shiftX = q<HTMLInputElement>('[data-shift-x]');
  const shiftY = q<HTMLInputElement>('[data-shift-y]');
  const light = q<HTMLInputElement>('[data-light]');
  const downloadButton = q<HTMLButtonElement>('[data-download]');
  const calculatorLink = q<HTMLAnchorElement>('[data-calculator]');
  const enquireLink = q<HTMLAnchorElement>('[data-enquire]');
  const summary = q<HTMLElement>('[data-summary]');
  if (!stage || !canvas || !handles || !statusEl || !wallWidth || !wallHeight || !rollWidth || !repeat || !match) return;
  // The private API's origin is printed by the page at build time (as the enquiry form does); empty on the static build.
  const LEAD_API_URL = root.dataset.linkApi || '';

  let renderer: WallpaperRenderer | null = null;
  let corners: Point[] = [];
  let source: PatternSource | null = null;
  let photoLabel = '';
  let frame = 0;
  // What the picture covers follows the roll until the visitor says otherwise.
  let imageSizeTouched = false;
  // The last wallpaper link read or offered, kept for the enquiry whatever pattern is chosen later.
  let linkUrl = '';
  const tiles = new Map<TileKind, HTMLCanvasElement>();

  const status = (text: string, tone: 'info' | 'error' = 'info') => {
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  };
  const num = (input: HTMLInputElement, fallback: number) => {
    const value = Number(input.value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const isMural = () => typeSelect?.value === 'mural' || source?.kind === 'mural';
  const isPaint = () => source?.kind === 'paint';

  // ---------- rendering ----------
  function ensureRenderer(): WallpaperRenderer {
    if (!renderer) {
      renderer = new WallpaperRenderer(canvas!);
      if (renderer.mode === 'cpu') status('This browser has no WebGL, so the preview is drawn more slowly.');
    }
    return renderer;
  }
  function draw() {
    // Links and the brief follow the inputs at once, room or no room; the render waits for the next frame (none in a hidden tab).
    updateHandoffs();
    if (!renderer || !renderer.photo || !source) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = renderer!;
      const wmm = num(wallWidth!, 400) * 10;
      const hmm = num(wallHeight!, 270) * 10;
      r.setWall({ corners, widthMm: wmm, heightMm: hmm });
      if (isMural()) r.setPattern(source!.image, { widthMm: wmm, repeatMm: hmm, halfDrop: false });
      else if (isPaint()) r.setPattern(source!.image, { widthMm: 100, repeatMm: 100, halfDrop: false });
      else {
        const rollW = num(rollWidth!, 53);
        const rollR = num(repeat!, 64);
        if (!imageSizeTouched) {
          if (imageWidth) imageWidth.value = String(rollW);
          if (imageHeight) imageHeight.value = String(rollR);
        }
        r.setPattern(source!.image, {
          widthMm: rollW * 10,
          repeatMm: rollR * 10,
          halfDrop: match!.value === 'half',
          imageWidthMm: (imageSizeTouched && imageWidth ? num(imageWidth, rollW) : rollW) * 10,
          imageHeightMm: (imageSizeTouched && imageHeight ? num(imageHeight, rollR) : rollR) * 10,
        });
      }
      r.offsetMm = { x: Number(shiftX?.value || 0) * 10, y: Number(shiftY?.value || 0) * 10 };
      r.lightStrength = Number(light?.value ?? 0.85);
      try {
        r.render();
      } catch (error) {
        status(error instanceof Error ? error.message : 'The preview could not be drawn.', 'error');
      }
      updateHandoffs();
    });
  }

  // ---------- the room ----------
  async function bitmapFrom(file: File | Blob, maxPx = MAX_PHOTO_PX): Promise<ImageBitmap> {
    const probe = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (probe.width <= maxPx && probe.height <= maxPx) return probe;
    const scale = maxPx / Math.max(probe.width, probe.height);
    const resized = await createImageBitmap(probe, { resizeWidth: Math.round(probe.width * scale), resizeHeight: Math.round(probe.height * scale), resizeQuality: 'high' });
    probe.close();
    return resized;
  }
  function setPhoto(image: ImageBitmap | HTMLImageElement, options: { corners?: number[][]; widthCm?: number; heightCm?: number; label: string }) {
    const r = ensureRenderer();
    r.setSegmentationMask(null);
    if (r.photo instanceof ImageBitmap && r.photo !== image) r.photo.close();
    r.setPhoto(image);
    const w = canvas!.width;
    const h = canvas!.height;
    const fractions = options.corners || [[0.15, 0.1], [0.85, 0.1], [0.85, 0.78], [0.15, 0.78]];
    corners = fractions.map(([x, y]) => [x * w, y * h] as Point);
    if (options.widthCm) wallWidth!.value = String(options.widthCm);
    if (options.heightCm) wallHeight!.value = String(options.heightCm);
    photoLabel = options.label;
    stage!.hidden = false;
    if (stageActions) stageActions.hidden = false;
    handles!.setAttribute('viewBox', `0 0 ${w} ${h}`);
    handles!.setAttribute('preserveAspectRatio', 'none');
    for (const way of root.querySelectorAll<HTMLElement>('[data-way]')) way.dataset.active = String(way.dataset.way === (options.label === 'our room' ? 'demo' : 'photo'));
    drawHandles();
    if (!source) selectTile('trellis');
    status(`Room loaded. Drag the four handles to the corners of the wall, then set its size.`);
    draw();
  }
  photoInput?.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    try {
      setPhoto(await bitmapFrom(file), { label: 'your photo' });
    } catch {
      status('That file could not be read as a photo. JPEG, PNG and WebP work everywhere; HEIC from an iPhone works in Safari.', 'error');
    }
  });
  demoButton?.addEventListener('click', async () => {
    const src = demoButton.dataset.src;
    if (!src) return;
    status('Loading our room…');
    try {
      // The same route as a chosen file: fetch, then decode to a bitmap (Image.decode can stall in background tabs).
      const response = await fetch(src);
      if (!response.ok) throw new Error(String(response.status));
      setPhoto(await bitmapFrom(await response.blob()), {
        corners: JSON.parse(demoButton.dataset.corners || '[]'),
        widthCm: Number(demoButton.dataset.width),
        heightCm: Number(demoButton.dataset.height),
        label: 'our room',
      });
    } catch {
      status('Our room could not be loaded. Try your own photo.', 'error');
    }
  });

  // ---------- the corners ----------
  const CORNER_NAMES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
  function drawHandles() {
    handles!.textContent = '';
    const ns = 'http://www.w3.org/2000/svg';
    const polygon = document.createElementNS(ns, 'polygon');
    const sync = () => polygon.setAttribute('points', corners.map((c) => c.join(',')).join(' '));
    sync();
    handles!.appendChild(polygon);
    // 22 CSS pixels on screen (a 44px target) whatever the photo's pixel size; refreshed when the layout changes.
    const radius = () => 22 * (canvas!.width / Math.max(1, canvas!.clientWidth || canvas!.width));
    corners.forEach((corner, i) => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('r', String(radius()));
      dot.setAttribute('data-handle', '');
      dot.setAttribute('cx', String(corner[0]));
      dot.setAttribute('cy', String(corner[1]));
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('role', 'button');
      dot.setAttribute('aria-roledescription', 'draggable corner handle');
      dot.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight');
      dot.setAttribute('aria-label', `${CORNER_NAMES[i]} corner of the wall. Drag it, or in focus mode use the arrow keys; Shift moves further`);
      const move = (x: number, y: number) => {
        corners[i] = [Math.max(0, Math.min(canvas!.width, x)), Math.max(0, Math.min(canvas!.height, y))];
        dot.setAttribute('cx', String(corners[i][0]));
        dot.setAttribute('cy', String(corners[i][1]));
        sync();
        draw();
      };
      dot.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        dot.setPointerCapture(event.pointerId);
        const onMove = (ev: PointerEvent) => {
          const rect = canvas!.getBoundingClientRect();
          move(((ev.clientX - rect.left) * canvas!.width) / rect.width, ((ev.clientY - rect.top) * canvas!.height) / rect.height);
        };
        const stop = () => {
          dot.removeEventListener('pointermove', onMove);
          dot.removeEventListener('pointerup', stop);
          dot.removeEventListener('pointercancel', stop);
        };
        dot.addEventListener('pointermove', onMove);
        dot.addEventListener('pointerup', stop);
        dot.addEventListener('pointercancel', stop);
      });
      dot.addEventListener('keydown', (event) => {
        const step = (event.shiftKey ? 10 : 2) * (canvas!.width / 1000);
        const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const d = delta[event.key];
        if (!d) return;
        event.preventDefault();
        move(corners[i][0] + d[0], corners[i][1] + d[1]);
      });
      handles!.appendChild(dot);
    });
    handles!.removeAttribute('aria-hidden');
  }

  // ---------- automatic wall detection (optional, on-device) ----------
  detectButton?.addEventListener('click', async () => {
    if (detectButton.getAttribute('aria-disabled') === 'true') return;
    if (!renderer?.photo) {
      status('Load a room first.', 'error');
      return;
    }
    detectButton.setAttribute('aria-disabled', 'true');
    status('Loading the wall-detection model (about 15 MB with its runtime, once)…');
    let lastTenth = -1;
    try {
      const { pipeline, env } = await import(/* @vite-ignore */ TRANSFORMERS_URL);
      env.allowLocalModels = false;
      const segment = await pipeline('image-segmentation', MODEL, {
        dtype: 'q8',
        progress_callback: (p: { status: string; progress?: number }) => {
          const tenth = Math.floor((p.progress || 0) / 10) * 10;
          if (p.status === 'progress' && tenth !== lastTenth) {
            lastTenth = tenth;
            status(`Loading the wall-detection model: ${tenth}%`);
          }
        },
      });
      status('Finding the wall…');
      const started = performance.now();
      // The model sees the bare photograph, not the preview drawn over it.
      const bare = document.createElement('canvas');
      bare.width = canvas!.width;
      bare.height = canvas!.height;
      bare.getContext('2d')?.drawImage(renderer.photo, 0, 0);
      const results: { label: string; mask: { width: number; height: number; data: Uint8Array } }[] = await segment(bare.toDataURL('image/jpeg', 0.85));
      const wall = results.find((r) => r.label === 'wall');
      if (!wall) {
        status('No wall was recognised in this photo. Drag the corners instead.', 'error');
        return;
      }
      const { width, height, data } = wall.mask;
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const ctx = maskCanvas.getContext('2d')!;
      const pixels = ctx.createImageData(width, height);
      const binary = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const on = data[i] > 127;
        binary[i] = on ? 1 : 0;
        pixels.data[i * 4 + 3] = on ? 255 : 0;
      }
      ctx.putImageData(pixels, 0, 0);
      const found = cornersFromMask(binary, width, height);
      if (!found) {
        status('Too little wall was recognised. Drag the corners instead.', 'error');
        return;
      }
      // The model marks every wall surface as one class. The mask is kept as the cut-out for windows, doors,
      // radiators and furniture. The handles only move when the found wall sits inside the frame; a wall that
      // runs off the edges is several walls, and which one is wanted is the visitor's call.
      renderer.setSegmentationMask(maskCanvas);
      const margin = 0.02;
      const onEdge = found.filter(([x, y]) => x < width * margin || x > width * (1 - margin) || y < height * margin || y > height * (1 - margin)).length;
      const seconds = (Math.round(performance.now() - started) / 1000).toFixed(1);
      if (onEdge < 2) {
        corners = found.map(([x, y]) => [(x * canvas!.width) / width, (y * canvas!.height) / height] as Point);
        drawHandles();
        status(`Wall found in ${seconds} s and the handles moved to it. Windows, doors and furniture on it are left bare; adjust the corners if the guess is off.`);
      } else {
        status(`Wall surfaces found in ${seconds} s; windows, doors and furniture on them are now left bare. The photo shows more than one wall, so place the four handles on the wall you want.`);
      }
      draw();
    } catch (error) {
      status(`Wall detection is unavailable here (${error instanceof Error ? error.message : 'no connection'}). Drag the corners instead.`, 'error');
    } finally {
      detectButton.removeAttribute('aria-disabled');
    }
  });

  // ---------- the pattern ----------
  function setSource(next: PatternSource) {
    // A product picture on a plain card or page background tiles as bands: trim it.
    if (next.kind !== 'tile' && next.kind !== 'paint') {
      const { image, trimmed } = trimPlainBorder(next.image);
      if (trimmed) {
        next = { ...next, image };
        status('Trimmed the plain border off the image.');
      }
    }
    source = next;
    imageSizeTouched = false;
    for (const button of tilesList?.querySelectorAll<HTMLButtonElement>('[data-tile]') || []) button.setAttribute('aria-pressed', String(next.kind === 'tile' && button.dataset.tile === next.label.toLowerCase()));
    if (typeSelect && next.kind === 'mural') typeSelect.value = 'mural';
    if (typeSelect && next.kind === 'tile') typeSelect.value = 'wallpaper';
    if (!renderer?.photo) status(`Pattern ready: ${next.label}. Now choose a room.`);
    draw();
  }
  function selectTile(kind: TileKind) {
    let tile = tiles.get(kind);
    if (!tile) {
      tile = makeProceduralTile(kind);
      tiles.set(kind, tile);
    }
    setSource({ kind: 'tile', label: TILE_KINDS.find((t) => t.kind === kind)?.label || kind, image: tile });
  }
  if (tilesList) {
    for (const { kind, label } of TILE_KINDS) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-tile';
      button.dataset.tile = kind;
      button.setAttribute('aria-pressed', 'false');
      const thumb = document.createElement('canvas');
      thumb.width = 96;
      thumb.height = 96;
      thumb.getContext('2d')?.drawImage(makeProceduralTile(kind, { size: 192 }), 0, 0, 96, 96);
      const caption = document.createElement('small');
      caption.textContent = `${label} · illustrative`;
      button.append(thumb, caption);
      button.addEventListener('click', () => selectTile(kind));
      item.appendChild(button);
      tilesList.appendChild(item);
    }
  }
  swatchInput?.addEventListener('change', async () => {
    const file = swatchInput.files?.[0];
    if (!file) return;
    try {
      setSource({ kind: typeSelect?.value === 'mural' ? 'mural' : 'sample', label: `your sample (${file.name})`, image: await bitmapFrom(file, 2048) });
    } catch {
      status('That file could not be read as an image.', 'error');
    }
  });
  // Paste an image copied from anywhere (a product page, a message, a screenshot).
  document.addEventListener('paste', async (event) => {
    const item = Array.from(event.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) return;
    event.preventDefault();
    try {
      setSource({ kind: typeSelect?.value === 'mural' ? 'mural' : 'paste', label: 'a pasted image', image: await bitmapFrom(file, 2048) });
      status('Pasted image applied. Set its printed width and repeat.');
    } catch {
      status('The pasted image could not be read.', 'error');
    }
  });
  paintInput?.addEventListener('input', () => {
    const swatch = document.createElement('canvas');
    swatch.width = 8;
    swatch.height = 8;
    const ctx = swatch.getContext('2d')!;
    ctx.fillStyle = paintInput.value;
    ctx.fillRect(0, 0, 8, 8);
    setSource({ kind: 'paint', label: `paint ${paintInput.value}`, image: swatch });
  });
  typeSelect?.addEventListener('change', () => {
    if (source && (source.kind === 'sample' || source.kind === 'paste' || source.kind === 'link' || source.kind === 'mural')) source = { ...source, kind: typeSelect.value === 'mural' ? 'mural' : source.kind === 'mural' ? 'sample' : source.kind };
    draw();
  });

  // A link to the wallpaper. The browser cannot read another website, so the private API reads the page
  // when it is configured; a direct image link is tried as well; otherwise the link is kept for the enquiry.
  async function readLink() {
    if (linkButton?.getAttribute('aria-disabled') === 'true') return;
    const url = (linkInput?.value || '').trim();
    if (!url) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error('scheme');
    } catch {
      status('Paste a full web address starting with https://', 'error');
      return;
    }
    linkButton?.setAttribute('aria-disabled', 'true');
    linkUrl = parsed.href;
    status('Reading the link…');
    try {
      let preview: LinkPreview | null = null;
      const looksLikeImage = /\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(parsed.pathname);
      if (LEAD_API_URL && !looksLikeImage) {
        const response = await fetch(`${LEAD_API_URL}/api/link-preview?url=${encodeURIComponent(parsed.href)}`, { headers: { Accept: 'application/json' } });
        if (response.ok) preview = (await response.json()) as LinkPreview;
      }
      // An image link is used as it is when its host allows it, else through the API's image route.
      const candidates = preview ? [preview.image, preview.imageProxy] : [parsed.href, LEAD_API_URL ? `${LEAD_API_URL}/api/link-image?url=${encodeURIComponent(parsed.href)}` : ''];
      let bitmap: ImageBitmap | null = null;
      for (const candidate of candidates.filter(Boolean) as string[]) {
        try {
          const response = await fetch(candidate, { mode: 'cors' });
          if (!response.ok) continue;
          bitmap = await bitmapFrom(await response.blob(), 2048);
          break;
        } catch {
          /* blocked by the host: try the next way in */
        }
      }
      if (!bitmap) throw new Error('no-image');
      if (preview?.widthCm) rollWidth!.value = String(preview.widthCm);
      if (preview?.repeatCm) repeat!.value = String(preview.repeatCm);
      if (preview?.match && ['straight', 'half', 'free'].includes(preview.match)) match!.value = preview.match;
      setSource({ kind: typeSelect?.value === 'mural' ? 'mural' : 'link', label: preview?.title || parsed.hostname, image: bitmap, link: parsed.href });
      const matchName = (m?: string) => (m === 'half' ? 'half-drop' : m === 'free' ? 'free match' : 'straight match');
      status(preview?.widthCm || preview?.repeatCm ? `Read ${preview.title || parsed.hostname}: width ${preview.widthCm || '?'} cm, repeat ${preview.repeatCm || '?'} cm${preview.match ? `, ${matchName(preview.match)}` : ''}. Check these against the product page.` : `Image read from ${parsed.hostname}. Set the roll width and repeat from the product page.`);
    } catch {
      status(`That page could not be read from here. Save the wallpaper image from it and upload or paste it above, then set the width and repeat the page states. The link is kept with your enquiry.`, 'error');
      if (source) source = { ...source, link: parsed.href };
      else source = null;
      updateHandoffs();
    } finally {
      linkButton?.removeAttribute('aria-disabled');
    }
  }
  linkButton?.addEventListener('click', readLink);
  linkInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      readLink();
    }
  });
  // A pasted product description ("Roll width 52 cm, repeat 64 cm, half drop") fills the fields.
  linkInput?.addEventListener('paste', (event) => {
    const text = event.clipboardData?.getData('text/plain') || '';
    if (/^https?:\/\//i.test(text.trim()) || text.length < 20) return;
    const found = linkPreviewFromText(text);
    if (found.widthCm) rollWidth!.value = String(found.widthCm);
    if (found.repeatCm) repeat!.value = String(found.repeatCm);
    const m = matchFromText(text);
    if (m && ['straight', 'half', 'free'].includes(m)) match!.value = m;
    if (found.widthCm || found.repeatCm || m) {
      event.preventDefault();
      status('Width, repeat and match read from the pasted text.');
      draw();
    }
  });

  for (const input of [wallWidth, wallHeight, rollWidth, repeat, match, shiftX, shiftY, light]) input?.addEventListener('input', draw);
  for (const input of [imageWidth, imageHeight]) input?.addEventListener('input', () => {
    imageSizeTouched = true;
    draw();
  });
  for (const input of [shiftX, shiftY]) input?.addEventListener('input', () => input.setAttribute('aria-valuetext', `${input.value} cm`));

  // ---------- hand-offs ----------
  function brief(): string {
    const lines = [
      `Room preview (${location.origin}/atelier/), ${new Date().toISOString().slice(0, 10)}.`,
      `Wall about ${num(wallWidth!, 0)} × ${num(wallHeight!, 0)} cm (${photoLabel || 'no photo yet'}).`,
    ];
    if (source) {
      if (source.kind === 'paint') lines.push(`Finish: ${source.label}.`);
      else if (isMural()) lines.push(`Mural fitted to the wall: ${source.label}${source.link ? ` — ${source.link}` : ''}.`);
      else lines.push(`Pattern: ${source.label}${source.link ? ` — ${source.link}` : ''}; roll width ${num(rollWidth!, 0)} cm, repeat ${num(repeat!, 0)} cm, ${match!.value === 'half' ? 'half-drop' : match!.value === 'free' ? 'free match' : 'straight match'}.`);
      if (source.kind === 'tile') lines.push('The illustrative pattern stands in for scale only.');
    }
    const offered = linkUrl || (linkInput?.value || '').trim();
    if (offered && !(source?.link === offered)) lines.push(`Wallpaper link: ${offered}`);
    lines.push('Preview downloaded and attached: (yes/no).');
    return lines.join('\n');
  }
  function updateHandoffs() {
    const w = num(wallWidth!, 0);
    const h = num(wallHeight!, 0);
    if (calculatorLink) {
      const m = ['half', 'free'].includes(match!.value) ? match!.value : 'straight';
      calculatorLink.href = isMural() || isPaint() ? '/calculator/' : `/calculator/?f=other-roll&rw=${num(rollWidth!, 53)}&rl=10&m=${m}&r=${num(repeat!, 64)}&ms=wall&w=${w}x${h}#calculator-heading`;
    }
    if (summary) {
      const drops = !isMural() && !isPaint() && w && num(rollWidth!, 0) ? Math.ceil(w / num(rollWidth!, 53)) : 0;
      summary.textContent = source ? `${w} × ${h} cm wall, ${source.label}${drops ? `: about ${drops} drop${drops === 1 ? '' : 's'} across` : ''}. The calculator gives the rolls; this preview shows scale, not colour.` : '';
    }
    try {
      sessionStorage.setItem(BRIEF_KEY, brief());
    } catch {
      /* private mode: the enquiry starts empty */
    }
  }
  enquireLink?.addEventListener('click', updateHandoffs);
  downloadButton?.addEventListener('click', async () => {
    if (!renderer?.photo || !source) {
      status('Load a room and a pattern first.', 'error');
      return;
    }
    const blob = await renderer.toBlob();
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mr-wallcover-room-preview-${new Date().toISOString().slice(0, 10)}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  });

  // Keep the handle layer aligned if the photo is replaced or the layout changes.
  new ResizeObserver(() => {
    if (!corners.length || polygonArea(corners) === 0) return;
    handles!.setAttribute('viewBox', `0 0 ${canvas!.width} ${canvas!.height}`);
    const r = 22 * (canvas!.width / Math.max(1, canvas!.clientWidth || canvas!.width));
    for (const dot of handles!.querySelectorAll('circle')) dot.setAttribute('r', String(r));
  }).observe(canvas);

  updateHandoffs();
}
