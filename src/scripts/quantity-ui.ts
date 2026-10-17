import { sanitiseEvent } from '../lib/enquiry';
import { maker, materialsFor, wallpapering } from '../lib/materials';
import { calculate, closeCall, plural, type Bespoke, type Match, type OpeningInput, type PlanResult, type QuantityInput, type QuantityResult } from '../lib/quantity';
import { CM_PER, convert, formatGroups, soldByFor, toCm, type LengthUnit, type WidthUnit } from '../lib/roll-formats';

/**
 * The calculator on /calculator/ (spec: docs/calculator/spec.md). Without JavaScript the page points to the
 * guide at /advice/quantities/. With it, three steps give working rolls, a spare on its own line, the order, the cutting plan
 * and the materials. Inputs can be shared as a link and printed; nothing is stored except, when the visitor
 * follows "Send us your measurements", a plain-text brief in this tab for the enquiry form.
 */

const BRIEF_KEY = 'mw-quantity-brief';
const MATCH_LABEL: Record<Match, string> = { free: 'free match', reverse: 'reverse hang', straight: 'straight match', half: 'half-drop', third: 'third drop', quarter: 'quarter drop' };
const KIND_LABEL: Record<string, string> = { above: 'short drop above an opening', below: 'short drop below a window', part: 'reveal part-drop', back: 'niche back' };
const LINK_MAKERS: [RegExp, string][] = [
  [/(^|\.)cole-and-son\.com$/, 'cole-and-son'],
  [/(^|\.)degournay\.com$/, 'de-gournay'],
  [/(^|\.)farrow-ball\.com$/, 'farrow-and-ball'],
  [/(^|\.)fromental\.(com|co\.uk)$/, 'fromental'],
  [/(^|\.)grahambrown\.com$/, 'graham-and-brown'],
  [/(^|\.)muraspec\.com$/, 'muraspec'],
  [/(^|\.)phillipjeffries\.com$/, 'phillip-jeffries'],
];

