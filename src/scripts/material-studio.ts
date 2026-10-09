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

export async function startStudio(root: HTMLElement) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.effects === 'reduced';
  const fallback = root.querySelector<HTMLElement>('[data-studio-fallback]');
  const stage = root.querySelector<HTMLElement>('[data-studio-stage]');
  const note = root.querySelector<HTMLElement>('[data-studio-note]');
  const status = root.querySelector<HTMLElement>('[data-studio-status]');
  if (!stage) return;
  let THREE: typeof import('three');
  try {
    THREE = await import('three');
  } catch {
    if (status) status.textContent = 'The 3D view did not load. The photograph is still here, and the rest of the site is unaffected.';
    return;
  }
  let renderer: import('three').WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !reduce, alpha: false, powerPreference: 'low-power' });
  } catch {
    if (status) status.textContent = 'WebGL is not available. Use the photograph and the material notes instead.';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(stage.clientWidth || 640, 420);
  stage.replaceChildren(renderer.domElement);
  if (fallback) fallback.hidden = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141210);
  const camera = new THREE.PerspectiveCamera(38, (stage.clientWidth || 640) / 420, 0.1, 20);
  const wallMaterial = new THREE.MeshStandardMaterial({ color: PRESETS[0].color, roughness: 0.94, metalness: 0 });
  const wallA = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), wallMaterial);
  const wallB = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.4), wallMaterial);
  wallA.position.set(-0.15, 0.7, 0);
  wallB.position.set(-0.95, 0.7, 0.55);
  wallB.rotation.y = Math.PI / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 1 }));
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

  const apply = () => {
    wallMaterial.color.setHex(preset.color);
    wallMaterial.roughness = preset.roughness;
    wallMaterial.metalness = preset.metalness;
    const map = weaveTexture(THREE, preset);
    if (wallMaterial.map) wallMaterial.map.dispose();
    wallMaterial.map = map;
    wallMaterial.needsUpdate = true;
    const radians = (angle * Math.PI) / 180;
    sun.position.set(Math.cos(radians) * 1.8, 1.5, Math.sin(radians) * 1.8);
    sun.color.setHex(warm ? 0xffe2b8 : 0xf2f6ff);
    camera.position.set(close ? 0.15 : 1.35, close ? 0.95 : 1.15, close ? 0.55 : 1.7);
    camera.lookAt(close ? 0.05 : -0.2, 0.8, 0.15);
    if (note) note.textContent = `${preset.label}. ${preset.note}`;
    renderer.render(scene, camera);
  };

  const onResize = () => {
    const width = stage.clientWidth || 640;
    camera.aspect = width / 420;
    camera.updateProjectionMatrix();
    renderer.setSize(width, 420);
    renderer.render(scene, camera);
  };
  window.addEventListener('resize', onResize);

  root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      preset = PRESETS.find((item) => item.key === button.dataset.preset) || PRESETS[0];
      root.querySelectorAll('[data-preset]').forEach((item) => item.setAttribute('aria-pressed', item === button ? 'true' : 'false'));
      apply();
    });
  });
  root.querySelector<HTMLInputElement>('[data-light]')?.addEventListener('input', (event) => {
    angle = Number((event.target as HTMLInputElement).value);
    apply();
  });
  root.querySelector('[data-daylight]')?.addEventListener('click', () => {
    warm = false;
    apply();
  });
  root.querySelector('[data-warm]')?.addEventListener('click', () => {
    warm = true;
    apply();
  });
  root.querySelector('[data-overview]')?.addEventListener('click', () => {
    close = false;
    apply();
  });
  root.querySelector('[data-closeup]')?.addEventListener('click', () => {
    close = true;
    apply();
  });
  root.querySelector('[data-reset-studio]')?.addEventListener('click', () => {
    preset = PRESETS[0];
    close = false;
    warm = false;
    angle = 40;
    const slider = root.querySelector<HTMLInputElement>('[data-light]');
    if (slider) slider.value = '40';
    apply();
  });

  let visible = true;
  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
  });
  observer.observe(root);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && visible) renderer.render(scene, camera);
  });

  apply();
  root.querySelector('[data-preset="paper"]')?.setAttribute('aria-pressed', 'true');

  root.querySelector('[data-close-studio]')?.addEventListener('click', () => {
    observer.disconnect();
    window.removeEventListener('resize', onResize);
    wallMaterial.map?.dispose();
    wallMaterial.dispose();
    wallA.geometry.dispose();
    wallB.geometry.dispose();
    floor.geometry.dispose();
    (floor.material as import('three').Material).dispose();
    renderer.dispose();
    stage.replaceChildren();
    if (fallback) fallback.hidden = false;
    root.querySelector<HTMLElement>('[data-studio-controls]')!.hidden = true;
    root.querySelector<HTMLElement>('[data-open-studio]')!.hidden = false;
  });
}

export function mountStudio() {
  const root = document.querySelector<HTMLElement>('[data-studio]');
  const open = root?.querySelector<HTMLButtonElement>('[data-open-studio]');
  open?.addEventListener('click', async () => {
    if (!root) return;
    open.hidden = true;
    const controls = root.querySelector<HTMLElement>('[data-studio-controls]');
    if (controls) controls.hidden = false;
    await startStudio(root);
  });
}
