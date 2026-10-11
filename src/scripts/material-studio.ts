type Preset = {
  key: string;
  label: string;
  color: number;
  roughness: number;
  metalness: number;
  note: string;
  weave: boolean;
};

const PRESETS: Preset[] = [
  { key: 'paper', label: 'Paper and non-woven', color: 0xe7dccb, roughness: 0.94, metalness: 0, weave: false, note: 'A matte printed surface. Seams depend on the paper and the match.' },
  { key: 'grasscloth', label: 'Grasscloth', color: 0xc6b48a, roughness: 0.82, metalness: 0, weave: true, note: 'A woven face. Variation and visible seams are part of the material.' },
  { key: 'silk', label: 'Silk', color: 0xd9cbb8, roughness: 0.28, metalness: 0.06, weave: false, note: 'Sheen changes with the light. Silk marks easily.' },
  { key: 'scenic', label: 'Hand-painted scenic', color: 0xe6d4c0, roughness: 0.88, metalness: 0, weave: false, note: 'A painted surface. This is not a particular design or maker.' },
  { key: 'vinyl', label: 'Contract vinyl', color: 0xd0cbc3, roughness: 0.45, metalness: 0.02, weave: false, note: 'A tighter face used in busy rooms. Care still follows the maker.' },
  { key: 'acoustic', label: 'Acoustic wallcovering', color: 0xb7aea3, roughness: 0.97, metalness: 0, weave: true, note: 'Texture only. This view does not show acoustic performance.' },
];

function weaveTexture(THREE: typeof import('three'), preset: Preset) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = `#${preset.color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 256, 256);
  if (preset.weave) {
    ctx.strokeStyle = 'rgba(40, 30, 16, 0.28)';
    for (let y = 0; y < 256; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + (y % 12 === 0 ? 1 : 0));
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 1800; i += 1) {
      const shade = 80 + Math.floor(Math.random() * 80);
      ctx.fillStyle = `rgba(${shade}, ${shade - 10}, ${shade - 20}, 0.08)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(preset.weave ? 2 : 1, preset.weave ? 2 : 1);
  return texture;
}

export interface StudioSession {
  dispose(): void;
}

type StudioStarter = (root: HTMLElement, signal: AbortSignal) => Promise<StudioSession | null>;
type ThreeLoader = () => Promise<typeof import('three')>;

class StudioError extends Error {
  readonly reason: 'load' | 'webgl' | 'render';
  constructor(reason: 'load' | 'webgl' | 'render') {
    super(reason);
    this.reason = reason;
  }
}

