import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import * as Three from 'three';
import { mountStudio, startStudio } from '../src/scripts/material-studio.ts';

// Exercise the real lifecycle and Three scene with a small DOM boundary and a renderer spy.
// This does not claim GPU/rendered-browser coverage and needs no browser dependency.
class NodeStub extends EventTarget {
  hidden = false;
  disabled = false;
  focused = false;
  textContent = '';
  value = '40';
  clientWidth = 640;
  width = 0;
  height = 0;
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  nodes = new Map<string, NodeStub>();
  groups = new Map<string, NodeStub[]>();
  children: NodeStub[] = [];
  parent: NodeStub | null = null;
  ownerDocument: DocumentStub;
  constructor(doc: DocumentStub) { super(); this.ownerDocument = doc; }
  querySelector(selector: string) { return this.nodes.get(selector) ?? null; }
  querySelectorAll(selector: string) { return this.groups.get(selector) ?? []; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  replaceChildren(...nodes: NodeStub[]) {
    this.children.forEach(node => { node.parent = null; });
    this.children = nodes;
    nodes.forEach(node => { node.parent = this; });
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);
    this.parent = null;
  }
  focus() { this.focused = true; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  getContext() {
    return { fillStyle: '', strokeStyle: '', fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
  }
}

class WindowStub extends EventTarget {
  devicePixelRatio = 2;
  reduced = false;
  matchMedia() { return { matches: this.reduced }; }
}
class DocumentStub extends EventTarget {
  defaultView = new WindowStub();
  documentElement = { dataset: {} as Record<string, string> };
  visibilityState = 'visible';
  createElement() { return new NodeStub(this); }
}

function fixture(t: TestContext, options: { webglFails?: boolean; renderFails?: boolean; reduced?: boolean } = {}) {
  const doc = new DocumentStub();
  doc.defaultView.reduced = Boolean(options.reduced);
  const root = new NodeStub(doc);
  const node = (name: string) => {
    const child = new NodeStub(doc);
    root.nodes.set(`[data-${name}]`, child);
    return child;
  };
  const open = node('open-studio');
  const close = node('close-studio');
  const controls = node('studio-controls');
  controls.hidden = true;
  const fallback = node('studio-fallback');
  const stage = node('studio-stage');
  const note = node('studio-note');
  const status = node('studio-status');
  const slider = node('light');
  for (const key of ['daylight', 'warm', 'overview', 'closeup', 'reset-studio']) node(key);
  const presets = ['paper', 'grasscloth', 'silk', 'scenic', 'vinyl', 'acoustic'].map(key => {
    const button = new NodeStub(doc);
    button.dataset.preset = key;
    root.nodes.set(`[data-preset="${key}"]`, button);
    return button;
  });
  root.groups.set('[data-preset]', presets);
  controls.groups.set('button, input', [close, slider, ...presets, ...['daylight', 'warm', 'overview', 'closeup', 'reset-studio'].map(key => root.querySelector(`[data-${key}]`)!)]);

  type Resource = Three.BufferGeometry | Three.Material | Three.Texture;
  const renderers: RendererStub[] = [];
  class RendererStub {
    domElement = new NodeStub(doc);
    renders = 0;
    disposed = 0;
    contextsReleased = 0;
    pixelRatio = 0;
    sizes: number[] = [];
    resources = new Map<Resource, number>();
    settings: { antialias: boolean };
    constructor(settings: { antialias: boolean }) {
      if (options.webglFails) throw new Error('No GPU');
      this.settings = settings;
      renderers.push(this);
    }
    setPixelRatio(value: number) { this.pixelRatio = value; }
    setSize(width: number) { this.sizes.push(width); }
    render(scene: Three.Scene) {
      assert.equal(this.disposed, 0, 'a closed renderer must never receive another event');
      this.renders += 1;
      const track = (resource: Resource) => {
        if (this.resources.has(resource)) return;
        this.resources.set(resource, 0);
        resource.addEventListener('dispose', () => this.resources.set(resource, this.resources.get(resource)! + 1));
      };
      scene.traverse(object => {
        if (!(object instanceof Three.Mesh)) return;
        track(object.geometry);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          track(material);
          if (material instanceof Three.MeshStandardMaterial && material.map) track(material.map);
        }
      });
      if (options.renderFails) throw new Error('Initial render failed');
    }
    dispose() { this.disposed += 1; }
    forceContextLoss() { this.contextsReleased += 1; }
  }
  const observers: ObserverStub[] = [];
  class ObserverStub {
    callback: (entries: Array<{ isIntersecting: boolean }>) => void;
    disconnected = false;
    constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  for (const [name, value] of Object.entries({ document: doc, window: doc.defaultView, IntersectionObserver: ObserverStub })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  const element = root as unknown as HTMLElement;
  const module = { ...Three, WebGLRenderer: RendererStub } as unknown as typeof Three;
  const initialize = (target: HTMLElement, signal: AbortSignal) => startStudio(target, signal, async () => module);
  return { root, element, doc, open, close, controls, fallback, stage, note, status, slider, presets, renderers, observers, initialize, module };
}
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };

function assertClosed(f: ReturnType<typeof fixture>) {
  assert.equal(f.open.hidden, false);
  assert.equal(f.open.disabled, false);
  assert.equal(f.fallback.hidden, false);
  assert.equal(f.controls.hidden, true);
  assert.equal(f.stage.children.length, 0);
  assert.equal(f.root.getAttribute('aria-busy'), null);
}

test('a module load failure restores the photograph and open button, and retry succeeds', async t => {
  const f = fixture(t);
  let attempts = 0;
  const unmount = mountStudio(f.element, (root, signal) => {
    attempts += 1;
    return attempts === 1
      ? startStudio(root, signal, async () => { throw new Error('Network unavailable'); })
      : f.initialize(root, signal);
  });
  t.after(unmount);
  f.open.click();
  await flush();
  assertClosed(f);
  assert.match(f.status.textContent, /photograph remains available.*try opening/s);
  assert.equal(f.open.focused, true);
  f.open.click();
  await flush();
  assert.equal(attempts, 2);
  assert.equal(f.controls.hidden, false);
  assert.equal(f.fallback.hidden, true);
  assert.equal(f.status.textContent, '');
  f.close.click();
  assertClosed(f);
});

test('WebGL failure leaves no dead controls and permits another attempt', async t => {
  const options = { webglFails: true };
  const f = fixture(t, options);
  const unmount = mountStudio(f.element, f.initialize);
  t.after(unmount);
  f.open.click();
  await flush();
  assertClosed(f);
  assert.match(f.status.textContent, /WebGL is not available/);
  options.webglFails = false;
  f.open.click();
  await flush();
  assert.equal(f.renderers.length, 1);
  assert.equal(f.fallback.hidden, true);
});

test('failed first rendering releases partially created resources and allows retry', async t => {
  const options = { renderFails: true };
  const f = fixture(t, options);
  const unmount = mountStudio(f.element, f.initialize);
  t.after(unmount);
  f.open.click();
  await flush();
  assertClosed(f);
  const failed = f.renderers[0];
  assert.equal(failed.disposed, 1);
  assert.equal(failed.contextsReleased, 1);
  assert.ok([...failed.resources.values()].every(count => count === 1));
  assert.equal(f.observers[0].disconnected, true);
  options.renderFails = false;
  f.open.click();
  await flush();
  assert.equal(f.renderers.length, 2);
  assert.equal(f.fallback.hidden, true);
});

test('open-close-open has one active set of handlers and releases every graphics resource', async t => {
  const f = fixture(t);
  const unmount = mountStudio(f.element, f.initialize);
  t.after(unmount);
  f.open.click();
  await flush();
  f.presets[1].click();
  assert.match(f.note.textContent, /Grasscloth/);
  const first = f.renderers[0];
  f.close.click();
  assertClosed(f);
  const firstRenders = first.renders;
  assert.equal(first.disposed, 1);
  assert.equal(first.contextsReleased, 1);
  assert.ok([...first.resources.values()].every(count => count === 1));
  f.doc.defaultView.dispatchEvent(new Event('resize'));
  f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(first.renders, firstRenders);
  f.open.click();
  await flush();
  assert.equal(f.renderers.length, 2);
  const second = f.renderers[1];
  const secondRenders = second.renders;
  f.presets[2].click();
  assert.equal(second.renders, secondRenders + 1);
  assert.equal(first.renders, firstRenders);
  f.close.click();
  assert.equal(first.disposed, 1);
  assert.equal(second.disposed, 1);
  assert.ok([...second.resources.values()].every(count => count === 1));
  assert.ok(f.observers.every(observer => observer.disconnected));
});

test('closing during module loading cancels it without disturbing a newer opening', async t => {
  const f = fixture(t);
  let resolveLoad!: (value: typeof Three) => void;
  const waiting = new Promise<typeof Three>(resolve => { resolveLoad = resolve; });
  let calls = 0;
  const unmount = mountStudio(f.element, (root, signal) => {
    calls += 1;
    return startStudio(root, signal, () => calls === 1 ? waiting : Promise.resolve(f.module));
  });
  t.after(unmount);
  f.open.click();
  assert.equal(f.root.getAttribute('aria-busy'), 'true');
  assert.equal(f.presets[0].disabled, true);
  f.close.click();
  assertClosed(f);
  f.open.click();
  await flush();
  assert.equal(f.renderers.length, 1);
  resolveLoad(f.module);
  await flush();
  assert.equal(f.renderers.length, 1);
  assert.equal(f.stage.children.length, 1);
  assert.equal(f.controls.hidden, false);
  assert.equal(f.fallback.hidden, true);
});

test('reset and reopen keep selected material and slider state accurate', async t => {
  const f = fixture(t);
  const unmount = mountStudio(f.element, f.initialize);
  t.after(unmount);
  f.open.click();
  await flush();
  f.presets[2].click();
  f.slider.value = '120';
  f.slider.dispatchEvent(new Event('input'));
  f.root.querySelector('[data-reset-studio]')!.click();
  assert.equal(f.slider.value, '40');
  assert.deepEqual(f.presets.map(button => button.getAttribute('aria-pressed')), ['true', 'false', 'false', 'false', 'false', 'false']);
  f.presets[2].click();
  f.slider.value = '100';
  f.close.click();
  f.open.click();
  await flush();
  assert.equal(f.slider.value, '40');
  assert.deepEqual(f.presets.map(button => button.getAttribute('aria-pressed')), ['true', 'false', 'false', 'false', 'false', 'false']);
});

test('visibility and reduced-effects behavior remains event-driven and cleans up on pagehide', async t => {
  const f = fixture(t, { reduced: true });
  const unmount = mountStudio(f.element, f.initialize);
  t.after(unmount);
  f.open.click();
  await flush();
  const renderer = f.renderers[0];
  assert.equal(renderer.settings.antialias, false);
  assert.equal(renderer.pixelRatio, 1.5);
  f.observers[0].callback([{ isIntersecting: false }]);
  const count = renderer.renders;
  f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(renderer.renders, count);
  f.observers[0].callback([{ isIntersecting: true }]);
  assert.equal(renderer.renders, count + 1);
  f.doc.visibilityState = 'hidden';
  f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(renderer.renders, count + 1);
  f.doc.visibilityState = 'visible';
  f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(renderer.renders, count + 2);
  f.doc.defaultView.dispatchEvent(new Event('pagehide'));
  assertClosed(f);
  assert.equal(renderer.disposed, 1);
  f.open.click();
  await flush();
  assert.equal(f.renderers.length, 2, 'returning from the back-forward cache may reopen the studio');
});

test('remounting removes the prior open/close handlers', async t => {
  const f = fixture(t);
  const firstUnmount = mountStudio(f.element, f.initialize);
  const unmount = mountStudio(f.element, f.initialize);
  t.after(unmount);
  f.open.click();
  await flush();
  assert.equal(f.renderers.length, 1);
  firstUnmount();
  assert.equal(f.stage.children.length, 1, 'an obsolete cleanup must not clear a later mount');
  assert.equal(f.controls.hidden, false);
  f.close.click();
  assert.equal(f.renderers[0].disposed, 1);
  f.open.click();
  await flush();
  assert.equal(f.renderers.length, 2);
});
