import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile('src/pages/projects/index.astro', 'utf8');
const script = source.match(/<script is:inline data-project-explorer-script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'test the actual shipped progressive-enhancement script');

class Element {
  dataset: Record<string, string>;
  attributes: Record<string, string> = {};
  handlers = new Map<string, () => void>();
  hidden = false;
  open = false;
  focused = false;
  textContent = '';
  id = '';
  cards: Element[] = [];
  constructor(dataset: Record<string, string> = {}) { this.dataset = dataset; }
  setAttribute(key: string, value: string) { this.attributes[key] = value; }
  addEventListener(event: string, callback: () => void) { this.handlers.set(event, callback); }
  querySelectorAll() { return this.cards; }
  click() { this.handlers.get('click')?.(); }
  focus() { this.focused = true; }
}

function setup(path = '/projects/', categories = ['hotels', 'hotels', 'homes-heritage', 'retail-design', 'retail-design'], brokenHistory = false) {
  let url = new URL(path, 'https://www.mrwallcover.com');
  const controls = new Element(); controls.hidden = true;
  const count = new Element();
  const empty = new Element(); empty.hidden = true;
  const reset = new Element();
  const hotelRecord = new Element();
  const buttons = [
    ['all', 'All projects'], ['hotels', 'Hotels'], ['homes-heritage', 'Homes & heritage'], ['retail-design', 'Retail & design'],
  ].map(([id, label]) => new Element({ projectFilter: id, filterLabel: label }));
  const cards = categories.map((category) => new Element({ projectCategory: category }));
  const groups = ['hotels-homes', 'design-weeks'].map((id) => { const group = new Element(); group.id = id; return group; });
  groups[0].cards = cards.filter((card) => card.dataset.projectCategory !== 'retail-design');
  groups[1].cards = cards.filter((card) => card.dataset.projectCategory === 'retail-design');
  const selectors: Record<string, Element> = {
    '[data-project-controls]': controls, '[data-project-count]': count,
    '[data-project-empty]': empty, '[data-project-reset]': reset, '[data-hotel-record]': hotelRecord,
  };
  const collections: Record<string, Element[]> = {
    '[data-project-filter]': buttons, '[data-project-card]': cards, '[data-project-group]': groups,
  };
  const listeners = new Map<string, () => void>();
  const root = { querySelector: (selector: string) => selectors[selector], querySelectorAll: (selector: string) => collections[selector] };
  const window = {
    location: { get href() { return url.href; }, get hash() { return url.hash; } },
    history: { replaceState: (_state: unknown, _title: string, next: URL) => { if (brokenHistory) throw new Error('unavailable'); url = new URL(next); } },
    addEventListener: (event: string, callback: () => void) => listeners.set(event, callback),
  };
  runInNewContext(script!, { document: { querySelector: () => root }, window, URL });
  return {
    controls, count, empty, reset, hotelRecord, buttons, cards, groups,
    url: () => url,
    visible: () => cards.filter((card) => !card.hidden).map((card) => card.dataset.projectCategory),
    navigate: (path: string, event: 'popstate' | 'hashchange') => { url = new URL(path, url); listeners.get(event)?.(); },
  };
}

test('project filters initialise from a bookmark and distinguish hotel venues from hotel work', () => {
  const ui = setup('/projects/?sector=hotels');
  assert.equal(ui.controls.hidden, false);
  assert.deepEqual(ui.visible(), ['hotels', 'hotels']);
  assert.equal(ui.groups[1].hidden, true);
  assert.equal(ui.buttons[1].attributes['aria-pressed'], 'true');
  assert.equal(ui.buttons.filter((button) => button.attributes['aria-pressed'] === 'true').length, 1);
  assert.equal(ui.count.textContent, 'Showing 2 projects · Hotels');
  assert.equal(ui.empty.hidden, true);
  ui.buttons[3].click();
  assert.deepEqual(ui.visible(), ['retail-design', 'retail-design']);
  assert.equal(ui.url().searchParams.get('sector'), 'retail-design');
});

test('an unknown sector safely shows all projects; a real filter preserves unrelated URL parameters', () => {
  const ui = setup('/projects/?sector=unrecognised&utm_source=portfolio');
  assert.equal(ui.visible().length, 5);
  assert.equal(ui.buttons[0].attributes['aria-pressed'], 'true');
  ui.buttons[2].click();
  assert.equal(ui.count.textContent, 'Showing 1 project · Homes & heritage');
  assert.equal(ui.url().searchParams.get('utm_source'), 'portfolio');
  ui.buttons[0].click();
  assert.equal(ui.url().searchParams.has('sector'), false);
  assert.equal(ui.visible().length, 5);
});

test('empty results offer reset and restore keyboard focus to All projects', () => {
  const ui = setup('/projects/?sector=homes-heritage', ['hotels']);
  assert.equal(ui.visible().length, 0);
  assert.equal(ui.empty.hidden, false);
  assert.equal(ui.count.textContent, 'Showing 0 projects · Homes & heritage');
  ui.reset.click();
  assert.deepEqual(ui.visible(), ['hotels']);
  assert.equal(ui.empty.hidden, true);
  assert.equal(ui.buttons[0].focused, true);
});

test('existing design-weeks and hotel anchors remain reachable with an active filter', () => {
  const ui = setup('/projects/?sector=hotels#design-weeks');
  assert.equal(ui.groups[1].hidden, false, 'a targeted section is never hidden');
  assert.equal(ui.url().hash, '#design-weeks');
  assert.equal(ui.url().searchParams.has('sector'), false);
  ui.buttons[1].click();
  assert.equal(ui.url().hash, '', 'remove a hash that the chosen filter would hide');
  ui.navigate('/projects/?sector=hotels#hotels', 'hashchange');
  assert.equal(ui.hotelRecord.open, true);
  assert.deepEqual(ui.visible(), ['hotels', 'hotels']);
});

test('Back/Forward restores the URL selection and a history failure does not disable filtering', () => {
  const ui = setup('/projects/');
  ui.navigate('/projects/?sector=homes-heritage', 'popstate');
  assert.deepEqual(ui.visible(), ['homes-heritage']);
  ui.navigate('/projects/?sector=retail-design', 'popstate');
  assert.deepEqual(ui.visible(), ['retail-design', 'retail-design']);
  const restricted = setup('/projects/', undefined, true);
  assert.doesNotThrow(() => restricted.buttons[1].click());
  assert.deepEqual(restricted.visible(), ['hotels', 'hotels']);
});

test('static content remains available without the enhancement script', () => {
  assert.match(source, /data-project-controls hidden/);
  assert.doesNotMatch(source.match(/<article class="work-item"[^>]+>/)![0], /\bhidden\b/);
  assert.match(source, /<details id="hotels"/);
  assert.match(source, /hotels\.map\(\(hotel\)/);
  assert.match(source, /role="status" aria-live="polite" aria-atomic="true"/);
});