/** One opening owns one renderer, its resources and all of its event listeners. */
export async function startStudio(
  root: HTMLElement,
  signal: AbortSignal,
  loadThree: ThreeLoader = () => import('three'),
): Promise<StudioSession | null> {
  const stage = root.querySelector<HTMLElement>('[data-studio-stage]');
  const note = root.querySelector<HTMLElement>('[data-studio-note]');
  if (!stage) throw new StudioError('render');
  if (signal.aborted) return null;
  let THREE: typeof import('three');
  try {
    THREE = await loadThree();
  } catch {
    throw new StudioError('load');
  }
  if (signal.aborted) return null;

  const doc = root.ownerDocument;
  const host = doc.defaultView;
  if (!host) throw new StudioError('render');
  const reduce = host.matchMedia('(prefers-reduced-motion: reduce)').matches || doc.documentElement.dataset.effects === 'reduced';
  const events = new AbortController();
  const disposers: Array<() => void> = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    events.abort();
    signal.removeEventListener('abort', dispose);
    // Finish releasing resources even if a lost graphics context rejects one cleanup.
    for (const release of disposers.reverse()) {
      try { release(); } catch { /* Other resources still need releasing. */ }
    }
  };
  signal.addEventListener('abort', dispose, { once: true });
  const own = <T extends { dispose(): void }>(resource: T): T => {
    disposers.push(() => resource.dispose());
    return resource;
  };

  try {
    let renderer: import('three').WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !reduce, alpha: false, powerPreference: 'low-power' });
    } catch {
      throw new StudioError('webgl');
    }
    disposers.push(() => {
      renderer.domElement.remove();
      renderer.dispose();
      renderer.forceContextLoss();
    });
    renderer.setPixelRatio(Math.min(host.devicePixelRatio || 1, 1.5));
    renderer.setSize(stage.clientWidth || 640, 420);
    stage.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141210);
    const camera = new THREE.PerspectiveCamera(38, (stage.clientWidth || 640) / 420, 0.1, 20);
    const wallMaterial = own(new THREE.MeshStandardMaterial({ color: PRESETS[0].color, roughness: 0.94, metalness: 0 }));
    const wallA = new THREE.Mesh(own(new THREE.PlaneGeometry(1.6, 1.4)), wallMaterial);
    const wallB = new THREE.Mesh(own(new THREE.PlaneGeometry(1.2, 1.4)), wallMaterial);
    wallA.position.set(-0.15, 0.7, 0);
    wallB.position.set(-0.95, 0.7, 0.55);
    wallB.rotation.y = Math.PI / 2;
    const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(3, 3)), own(new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 1 })));
    floor.rotation.x = -Math.PI / 2;
    scene.add(wallA, wallB, floor);
    const ambient = new THREE.AmbientLight(0xf4f0e8, 0.35);
    const sun = new THREE.DirectionalLight(0xf4f7ff, 1.25);
    sun.position.set(1.4, 1.6, 1.2);
    scene.add(ambient, sun);

    let preset = PRESETS[0];
    let close = false;
    let warm = false;
    let angle = 40;
    let visible = true;
    disposers.push(() => wallMaterial.map?.dispose());
    const render = () => {
      if (!disposed && visible && doc.visibilityState === 'visible') renderer.render(scene, camera);
    };
    const presetButtons = root.querySelectorAll<HTMLButtonElement>('[data-preset]');
    const syncPreset = () => presetButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === preset.key)));
    const slider = root.querySelector<HTMLInputElement>('[data-light]');
    if (slider) slider.value = '40';

    const apply = () => {
      wallMaterial.color.setHex(preset.color);
      wallMaterial.roughness = preset.roughness;
      wallMaterial.metalness = preset.metalness;
      const map = weaveTexture(THREE, preset);
      wallMaterial.map?.dispose();
      wallMaterial.map = map;
      wallMaterial.needsUpdate = true;
      const radians = (angle * Math.PI) / 180;
      sun.position.set(Math.cos(radians) * 1.8, 1.5, Math.sin(radians) * 1.8);
      sun.color.setHex(warm ? 0xffe2b8 : 0xf2f6ff);
      camera.position.set(close ? 0.15 : 1.35, close ? 0.95 : 1.15, close ? 0.55 : 1.7);
      camera.lookAt(close ? 0.05 : -0.2, 0.8, 0.15);
      if (note) note.textContent = `${preset.label}. ${preset.note}`;
      syncPreset();
      render();
    };
    const onResize = () => {
      const width = stage.clientWidth;
      if (!width || disposed) return;
      camera.aspect = width / 420;
      camera.updateProjectionMatrix();
      renderer.setSize(width, 420);
      render();
    };
    const listen = (target: EventTarget | null, name: string, handler: EventListener) => {
      target?.addEventListener(name, handler, { signal: events.signal });
    };
    listen(host, 'resize', onResize);
    presetButtons.forEach(button => listen(button, 'click', () => {
      preset = PRESETS.find(item => item.key === button.dataset.preset) || PRESETS[0];
      apply();
    }));
    listen(slider, 'input', () => {
      angle = Number(slider?.value ?? 40);
      apply();
    });
    listen(root.querySelector('[data-daylight]'), 'click', () => { warm = false; apply(); });
    listen(root.querySelector('[data-warm]'), 'click', () => { warm = true; apply(); });
    listen(root.querySelector('[data-overview]'), 'click', () => { close = false; apply(); });
    listen(root.querySelector('[data-closeup]'), 'click', () => { close = true; apply(); });
    listen(root.querySelector('[data-reset-studio]'), 'click', () => {
      preset = PRESETS[0];
      close = false;
      warm = false;
      angle = 40;
      if (slider) slider.value = '40';
      apply();
    });
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) onResize();
    });
    disposers.push(() => observer.disconnect());
    observer.observe(root);
    listen(doc, 'visibilitychange', render);
    apply();
    return { dispose };
  } catch (error) {
    dispose();
    throw error instanceof StudioError ? error : new StudioError('render');
  }
}