function track(name: string, detail: Record<string, unknown>) {
  const sink = (window as unknown as { __mwTrack?: (event: string, payload: Record<string, unknown>) => void }).__mwTrack;
  if (typeof sink === 'function') sink(name, sanitiseEvent(detail));
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const fmt = (cm: number) => (Number.isInteger(cm) ? String(cm) : cm.toFixed(1).replace(/\.0$/, ''));
const fmtM = (m: number) => String(Math.round(m * 100) / 100);
const BESPOKE_LABEL: Record<string, string> = { stairs: 'a stairwell', slope: 'a sloping wall or ceiling', curved: 'a curved wall', ceiling: 'the ceiling' };

const form = document.querySelector<HTMLFormElement>('[data-quantity]');
const output = document.querySelector<HTMLElement>('[data-quantity-output]');

if (form && output) {
  const $ = <T extends Element>(selector: string) => form.querySelector<T>(selector)!;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
  const value = (name: string) => (field(name)?.value ?? '').trim();
  const num = (input: HTMLInputElement | HTMLSelectElement | null) => (input && input.value.trim() !== '' ? Number(input.value) : NaN);
  const formatSelect = $<HTMLSelectElement>('[name="format"]');
  const makerSelect = $<HTMLSelectElement>('[name="maker"]');
  const wallsBox = $<HTMLElement>('[data-walls]');
  const roomBox = $<HTMLElement>('[data-room]');
  const addWall = $<HTMLButtonElement>('[data-add-wall]');
  const openingsBox = $<HTMLElement>('[data-openings]');
  const returnsBox = $<HTMLElement>('[data-returns]');
  const more = $<HTMLDetailsElement>('[data-more]');
  const linkNote = $<HTMLElement>('[data-link-note]');
  const openingTemplate = document.querySelector<HTMLTemplateElement>('[data-opening-template]')!;
  const returnTemplate = document.querySelector<HTMLTemplateElement>('[data-return-template]')!;
  const measure = () => (form.querySelector<HTMLInputElement>('[name="measure"]:checked')?.value ?? 'wall') as 'wall' | 'walls' | 'room';
  const formatOption = () => formatSelect.selectedOptions[0];
  const formatGroup = () => formatGroups.find((group) => group.id === formatOption()?.dataset.group) ?? formatGroups[0];
  const soldKind = () => formatGroup().soldBy;
  const widthUnit = () => value('widthUnit') as WidthUnit;
  const lengthUnit = () => value('lengthUnit') as LengthUnit;
  const widthList = $<HTMLDataListElement>('#qc-widths');
  type Unit = keyof typeof CM_PER;
  type Dim = 'measure' | 'small' | 'pwidth' | 'plength' | 'repeat';
  // Walls, rooms and openings are in the unit they were measured in; small sizes (reveals, returns, trims,
  // the mural margin) in centimetres or inches to match. The paper's sizes are in the units printed on it.
  const measureUnit = () => (form.querySelector<HTMLInputElement>('[name="mu"]:checked')?.value ?? 'cm') as 'cm' | 'm' | 'in' | 'ft';
  const smallFor = (mu: string): Unit => (mu === 'in' || mu === 'ft' ? 'in' : 'cm');
  const repeatUnit = () => value('repeatUnit') as WidthUnit;
  const unitFor = (dim: Dim): Unit => dim === 'measure' ? measureUnit() : dim === 'small' ? smallFor(measureUnit()) : dim === 'pwidth' ? widthUnit() : dim === 'plength' ? lengthUnit() : repeatUnit();
  const imperial = () => ['in', 'ft'].includes(measureUnit()) || widthUnit() === 'in' || repeatUnit() === 'in';
  /** A measurement in centimetres, whatever unit it was typed in. */
  const cm = (input: Element | null) => {
    const box = input as HTMLInputElement | null;
    if (box?.dataset.exactCm && box.dataset.shown === box.value) return Math.round(Number(box.dataset.exactCm) * 100) / 100;
    const raw = num(box);
    const dim = (input as HTMLElement | null)?.dataset.dim as Dim | undefined;
    return dim ? Math.round(raw * CM_PER[unitFor(dim)] * 100) / 100 : raw;
  };
  const fmtCm = (v: number) => (v >= 1000 ? `${fmtM(v / 100)} m` : `${fmt(Math.round(v * 10) / 10)} cm`);
  /** Feet and inches to the nearest quarter inch, for a length in centimetres: 280 cm is 9 ft 2¼ in. */
  const ftIn = (v: number) => {
    const quarters = Math.round((v / 2.54) * 4);
    const ft = Math.floor(quarters / 48);
    const rest = quarters - ft * 48;
    const inches = Math.floor(rest / 4);
    const frac = ['', '¼', '½', '¾'][rest % 4];
    const inPart = `${inches || !frac ? inches : ''}${frac} in`;
    return ft ? `${ft} ft ${inPart}` : inPart;
  };
  // Under every size not typed in centimetres (or metres, for a roll length), its value in centimetres.
  const syncUnits = () => {
    form.querySelectorAll<HTMLElement>('[data-u]').forEach((span) => (span.textContent = unitFor(span.dataset.u as Dim)));
    form.querySelectorAll<HTMLInputElement>('input[data-dim]').forEach((input) => {
      const dim = input.dataset.dim as Dim;
      const unit = unitFor(dim);
      const anchor = input.closest('.qc-unit') ?? input;
      let hint = anchor.nextElementSibling?.classList.contains('qc-cm') ? (anchor.nextElementSibling as HTMLElement) : null;
      const metricAlready = unit === 'cm' || (dim === 'plength' && unit === 'm');
      const v = num(input);
      if (metricAlready || !(v > 0)) {
        hint?.remove();
        return;
      }
      if (!hint) {
        hint = el('span', '', 'qc-cm');
        anchor.after(hint);
      }
      const c = v * CM_PER[unit];
      hint.textContent = dim === 'plength' ? `= ${fmtM(c / 100)} m` : `= ${fmtCm(c)}`;
    });
  };
  // Changing a unit keeps the size: the number is converted. The exact size is remembered until the visitor
  // types over it, so switching back and forth never drifts (400 cm stays 400 cm).
  const reunit = (input: HTMLInputElement, from: Unit, to: Unit) => {
    if (input.value.trim() === '' || from === to) return;
    const exact = input.dataset.shown === input.value && input.dataset.exactCm ? Number(input.dataset.exactCm) : Number(input.value) * CM_PER[from];
    input.value = String(convert(exact, 'cm', to));
    input.dataset.exactCm = String(exact);
    input.dataset.shown = input.value;
  };
  const convertAll = (dims: Dim[], from: (dim: Dim) => Unit, to: (dim: Dim) => Unit) => {
    form.querySelectorAll<HTMLInputElement>('input[data-dim]').forEach((input) => {
      const dim = input.dataset.dim as Dim;
      if (dims.includes(dim)) reunit(input, from(dim), to(dim));
    });
  };
  let lastMeasure = 'cm';
  // The wall question counts as answered only once the visitor changes it (or a shared link carries it).
  let conditionAnswered = false;

  /* ---------- step 1: the paper ---------- */

  // The width suggestions follow the unit: centimetres or inches.
  const syncWidthList = () => {
    const values = (widthList.dataset[widthUnit()] ?? '').split(' ').filter(Boolean);
    widthList.replaceChildren(...values.map((v) => Object.assign(document.createElement('option'), { value: v })));
    for (const select of form.querySelectorAll<HTMLSelectElement>('[name="widthUnit"], [name="lengthUnit"]')) select.dataset.was = select.value;
  };
  const syncFormat = (fill: boolean) => {
    const option = formatOption();
    const kind = soldKind();
    if (fill && Number(option.dataset.width) > 0) {
      (field('rollWidth') as HTMLInputElement).value = option.dataset.width!;
      (field('widthUnit') as HTMLSelectElement).value = option.dataset.wunit ?? 'cm';
      (field('rollLength') as HTMLInputElement).value = option.dataset.length ?? '';
      (field('lengthUnit') as HTMLSelectElement).value = option.dataset.lunit ?? 'm';
      (field('overlap') as HTMLInputElement).value = String(option.dataset.wunit === 'in' ? convert(Number(option.dataset.overlap ?? 0), 'cm', 'in') : Number(option.dataset.overlap ?? 0));
      if (option.dataset.sets) (field('rollsPerSet') as HTMLInputElement).value = option.dataset.sets;
      const printed = (option.dataset.wunit ?? 'cm') as WidthUnit;
      const repeatSelect = field('repeatUnit') as HTMLSelectElement;
      if (repeatSelect.value !== printed) {
        const repeat = field('repeat') as HTMLInputElement;
        reunit(repeat, repeatSelect.value as WidthUnit, printed);
        repeatSelect.value = printed;
      }
    }
    const sizeless = kind === 'mural' || kind === 'panel-set';
    form.querySelectorAll<HTMLElement>('[data-paper-size]').forEach((box) => (box.hidden = sizeless));
    $<HTMLElement>('[data-mural-field]').hidden = kind !== 'mural';
    $<HTMLElement>('[data-overlap-field]').hidden = kind !== 'length';
    $<HTMLElement>('[data-set-field]').hidden = kind !== 'set';
    const lengthLabel = form.querySelector('label[for="qc-roll-length"]');
    if (lengthLabel) lengthLabel.textContent = kind === 'length' ? 'Longest piece supplied' : kind === 'bolt' ? 'Bolt length' : kind === 'double-roll' ? 'Double roll length' : 'Roll length';
    syncWidthList();
    syncUnits();
  };
  // A size typed over a preset is no longer that preset: the list moves to "Another size" in the same group.
  const toOther = () => {
    const option = formatOption();
    if (option.dataset.other || !option.dataset.width) return;
    const other = [...formatSelect.options].find((item) => item.dataset.other && item.dataset.group === option.dataset.group);
    if (other) formatSelect.value = other.value;
  };
  const changeUnit = (select: HTMLSelectElement, input: HTMLInputElement) => {
    const from = (select.dataset.was ?? select.value) as WidthUnit | LengthUnit;
    const to = select.value as WidthUnit | LengthUnit;
    // The same size in another unit: the preset still holds.
    reunit(input, from, to);
    // The overlap is part of the width, so it follows the width's unit.
    if (select.name === 'widthUnit') reunit(field('overlap') as HTMLInputElement, from, to);
    syncWidthList();
    syncUnits();
  };
  const syncMatch = () => {
    const free = ['free', 'reverse'].includes(value('match'));
    $<HTMLElement>('[data-repeat-field]').hidden = free || ['mural', 'panel-set'].includes(soldKind());
  };
  const readLink = () => {
    const raw = value('link');
    linkNote.hidden = true;
    if (!raw) return;
    try {
      const host = new URL(raw).hostname.replace(/^www\./, '');
      const found = LINK_MAKERS.find(([pattern]) => pattern.test(host));
      if (found && maker(found[1])) {
        makerSelect.value = found[1];
        linkNote.textContent = `${maker(found[1])!.name}: its hanging instructions are applied. Type the roll size, repeat and match from that page.`;
      } else {
        linkNote.textContent = 'We will add the link to your enquiry. Type the roll size, repeat and match from that page.';
      }
      linkNote.hidden = false;
    } catch {
      linkNote.textContent = 'That does not look like a web address. Paste the full link, starting https://';
      linkNote.hidden = false;
    }
  };

  /* ---------- step 2: walls or room ---------- */

  const wallRows = () => [...wallsBox.querySelectorAll<HTMLElement>('[data-wall]')];
  const labelWalls = () => {
    const many = measure() === 'walls';
    wallRows().forEach((row, index) => {
      row.querySelectorAll('label').forEach((label) => {
        const input = label.querySelector('input')!;
        const base = input.name === 'width' ? 'width' : 'Height to paper';
        label.firstChild!.textContent = many ? `Wall ${index + 1} ${base === 'width' ? 'width' : 'height to paper'}, ` : `${base === 'width' ? 'Wall width' : 'Height to paper'}, `;
      });
      row.querySelector('[data-remove]')?.toggleAttribute('hidden', !many || index === 0);
    });
    syncWallChoices();
  };
  const addWallRow = (width = '', height = '') => {
    const row = wallRows()[0].cloneNode(true) as HTMLElement;
    row.querySelectorAll('input').forEach((input) => (input.value = ''));
    (row.querySelector('[name="width"]') as HTMLInputElement).value = width;
    (row.querySelector('[name="height"]') as HTMLInputElement).value = height || (wallRows()[0].querySelector('[name="height"]') as HTMLInputElement).value;
    if (!row.querySelector('[data-remove]')) {
      const remove = el('button', 'Remove', 'btn btn-line justify-self-start');
      remove.type = 'button';
      remove.dataset.remove = '';
      row.append(remove);
    }
    wallsBox.append(row);
    labelWalls();
    return row;
  };
  const syncMeasure = () => {
    const mode = measure();
    roomBox.hidden = mode !== 'room';
    wallsBox.hidden = mode === 'room';
    addWall.hidden = mode !== 'walls';
    if (mode === 'wall') wallRows().slice(1).forEach((row) => row.remove());
    else if (mode === 'walls' && wallRows().length < 2) addWallRow();
    labelWalls();
  };
  const syncWallChoices = () => {
    const count = measure() === 'walls' ? wallRows().length : 1;
    form.querySelectorAll<HTMLElement>('[data-opening], [data-return]').forEach((row) => {
      const box = row.querySelector<HTMLElement>('[data-opening-wall], [data-return-wall]')!;
      const select = box.querySelector('select')!;
      const current = select.value || '1';
      select.replaceChildren(...Array.from({ length: count }, (_, i) => {
        const option = el('option', `Wall ${i + 1}`);
        option.value = String(i + 1);
        return option;
      }));
      select.value = Number(current) <= count ? current : '1';
      box.hidden = count < 2;
    });
  };

  /* ---------- step 3: openings, returns, the wall ---------- */

  const addOpening = (kind: OpeningInput['kind'], values: Partial<Record<string, string>> = {}) => {
    const row = openingTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
    row.dataset.kind = kind;
    row.querySelector('[data-opening-title]')!.textContent = kind === 'door' ? 'Door' : kind === 'window' ? 'Window' : 'Niche';
    const floor = row.querySelector<HTMLElement>('[data-from-floor]')!;
    floor.hidden = kind === 'door';
    floor.querySelector('[data-from-floor-label]')!.textContent = kind === 'niche' ? 'Bottom of the niche above the skirting' : 'Sill above the skirting';
    row.querySelector<HTMLElement>('[data-reveals]')!.hidden = kind === 'niche';
    for (const [name, v] of Object.entries(values)) {
      const input = row.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
      if (input && v !== undefined) input.value = v;
    }
    openingsBox.append(row);
    syncWallChoices();
    syncUnits();
    if (values['o-wall']) (row.querySelector('[name="o-wall"]') as HTMLSelectElement).value = values['o-wall'];
    return row;
  };
  const addReturn = (values: Partial<Record<string, string>> = {}) => {
    const row = returnTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
    returnsBox.append(row);
    syncWallChoices();
    syncUnits();
    for (const [name, v] of Object.entries(values)) {
      const input = row.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
      if (input && v !== undefined) input.value = v;
    }
    return row;
  };

  /* ---------- reading the form ---------- */

  type Read = { input: QuantityInput; problems: string[]; makerId: string; condition: string; link: string };

  const read = (): Read => {
    const problems: string[] = [];
    const kind = soldKind();
    const match = (['mural', 'panel-set'].includes(kind) ? 'free' : value('match')) as Match;
    const soldBy = soldByFor(formatGroup(), { rollsPerSet: num(field('rollsPerSet')), marginCm: cm(field('margin')) || 0 });
    const makerId = makerSelect.value;
    const rule = makerId ? maker(makerId) : undefined;
    const overlapCm = kind === 'length' ? cm(field('overlap')) || 0 : 0;
    const nominalCm = cm(field('rollWidth'));
    if (overlapCm < 0 || (overlapCm > 0 && overlapCm >= nominalCm)) problems.push('The overlap must be less than the width, and not below zero.');
    const paper: QuantityInput['paper'] = {
      widthCm: Math.round((nominalCm - overlapCm) * 100) / 100,
      lengthCm: cm(field('rollLength')),
      repeatCm: ['free', 'reverse'].includes(match) ? 0 : cm(field('repeat')),
      match,
      soldBy,
      trimTopCm: cm(field('trimTop')),
      trimBottomCm: cm(field('trimBottom')),
      noOffcutInfill: Boolean(rule?.noOffcutInfill),
    };
    const openingsByWall = new Map<number, OpeningInput[]>();
    for (const row of openingsBox.querySelectorAll<HTMLElement>('[data-opening]')) {
      const wall = Number((row.querySelector('[name="o-wall"]') as HTMLSelectElement).value || 1);
      const k = row.dataset.kind as OpeningInput['kind'];
      const opening: OpeningInput = {
        kind: k,
        widthCm: cm(row.querySelector('[name="o-width"]')),
        heightCm: cm(row.querySelector('[name="o-height"]')),
        fromFloorCm: k === 'door' ? 0 : cm(row.querySelector('[name="o-floor"]')),
        depthCm: cm(row.querySelector('[name="o-depth"]')) || 0,
        reveals: k === 'niche' ? undefined : ((row.querySelector('[name="o-reveals"]') as HTMLSelectElement).value as OpeningInput['reveals']),
      };
      if (!(opening.widthCm > 0) || !(opening.heightCm > 0) || (k !== 'door' && !(opening.fromFloorCm! >= 0))) problems.push(`Fill in the ${k}'s width, height${k === 'door' ? '' : ' and height above the skirting'}, or remove it.`);
      openingsByWall.set(wall, [...(openingsByWall.get(wall) ?? []), opening]);
    }
    const returnsByWall = new Map<number, number[]>();
    for (const row of returnsBox.querySelectorAll<HTMLElement>('[data-return]')) {
      const depth = cm(row.querySelector('[name="r-depth"]'));
      if (!(depth > 0)) continue;
      const wall = Number((row.querySelector('[name="r-wall"]') as HTMLSelectElement).value || 1);
      returnsByWall.set(wall, [...(returnsByWall.get(wall) ?? []), depth]);
    }
    const bespoke = [...form.querySelectorAll<HTMLInputElement>('[name="bespoke"]:checked')].map((box) => box.value as Bespoke);
    const input: QuantityInput = { paper, bespoke };
    const tooSmall = (v: number) => v > 0 && v < 20;
    const unitHelp = (what: string) => ({
      cm: `Enter the ${what} in centimetres: 2.7 m is 270 cm.`,
      m: `Enter the ${what} in metres, for example 2.7.`,
      in: `Enter the ${what} in inches, for example 106.`,
      ft: `Enter the ${what} in feet, for example 8.9.`,
    })[measureUnit()];
    if (measure() === 'room') {
      input.room = { lengthCm: cm(field('roomLength')), widthCm: cm(field('roomWidth')), heightCm: cm(field('roomHeight')), returnsCm: returnsByWall.get(1), openings: openingsByWall.get(1) };
      if ([input.room.lengthCm, input.room.widthCm, input.room.heightCm].some(tooSmall)) problems.push(unitHelp('room'));
    } else {
      input.walls = wallRows().map((row, index) => ({
        widthCm: cm(row.querySelector('[name="width"]')),
        heightCm: cm(row.querySelector('[name="height"]')),
        returnsCm: returnsByWall.get(index + 1),
        openings: openingsByWall.get(index + 1),
      }));
      if (input.walls.some((wall) => tooSmall(wall.widthCm) || tooSmall(wall.heightCm))) problems.push(unitHelp('wall'));
    }
    if (tooSmall(paper.widthCm) && !['mural', 'panel-set'].includes(kind)) problems.push(widthUnit() === 'in' ? 'Enter the roll width in inches, for example 20.5 or 27.' : 'Enter the roll width in centimetres: 0.53 m is 53 cm.');
    return { input, problems, makerId, condition: conditionAnswered ? value('condition') : '', link: value('link') };
  };

  /* ---------- sharing ---------- */

  const toQuery = (): string => {
    const q = new URLSearchParams();
    q.set('f', formatSelect.value);
    if (makerSelect.value) q.set('mk', makerSelect.value);
    q.set('rw', value('rollWidth'));
    q.set('rl', value('rollLength'));
    if (widthUnit() !== 'cm') q.set('wu', widthUnit());
    if (lengthUnit() !== 'm') q.set('lu', lengthUnit());
    if (soldKind() === 'length' && value('overlap') && value('overlap') !== '0') q.set('ov', value('overlap'));
    if (soldKind() === 'set') q.set('rs', value('rollsPerSet'));
    if (repeatUnit() !== 'cm') q.set('ru', repeatUnit());
    if (measureUnit() !== 'cm') q.set('mu', measureUnit());
    q.set('m', value('match'));
    if (value('repeat') && value('repeat') !== '0') q.set('r', value('repeat'));
    if (soldKind() === 'mural') q.set('mg', value('margin'));
    q.set('ms', measure());
    if (measure() === 'room') q.set('rm', [value('roomLength'), value('roomWidth'), value('roomHeight')].join('x'));
    else q.set('w', wallRows().map((row) => `${(row.querySelector('[name="width"]') as HTMLInputElement).value}x${(row.querySelector('[name="height"]') as HTMLInputElement).value}`).join(','));
    const openings = [...openingsBox.querySelectorAll<HTMLElement>('[data-opening]')].map((row) => [row.dataset.kind, ...['o-wall', 'o-width', 'o-height', 'o-floor', 'o-depth', 'o-reveals'].map((name) => (row.querySelector(`[name="${name}"]`) as HTMLInputElement).value)].join(':'));
    if (openings.length) q.set('o', openings.join(';'));
    const returns = [...returnsBox.querySelectorAll<HTMLElement>('[data-return]')].map((row) => `${(row.querySelector('[name="r-wall"]') as HTMLSelectElement).value}:${(row.querySelector('[name="r-depth"]') as HTMLInputElement).value}`);
    if (returns.length) q.set('rt', returns.join(';'));
    if (conditionAnswered) q.set('c', value('condition'));
    const bespoke = [...form.querySelectorAll<HTMLInputElement>('[name="bespoke"]:checked')].map((box) => box.value);
    if (bespoke.length) q.set('b', bespoke.join(','));
    if (value('trimTop') !== '5') q.set('tt', value('trimTop'));
    if (value('trimBottom') !== '5') q.set('tb', value('trimBottom'));
    return q.toString();
  };
  const fromQuery = (q: URLSearchParams): boolean => {
    if (!q.has('w') && !q.has('rm')) return false;
    const set = (name: string, v: string | null) => {
      const input = field(name);
      if (input && v !== null) input.value = v;
    };
    const f = q.get('f') === 'custom' ? 'other-roll' : q.get('f');
    if (f && [...formatSelect.options].some((option) => option.value === f)) formatSelect.value = f;
    syncFormat(false);
    if (q.get('mk') && maker(q.get('mk')!)) makerSelect.value = q.get('mk')!;
    set('rollWidth', q.get('rw'));
    set('rollLength', q.get('rl'));
    if (q.get('wu') === 'in') set('widthUnit', 'in');
    if (['ft', 'yd'].includes(q.get('lu') ?? '')) set('lengthUnit', q.get('lu'));
    set('overlap', q.get('ov'));
    set('rollsPerSet', q.get('rs'));
    if (q.get('ru') === 'in') set('repeatUnit', 'in');
    const mu = form.querySelector<HTMLInputElement>(`[name="mu"][value="${q.get('mu') ?? 'cm'}"]`);
    if (mu) {
      mu.checked = true;
      lastMeasure = mu.value;
    }
    syncWidthList();
    set('match', q.get('m'));
    set('repeat', q.get('r') ?? '0');
    set('margin', q.get('mg'));
    const mode = q.get('ms') === 'room' ? 'room' : q.get('ms') === 'walls' ? 'walls' : 'wall';
    form.querySelector<HTMLInputElement>(`[name="measure"][value="${mode}"]`)!.checked = true;
    syncMeasure();
    if (mode === 'room') {
      const [l, w, h] = (q.get('rm') ?? '').split('x');
      set('roomLength', l);
      set('roomWidth', w);
      set('roomHeight', h);
    } else {
      const walls = (q.get('w') ?? '').split(',').filter(Boolean).map((pair) => pair.split('x'));
      wallRows().slice(1).forEach((row) => row.remove());
      const first = wallRows()[0];
      if (walls[0]) {
        (first.querySelector('[name="width"]') as HTMLInputElement).value = walls[0][0] ?? '';
        (first.querySelector('[name="height"]') as HTMLInputElement).value = walls[0][1] ?? '';
      }
      for (const pair of walls.slice(1)) addWallRow(pair[0] ?? '', pair[1] ?? '');
      labelWalls();
    }
    for (const item of (q.get('o') ?? '').split(';').filter(Boolean)) {
      const [kind, wall, width, height, floor, depth, reveals] = item.split(':');
      if (!['door', 'window', 'niche'].includes(kind)) continue;
      addOpening(kind as OpeningInput['kind'], { 'o-wall': wall, 'o-width': width, 'o-height': height, 'o-floor': floor, 'o-depth': depth, 'o-reveals': reveals || 'none' });
    }
    for (const item of (q.get('rt') ?? '').split(';').filter(Boolean)) {
      const [wall, depth] = item.split(':');
      addReturn({ 'r-wall': wall, 'r-depth': depth });
    }
    if (q.get('c')) {
      set('condition', q.get('c'));
      conditionAnswered = true;
    }
    for (const v of (q.get('b') ?? '').split(',').filter(Boolean)) {
      const box = form.querySelector<HTMLInputElement>(`[name="bespoke"][value="${v}"]`);
      if (box) box.checked = true;
    }
    set('trimTop', q.get('tt'));
    set('trimBottom', q.get('tb'));
    if (q.has('o') || q.has('rt') || q.has('c') || q.has('b') || q.has('tt') || q.has('tb')) more.open = true;
    syncMatch();
    syncUnits();
    return true;
  };

  /* ---------- the result ---------- */

  const describeInputs = (state: Read): string[] => {
    const lines: string[] = [];
    const { paper } = state.input;
    const rule = state.makerId ? maker(state.makerId) : undefined;
    const kind = soldKind();
    lines.push(`Wallpaper: ${rule ? rule.name : 'maker not given'}${state.link ? ` (${state.link})` : ''}.`);
    if (!['mural', 'panel-set'].includes(kind)) {
      const overlap = kind === 'length' ? Number(value('overlap')) || 0 : 0;
      const width = `${value('rollWidth')} ${widthUnit()}${widthUnit() === 'in' ? ` (${fmt(toCm(Number(value('rollWidth')), 'in'))} cm)` : ''}${overlap ? `, overlapped ${value('overlap')} ${widthUnit()}, so ${fmt(paper.widthCm)} cm usable` : ''}`;
      const length = value('rollLength') ? ` × ${value('rollLength')} ${lengthUnit()}` : '';
      const sold = kind === 'set' ? `, sold in sets of ${value('rollsPerSet')}` : kind === 'length' ? `, sold by the ${formatGroup().unit === 'yd' ? 'yard' : 'metre'}` : kind === 'double-roll' ? ', US double rolls' : kind === 'bolt' ? ', bolts' : '';
      const repeat = paper.repeatCm ? `, repeat ${repeatUnit() === 'in' ? `${value('repeat')} in (${fmt(paper.repeatCm)} cm)` : `${fmt(paper.repeatCm)} cm`}` : '';
      lines.push(`Roll: ${width}${length}${sold}, ${MATCH_LABEL[paper.match]}${repeat}.`);
    }
    else lines.push(`Format: ${formatOption().textContent}.`);
    if (measureUnit() !== 'cm') lines.push(`Measured in ${({ m: 'metres', in: 'inches', ft: 'feet' } as Record<string, string>)[measureUnit()]}; every size below is in centimetres.`);
    if (state.input.room) lines.push(`Room: ${fmt(state.input.room.lengthCm)} × ${fmt(state.input.room.widthCm)} cm, height to paper ${fmt(state.input.room.heightCm)} cm.`);
    state.input.walls?.forEach((wall, index) => lines.push(`Wall${(state.input.walls?.length ?? 0) > 1 ? ` ${index + 1}` : ''}: ${fmt(wall.widthCm)} cm wide, height to paper ${fmt(wall.heightCm)} cm.`));
    const all = [...(state.input.room ? [state.input.room] : state.input.walls ?? [])];
    all.forEach((wall, index) => {
      for (const o of wall.openings ?? []) lines.push(`${o.kind[0].toUpperCase()}${o.kind.slice(1)}${all.length > 1 ? ` on wall ${index + 1}` : ''}: ${fmt(o.widthCm)} × ${fmt(o.heightCm)} cm${o.kind !== 'door' ? `, ${fmt(o.fromFloorCm ?? 0)} cm above the skirting` : ''}${o.depthCm ? `, reveals ${fmt(o.depthCm)} cm deep (${o.kind === 'niche' ? 'all round' : o.reveals === 'sides-head' ? 'sides and head' : o.reveals === 'sides' ? 'sides' : 'not papered'})` : ''}.`);
      if (wall.returnsCm?.length) lines.push(`Returns${all.length > 1 ? ` on wall ${index + 1}` : ''}: ${wall.returnsCm.map((depth) => `${fmt(depth)} cm`).join(', ')}.`);
    });
    const option = wallpapering.conditionQuestion.options.find((item) => item.id === state.condition);
    if (option) lines.push(`The walls now: ${option.label.toLowerCase()}.`);
    if (state.input.bespoke?.length) lines.push(`Also: ${state.input.bespoke.map((item) => BESPOKE_LABEL[item] ?? item).join(', ')}.`);
    return lines;
  };

  const actions = (state: Read, summary: string, outcome: string) => {
    const brief = ['From the quantity calculator on mrwallcover.com:', ...describeInputs(state), summary, `Link: ${location.origin}${location.pathname}?${toQuery()}`].join('\n');
    const keep = () => {
      try {
        sessionStorage.setItem(BRIEF_KEY, brief);
      } catch {
        /* private mode: the enquiry starts empty */
      }
    };
    const box = el('div', undefined, 'qc-actions');
    const check = el('a', 'Have Mr Wallcover check this', 'btn btn-solid-ink');
    check.href = '/contact/?intent=advice&from=calculator';
    check.addEventListener('click', () => {
      keep();
      track('check_click', { outcome });
    });
    const send = el('a', 'Send us your measurements', 'btn btn-line');
    const chosen = Boolean(state.makerId || state.link);
    send.href = `/contact/?intent=${chosen ? 'install' : 'source'}&from=calculator`;
    send.addEventListener('click', () => {
      keep();
      track('measurements_click', { outcome, chosen });
    });
    const share = el('button', 'Copy a link to this result', 'btn btn-line');
    share.type = 'button';
    share.addEventListener('click', async () => {
      const url = `${location.origin}${location.pathname}?${toQuery()}`;
      history.replaceState(null, '', `?${toQuery()}`);
      try {
        await navigator.clipboard.writeText(url);
        share.textContent = 'Link copied';
      } catch {
        share.textContent = 'The link is in the address bar';
      }
    });
    const print = el('button', 'Print', 'btn btn-line');
    print.type = 'button';
    print.addEventListener('click', () => window.print());
    box.append(check, send, share, print);
    return box;
  };

  const planSentences = (r: PlanResult): string[] => {
    const sentences: string[] = [];
    sentences.push(`${r.drops} ${r.drops === 1 ? 'drop' : 'drops'} across the ${measure() === 'room' ? 'room, counted as one run of ' + fmt(r.runs[0].widthCm) + ' cm' : r.runs.length > 1 ? 'walls, each rounded up' : 'wall'}.`);
    const over = r.drops - r.fullDrops;
    if (r.shortPieces) sentences.push(`${over ? `${over} of them ${over === 1 ? 'sits' : 'sit'} over an opening and ${over === 1 ? 'is' : 'are'} cut as shorter pieces. ` : ''}With any reveals and niche backs, that is ${r.fullDrops} full-height ${r.fullDrops === 1 ? 'drop' : 'drops'} and ${r.shortPieces} shorter ${r.shortPieces === 1 ? 'piece' : 'pieces'}, cut from offcuts where the pattern lines up.`);
    const also = (v: number) => (imperial() ? ` (${ftIn(v)})` : '');
    sentences.push(`Each drop is cut at ${fmt(r.dropLengthCm)} cm${also(r.dropLengthCm)}, including ${fmt(r.trimTopCm)} cm at the top and ${fmt(r.trimBottomCm)} cm at the bottom.`);
    if (r.match === 'straight') sentences.push(`The straight match moves the start of the next drop on by ${fmt(r.cutPitchCm)} cm.`);
    if (['half', 'third', 'quarter'].includes(r.match)) {
      const step = r.match === 'half' ? 'half' : r.match === 'third' ? 'a third' : 'a quarter';
      sentences.push(`Each drop starts ${step} of a repeat lower in the pattern than the one before. ${r.method === 'phase' ? 'The drops that start at the same point are cut together, which needs fewer rolls here.' : 'The drops are cut in order along the roll.'}`);
    }
    if (r.startLossCm) sentences.push(`${fmt(r.startLossCm)} cm${also(r.startLossCm)} is allowed at the start of each roll to find the pattern.`);
    if (r.dropsPerRoll) sentences.push(`${r.dropsPerRoll} full ${r.dropsPerRoll === 1 ? 'drop fits' : 'drops fit'} on a ${r.working.unit.one === 'metre' ? 'piece' : r.working.unit.one}.`);
    if (r.noOffcutInfill) sentences.push('The maker asks for every piece to be cut and hung in order as it comes off the roll, so offcuts are not reused.');
    return sentences;
  };

  const rollList = (r: PlanResult) => {
    const list = el('ol', undefined, 'qc-plan');
    const unit = r.working.unit.one === 'metre' || r.working.unit.one === 'yard' ? 'Piece' : r.working.unit.one[0].toUpperCase() + r.working.unit.one.slice(1);
    // Rolls cut the same way, one after another, share a line: "Rolls 1 to 9: drops 1 to 27, three on each…".
    const shape = (roll: PlanResult['rolls'][number]) => roll.cuts.every((cut) => cut.kind === 'full' && cut.wall === roll.cuts[0].wall) ? `${roll.cuts.map((cut) => `${cut.lengthCm}@${cut.atCm}`).join(',')}|${roll.leftoverCm}` : null;
    const groups: PlanResult['rolls'][] = [];
    for (const roll of r.rolls) {
      const last = groups[groups.length - 1];
      if (last && shape(roll) !== null && shape(roll) === shape(last[0])) last.push(roll);
      else groups.push([roll]);
    }
    for (const group of groups) {
      const roll = group[0];
      if (group.length > 2) {
        const first = group[0].cuts[0].drop;
        const final = group[group.length - 1].cuts[group[group.length - 1].cuts.length - 1].drop;
        const at = roll.cuts.map((cut) => fmt(cut.atCm));
        list.append(el('li', `${unit}s ${roll.roll} to ${group[group.length - 1].roll}: drops ${first} to ${final}, ${roll.cuts.length} on each (${fmt(roll.cuts[0].lengthCm)} cm), cut at ${at.slice(0, -1).join(', ')}${at.length > 1 ? ' and ' : ''}${at[at.length - 1]} cm. ${fmt(roll.leftoverCm)} cm left on each.`));
        continue;
      }
      for (const single of group) {
        const parts = single.cuts.map((cut) => {
          const what = cut.kind === 'full' ? `drop ${cut.drop}${r.runs.length > 1 ? ` of wall ${cut.wall}` : ''}` : `${KIND_LABEL[cut.kind]}${r.runs.length > 1 ? ` on wall ${cut.wall}` : ''}`;
          return `${what} (${fmt(cut.lengthCm)} cm) at ${fmt(cut.atCm)} cm`;
        });
        list.append(el('li', `${unit} ${single.roll}: ${parts.join(', ')}. ${fmt(single.leftoverCm)} cm left.`));
      }
    }
    return list;
  };

  const orderBlock = (r: PlanResult) => {
    const dl = el('dl', undefined, 'qc-order');
    const row = (label: string, count: string, note: string, cls?: string) => {
      const div = el('div', undefined, cls);
      const dd = el('dd');
      dd.append(el('strong', count), el('span', note, 'qc-note'));
      div.append(el('dt', label), dd);
      dl.append(div);
    };
    const byLength = r.working.unit.one === 'metre' || r.working.unit.one === 'yard';
    const other = (count: number) => r.working.unit.one === 'yard' ? ` (${fmtM(count * 0.9144)} m)` : r.working.unit.one === 'metre' && imperial() ? ` (${fmtM(count / 0.9144)} yd)` : '';
    const what = byLength ? `The plan uses ${fmtM((r.usedCm ?? 0) / (r.working.unit.one === 'metre' ? 100 : 91.44))} ${r.working.unit.many}${other((r.usedCm ?? 0) / (r.working.unit.one === 'metre' ? 100 : 91.44))}.` : `These cover the ${r.drops} ${r.drops === 1 ? 'drop' : 'drops'} in the plan.`;
    row('Working', `${plural(r.working)}${other(r.working.count)}`, what);
    row('Spare', `${plural(r.spare)}${other(r.spare.count)}`, r.working.unit.one === 'metre' || r.working.unit.one === 'yard' ? 'One more drop, kept for a damaged length or a later repair, from the same batch.' : 'From the same batch, kept for a damaged length or a later repair.');
    row('Order', `${plural(r.order)}${other(r.order.count)}`, r.singleRollsPriced ? `US papers are priced by the single roll: that is ${r.singleRollsPriced} single rolls.` : 'Everything from one batch.', 'qc-total');
    return dl;
  };

  const render = (state: Read, result: QuantityResult) => {
    output.hidden = false;
    output.replaceChildren();
    const rule = state.makerId ? maker(state.makerId) : undefined;
    if (!result.ok) {
      output.append(el('h3', result.route === 'error' ? 'Check the figures' : 'We will measure this for you'), el('p', result.reason));
      if (result.route !== 'error') output.append(el('p', 'Send us the measurements you have and a photograph, and we will work out the order with you.', 'qc-small'), actions(state, result.reason, result.route));
      track('calculator_complete', { outcome: result.route, mode: measure(), sold: soldKind() });
      return;
    }
    if (result.kind === 'mural') {
      output.append(el('h3', 'Mural order size'));
      const dl = el('dl', undefined, 'qc-order');
      const div = el('div', undefined, 'qc-total');
      const dd = el('dd');
      dd.append(el('strong', `${fmtM(result.areaM2)} m²`), el('span', `${fmt(result.widthCm)} × ${fmt(result.heightCm)} cm, including the ${fmt(result.marginCm)} cm margin the maker asks for.`, 'qc-note'));
      div.append(el('dt', 'Order'), dd);
      dl.append(div);
      output.append(dl, el('p', 'A mural is made to the measurements you send the maker, so we check the wall and the set-out before you order.'), actions(state, `Mural: ${fmt(result.widthCm)} × ${fmt(result.heightCm)} cm, ${fmtM(result.areaM2)} m².`, 'mural'));
      track('calculator_complete', { outcome: 'mural', mode: measure(), sold: 'mural' });
      return;
    }
    const r = result;
    output.append(orderBlock(r));
    const close = closeCall(state.input, r);
    if (close) output.append(el('p', `${close.extraCm} cm more ${close.dimension} would make this ${close.working} working ${close.working === 1 ? r.working.unit.one : r.working.unit.many}. Measure twice.`, 'qc-warning'));

    const how = el('section');
    how.append(el('h3', 'How we worked it out'));
    const ul = el('ul');
    for (const sentence of planSentences(r)) ul.append(el('li', sentence));
    how.append(ul, el('p', 'The cutting plan:', 'qc-small mt-3'), rollList(r));
    const hasOpenings = Boolean(state.input.room?.openings?.length || state.input.walls?.some((wall) => wall.openings?.length));
    if (!hasOpenings) how.append(el('p', 'Windows and doors have not been taken out. Add them in step 3 if you want them counted.', 'qc-small mt-3'));
    if (!formatOption().dataset.other) how.append(el('p', `Roll size: ${formatOption().textContent}, a size makers print. Check it against your product's page or label.`, 'qc-small mt-3'));
    output.append(how);

    const materials = materialsFor(state.input, r, { condition: state.condition, makerId: state.makerId || undefined });
    const mat = el('section');
    mat.append(el('h3', 'Materials'));
    const list = el('ul', undefined, 'qc-materials');
    for (const line of materials.lines) {
      const li = el('li');
      li.append(el('strong', line.name), line.amount ? `: ${line.amount}` : '');
      if (line.note) li.append(el('span', line.note));
      if (line.source) {
        const a = el('a', line.sourceLabel ?? "Maker's page");
        a.href = line.source;
        a.rel = 'noopener';
        const span = el('span');
        span.append(a);
        li.append(span);
      }
      list.append(li);
    }
    mat.append(list);
    for (const note of materials.assumed) mat.append(el('p', `We assumed: ${note.charAt(0).toLowerCase()}${note.slice(1)} Change it in step 3.`, 'qc-small mt-3'));
    const link = el('p', 'The products, grades and data sheets are listed on ', 'qc-small mt-3');
    const a = el('a', 'lining papers, pastes and primers');
    a.href = '/wallpapering/lining-and-adhesives/';
    link.append(a, '.');
    mat.append(link);
    output.append(mat);

    const checks = materials.checks;
    if (checks.length) {
      const box = el('section');
      box.append(el('h3', 'Have Mr Wallcover check this'));
      const items = el('ul');
      for (const reason of checks) items.append(el('li', reason));
      box.append(items);
      output.append(box);
    }
    output.append(
      el('p', `Order every ${r.working.unit.one === 'metre' || r.working.unit.one === 'yard' ? 'length' : r.working.unit.one}, including the spare, from one batch, and check the batch number before anything is cut. Hang the first three drops, then stop and check the shade and the match in daylight.${rule ? ` We follow ${rule.name}'s hanging instructions first.` : ''}`),
      el('p', 'This is an order quantity for walls of one height, using the roll shown. It is not a set-out and not a price.', 'qc-small'),
    );
    output.append(actions(state, `Result: ${plural(r.working)} working + ${plural(r.spare)} spare = ${plural(r.order)}.${checks.length ? ' Please check: ' + checks.join(' ') : ''}`, checks.length ? 'plan-check' : 'plan'));
    track('calculator_complete', { outcome: 'plan', mode: measure(), match: r.match, sold: soldKind(), working: r.working.count, check: checks.length > 0, openings: r.shortPieces > 0 });
  };

  const run = () => {
    const state = read();
    if (state.problems.length) {
      output.hidden = false;
      output.replaceChildren(el('h3', 'Check the figures'), ...state.problems.map((problem) => el('p', problem)));
      return;
    }
    render(state, calculate(state.input));
  };

  /* ---------- wiring ---------- */

  formatSelect.addEventListener('change', () => {
    syncFormat(true);
    syncMatch();
  });
  for (const name of ['rollWidth', 'rollLength', 'overlap', 'rollsPerSet']) form.querySelector(`[name="${name}"]`)!.addEventListener('input', toOther);
  form.querySelector<HTMLSelectElement>('[name="widthUnit"]')!.addEventListener('change', (event) => changeUnit(event.currentTarget as HTMLSelectElement, field('rollWidth') as HTMLInputElement));
  form.querySelector<HTMLSelectElement>('[name="lengthUnit"]')!.addEventListener('change', (event) => changeUnit(event.currentTarget as HTMLSelectElement, field('rollLength') as HTMLInputElement));
  form.querySelector<HTMLSelectElement>('[name="repeatUnit"]')!.addEventListener('change', (event) => changeUnit(event.currentTarget as HTMLSelectElement, field('repeat') as HTMLInputElement));
  form.querySelectorAll<HTMLInputElement>('[name="mu"]').forEach((radio) =>
    radio.addEventListener('change', () => {
      const from = lastMeasure;
      convertAll(['measure', 'small'], (dim) => (dim === 'measure' ? from : smallFor(from)) as Unit, (dim) => unitFor(dim));
      lastMeasure = measureUnit();
      syncUnits();
    }),
  );
  form.addEventListener('input', (event) => {
    if ((event.target as HTMLElement).matches('input[data-dim]')) syncUnits();
  });
  form.querySelector('[name="match"]')!.addEventListener('change', syncMatch);
  form.querySelector('[name="condition"]')!.addEventListener('change', () => (conditionAnswered = true));
  form.querySelector('[name="link"]')!.addEventListener('change', readLink);
  form.querySelectorAll('[name="measure"]').forEach((radio) => radio.addEventListener('change', syncMeasure));
  addWall.addEventListener('click', () => addWallRow().querySelector('input')?.focus());
  form.querySelectorAll<HTMLButtonElement>('[data-add-opening]').forEach((button) =>
    button.addEventListener('click', () => addOpening(button.dataset.addOpening as OpeningInput['kind']).querySelector<HTMLInputElement>('[name="o-width"]')?.focus()),
  );
  form.querySelector('[data-add-return]')!.addEventListener('click', () => addReturn().querySelector<HTMLInputElement>('[name="r-depth"]')?.focus());
  form.addEventListener('click', (event) => {
    const remove = (event.target as Element).closest('[data-remove]');
    if (!remove) return;
    remove.closest('[data-wall], [data-opening], [data-return]')?.remove();
    labelWalls();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run();
    output.focus({ preventScroll: true });
    output.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  form.addEventListener('change', () => {
    if (!output.hidden) run();
  });

  syncFormat(false);
  syncMatch();
  syncMeasure();
  syncUnits();
  if (fromQuery(new URLSearchParams(location.search))) run();
}