const mounts = new WeakMap<HTMLElement, () => void>();

/** Own the opening lifecycle, including cancellation while the 3D module loads. */
export function mountStudio(
  root: HTMLElement | null = document.querySelector<HTMLElement>('[data-studio]'),
  initialize: StudioStarter = startStudio,
): () => void {
  if (!root) return () => {};
  mounts.get(root)?.();
  const open = root.querySelector<HTMLButtonElement>('[data-open-studio]');
  const close = root.querySelector<HTMLButtonElement>('[data-close-studio]');
  const controls = root.querySelector<HTMLElement>('[data-studio-controls]');
  const fallback = root.querySelector<HTMLElement>('[data-studio-fallback]');
  const stage = root.querySelector<HTMLElement>('[data-studio-stage]');
  const status = root.querySelector<HTMLElement>('[data-studio-status]');
  if (!open || !close || !controls || !stage) return () => {};
  const inputs = Array.from(controls.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input')).filter(input => input !== close);
  const events = new AbortController();
  type Opening = { abort: AbortController; session?: StudioSession };
  let current: Opening | null = null;
  const finish = (message = '', focus = false) => {
    const previous = current;
    current = null;
    previous?.abort.abort();
    previous?.session?.dispose();
    stage.replaceChildren();
    if (fallback) fallback.hidden = false;
    controls.hidden = true;
    open.hidden = false;
    open.disabled = false;
    inputs.forEach(input => { input.disabled = false; });
    root.removeAttribute('aria-busy');
    if (status) status.textContent = message;
    if (focus) open.focus();
  };
  open.addEventListener('click', async () => {
    if (current) return;
    const request: Opening = { abort: new AbortController() };
    current = request;
    open.hidden = true;
    controls.hidden = false;
    inputs.forEach(input => { input.disabled = true; });
    root.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'Loading the material light studio…';
    close.focus();
    try {
      const session = await initialize(root, request.abort.signal);
      if (current !== request || request.abort.signal.aborted) {
        session?.dispose();
        return;
      }
      if (!session) { finish('', true); return; }
      request.session = session;
      if (fallback) fallback.hidden = true;
      inputs.forEach(input => { input.disabled = false; });
      root.removeAttribute('aria-busy');
      if (status) status.textContent = '';
      root.querySelector<HTMLButtonElement>('[data-preset="paper"]')?.focus();
    } catch (error) {
      if (current !== request) return;
      const message = error instanceof StudioError && error.reason === 'webgl'
        ? 'WebGL is not available. The photograph remains available. You can try opening the studio again.'
        : 'The 3D view did not load. The photograph remains available. You can try opening the studio again.';
      finish(message, true);
    }
  }, { signal: events.signal });
  close.addEventListener('click', () => finish('', true), { signal: events.signal });
  root.ownerDocument.defaultView?.addEventListener('pagehide', () => finish(), { signal: events.signal });
  let unmounted = false;
  const unmount = () => {
    if (unmounted) return;
    unmounted = true;
    events.abort();
    finish();
    if (mounts.get(root) === unmount) mounts.delete(root);
  };
  mounts.set(root, unmount);
  return unmount;
}
