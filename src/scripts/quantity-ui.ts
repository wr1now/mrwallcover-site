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
    for (const select of form.querySelectorAll<HTMLSelectElement>('[name="widthUnit"], [name="lengthUnit"], [name="repeatUnit"]')) select.dataset.was = select.value;
  };
  const syncFormat = (fill: boolean) => {
    const option = formatOption();
    const kind = soldKind();
    if (fill && Number(option.dataset.width) > 0) {
      const presetValue = (name: string, next: string) => {
        const input = field(name) as HTMLInputElement;
        input.value = next;
        delete input.dataset.exactCm;
        delete input.dataset.shown;
      };
      presetValue('rollWidth', option.dataset.width!);
      (field('widthUnit') as HTMLSelectElement).value = option.dataset.wunit ?? 'cm';
      presetValue('rollLength', option.dataset.length ?? '');
      (field('lengthUnit') as HTMLSelectElement).value = option.dataset.lunit ?? 'm';
      presetValue('overlap', String(option.dataset.wunit === 'in' ? convert(Number(option.dataset.overlap ?? 0), 'cm', 'in') : Number(option.dataset.overlap ?? 0)));
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
    // A preset's size is already in its label; the width and length rows open for "Another size".
    $<HTMLElement>('[data-custom-size]').hidden = sizeless || !option.dataset.other;
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
      if (found && maker(found[1]) && [...makerSelect.options].some((option) => option.value === found[1])) {
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
      const remove = row.querySelector<HTMLElement>('[data-remove]');
      remove?.toggleAttribute('hidden', !many || index === 0);
      const name = remove?.querySelector('[data-remove-name]');
      if (name) name.textContent = ` wall ${index + 1}`;
    });
    syncWallChoices();
  };
  const addWallRow = (width = '', height = '') => {
    const row = wallRows()[0].cloneNode(true) as HTMLElement;
    row.querySelectorAll('.form-error, .qc-cm').forEach((note) => note.remove());
    row.querySelectorAll('input').forEach((input) => {
      input.value = '';
      input.removeAttribute('aria-invalid');
      input.removeAttribute('data-error-id');
      input.removeAttribute('data-exact-cm');
      input.removeAttribute('data-shown');
      const described = (input.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id && !id.startsWith('qc-error-')).join(' ');
      if (described) input.setAttribute('aria-describedby', described);
      else input.removeAttribute('aria-describedby');
    });
    (row.querySelector('[name="width"]') as HTMLInputElement).value = width;
    (row.querySelector('[name="height"]') as HTMLInputElement).value = height || (wallRows()[0].querySelector('[name="height"]') as HTMLInputElement).value;
    if (!row.querySelector('[data-remove]')) {
      const remove = el('button', 'Remove', 'btn btn-line justify-self-start');
      remove.type = 'button';
      remove.dataset.remove = '';
      const name = el('span', '', 'sr-only');
      name.setAttribute('data-remove-name', '');
      remove.append(name);
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

  const KIND_NAME: Record<string, string> = { door: 'Door', window: 'Window', niche: 'Niche' };
  // Each opening and return is named and numbered ("Window 2"), and so is its Remove button.
  const nameRows = () => {
    const counts: Record<string, number> = {};
    for (const row of openingsBox.querySelectorAll<HTMLElement>('[data-opening]')) {
      const kind = row.dataset.kind!;
      counts[kind] = (counts[kind] ?? 0) + 1;
      row.querySelector('[data-opening-title]')!.textContent = `${KIND_NAME[kind]} ${counts[kind]}`;
      row.querySelector('[data-remove-name]')!.textContent = ` ${kind} ${counts[kind]}`;
    }
    returnsBox.querySelectorAll<HTMLElement>('[data-return]').forEach((row, index) => (row.querySelector('[data-remove-name]')!.textContent = ` return ${index + 1}`));
  };

  const addOpening = (kind: OpeningInput['kind'], values: Partial<Record<string, string>> = {}) => {
    const row = openingTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
    row.dataset.kind = kind;
    const floor = row.querySelector<HTMLElement>('[data-from-floor]')!;
    floor.hidden = kind === 'door';
    floor.querySelector('[data-from-floor-label]')!.textContent = kind === 'niche' ? 'Bottom of the niche above the skirting' : 'Sill above the skirting';
    row.querySelector<HTMLElement>('[data-reveals]')!.hidden = kind === 'niche';
    for (const [name, v] of Object.entries(values)) {
      const input = row.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
      if (input && v !== undefined) input.value = v;
    }
    openingsBox.append(row);
    nameRows();
    syncWallChoices();
    syncUnits();
    if (values['o-wall']) (row.querySelector('[name="o-wall"]') as HTMLSelectElement).value = values['o-wall'];
    return row;
  };
  const addReturn = (values: Partial<Record<string, string>> = {}) => {
    const row = returnTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
    returnsBox.append(row);
    nameRows();
    syncWallChoices();
    syncUnits();
    for (const [name, v] of Object.entries(values)) {
      const input = row.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
      if (input && v !== undefined) input.value = v;
    }
    return row;
  };

  /* ---------- reading the form ---------- */

  type Problem = { message: string; field?: HTMLElement | null };
  type Read = { input: QuantityInput; problems: Problem[]; makerId: string; condition: string; link: string };

  const read = (): Read => {
    const problems: Problem[] = [];
    const kind = soldKind();
    const match = (['mural', 'panel-set'].includes(kind) ? 'free' : value('match')) as Match;
    const soldBy = soldByFor(formatGroup(), { rollsPerSet: num(field('rollsPerSet')), marginCm: cm(field('margin')) || 0 });
    if (kind === 'mural' && (!(cm(field('margin')) >= 0) || !Number.isFinite(cm(field('margin'))))) {
      problems.push({ message: 'Enter the extra margin stated in the mural maker’s instructions, or 0 if it specifies none.', field: field('margin') as HTMLElement });
    }
    const makerId = makerSelect.value;
    const rule = makerId ? maker(makerId) : undefined;
    const overlapCm = kind === 'length' ? cm(field('overlap')) || 0 : 0;
    const nominalCm = cm(field('rollWidth'));
    if (overlapCm < 0 || (overlapCm > 0 && overlapCm >= nominalCm)) problems.push({ message: 'The overlap must be less than the width, and not below zero.', field: field('overlap') as HTMLElement });
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
    for (const name of ['trimTop', 'trimBottom']) {
      const trim = cm(field(name));
      if (!(trim >= 0) || !Number.isFinite(trim)) problems.push({ message: 'Enter a trim allowance of zero or more.', field: field(name) as HTMLElement });
    }
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
      if (!(opening.widthCm > 0) || !(opening.heightCm > 0) || (k !== 'door' && !(opening.fromFloorCm! >= 0))) {
        const empty = [...row.querySelectorAll<HTMLInputElement>('[name="o-width"], [name="o-height"], [name="o-floor"]')].find((input) => !input.closest('[hidden]') && !(Number(input.value) > 0 || (input.name === 'o-floor' && input.value.trim() !== '')));
        problems.push({ message: `Fill in the ${k}'s width, height${k === 'door' ? '' : ' and height above the skirting'}, or remove it.`, field: empty ?? row.querySelector<HTMLElement>('[name="o-width"]') });
      }
      if (opening.depthCm! < 0 || !Number.isFinite(opening.depthCm)) problems.push({ message: 'Reveal depth must be zero or more.', field: row.querySelector<HTMLElement>('[name="o-depth"]') });
      openingsByWall.set(wall, [...(openingsByWall.get(wall) ?? []), opening]);
    }
    const returnsByWall = new Map<number, number[]>();
    for (const row of returnsBox.querySelectorAll<HTMLElement>('[data-return]')) {
      const depth = cm(row.querySelector('[name="r-depth"]'));
      if (!(depth > 0) || !Number.isFinite(depth)) {
        problems.push({ message: 'Enter the return depth, greater than zero, or remove it.', field: row.querySelector<HTMLElement>('[name="r-depth"]') });
        continue;
      }
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
    const checkDimensions = (boxes: HTMLElement[], what: string) => {
      for (const box of boxes) {
        const size = cm(box);
        if (!(size > 0) || !Number.isFinite(size)) problems.push({ message: `Enter the ${box.getAttribute('name')?.toLowerCase().includes('height') ? 'height to paper' : what} in ${unitName()}, greater than zero.`, field: box });
      }
      const small = boxes.find((box) => tooSmall(cm(box)));
      if (small) problems.push({ message: unitHelp(what), field: small });
    };
    if (measure() === 'room') {
      input.room = { lengthCm: cm(field('roomLength')), widthCm: cm(field('roomWidth')), heightCm: cm(field('roomHeight')), returnsCm: returnsByWall.get(1), openings: openingsByWall.get(1) };
      checkDimensions(['roomLength', 'roomWidth', 'roomHeight'].map((name) => field(name) as HTMLElement), 'room dimension');
    } else {
      input.walls = wallRows().map((row, index) => ({
        widthCm: cm(row.querySelector('[name="width"]')),
        heightCm: cm(row.querySelector('[name="height"]')),
        returnsCm: returnsByWall.get(index + 1),
        openings: openingsByWall.get(index + 1),
      }));
      checkDimensions(wallRows().flatMap((row) => [...row.querySelectorAll<HTMLElement>('[name="width"], [name="height"]')]), 'wall width');
    }
    if (tooSmall(paper.widthCm) && !['mural', 'panel-set'].includes(kind)) problems.push({ message: widthUnit() === 'in' ? 'Enter the roll width in inches, for example 20.5 or 27.' : 'Enter the roll width in centimetres: 0.53 m is 53 cm.', field: field('rollWidth') as HTMLElement });
    if (bespoke.length || kind === 'panel-set') problems.length = 0;
    return { input, problems, makerId, condition: conditionAnswered ? value('condition') : '', link: value('link') };
  };

  /* ---------- sharing ---------- */

  // Unit controls show a rounded value for reading. Share the retained measurement at full precision,
  // so reopening an inches/feet link cannot move a wall or repeat across a cutting threshold.
  const sharedValue = (box: HTMLInputElement | HTMLSelectElement | null) => {
    if (!box) return '';
    const dim = box.dataset.dim as Dim | undefined;
    if (dim && box.dataset.exactCm && box.dataset.shown === box.value) {
      return String(Number((Number(box.dataset.exactCm) / CM_PER[unitFor(dim)]).toPrecision(14)));
    }
    return box.value.trim();
  };
  const shared = (name: string) => sharedValue(field(name));
  const toQuery = (): string => {
    const q = new URLSearchParams();
    q.set('f', formatSelect.value);
    if (makerSelect.value) q.set('mk', makerSelect.value);
    q.set('rw', shared('rollWidth'));
    q.set('rl', shared('rollLength'));
    if (value('link')) q.set('link', value('link'));
    if (widthUnit() !== 'cm') q.set('wu', widthUnit());
    if (lengthUnit() !== 'm') q.set('lu', lengthUnit());
    if (soldKind() === 'length' && value('overlap') && value('overlap') !== '0') q.set('ov', shared('overlap'));
    if (soldKind() === 'set') q.set('rs', value('rollsPerSet'));
    if (repeatUnit() !== 'cm') q.set('ru', repeatUnit());
    if (measureUnit() !== 'cm') q.set('mu', measureUnit());
    q.set('m', value('match'));
    if (value('repeat') && value('repeat') !== '0') q.set('r', shared('repeat'));
    if (soldKind() === 'mural') q.set('mg', shared('margin'));
    q.set('ms', measure());
    if (measure() === 'room') q.set('rm', [shared('roomLength'), shared('roomWidth'), shared('roomHeight')].join('x'));
    else q.set('w', wallRows().map((row) => ['width', 'height'].map((name) => sharedValue(row.querySelector<HTMLInputElement>(`[name="${name}"]`))).join('x')).join(','));
    const openings = [...openingsBox.querySelectorAll<HTMLElement>('[data-opening]')].map((row) => [row.dataset.kind, ...['o-wall', 'o-width', 'o-height', 'o-floor', 'o-depth', 'o-reveals'].map((name) => sharedValue(row.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)))].join(':'));
    if (openings.length) q.set('o', openings.join(';'));
    const returns = [...returnsBox.querySelectorAll<HTMLElement>('[data-return]')].map((row) => ['r-wall', 'r-depth'].map((name) => sharedValue(row.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`))).join(':'));
    if (returns.length) q.set('rt', returns.join(';'));
    if (conditionAnswered) q.set('c', value('condition'));
    const bespoke = [...form.querySelectorAll<HTMLInputElement>('[name="bespoke"]:checked')].map((box) => box.value);
    if (bespoke.length) q.set('b', bespoke.join(','));
    if (value('trimTop') !== '5') q.set('tt', shared('trimTop'));
    if (value('trimBottom') !== '5') q.set('tb', shared('trimBottom'));
    return q.toString();
  };
  const fromQuery = (q: URLSearchParams): boolean => {
    if (!q.has('w') && !q.has('rm')) return false;
    const set = (name: string, v: string | null) => {
      const input = field(name);
      if (!input || v === null) return false;
      if (input instanceof HTMLSelectElement && ![...input.options].some((option) => option.value === v)) return false;
      input.value = v;
      return true;
    };
    const f = q.get('f') === 'custom' ? 'other-roll' : q.get('f');
    if (f && [...formatSelect.options].some((option) => option.value === f)) formatSelect.value = f;
    syncFormat(true);
    if (q.get('mk') && maker(q.get('mk')!)) {
      makerSelect.value = q.get('mk')!;
      $<HTMLDetailsElement>('[data-maker-box]').open = true;
    }
    set('rollWidth', q.get('rw'));
    set('rollLength', q.get('rl'));
    if (set('link', q.get('link'))) {
      $<HTMLDetailsElement>('[data-maker-box]').open = true;
      readLink();
    }
    if (q.get('wu') === 'in') set('widthUnit', 'in');
    if (['ft', 'yd'].includes(q.get('lu') ?? '')) set('lengthUnit', q.get('lu'));
    set('overlap', q.get('ov'));
    set('rollsPerSet', q.get('rs'));
    if (q.get('ru') === 'in') set('repeatUnit', 'in');
    const requestedUnit = q.get('mu') ?? 'cm';
    const mu = [...form.querySelectorAll<HTMLInputElement>('[name="mu"]')].find((radio) => radio.value === requestedUnit);
    if (mu) {
      mu.checked = true;
      const previous = lastMeasure;
      convertAll(['measure', 'small'], (dim) => (dim === 'measure' ? previous : smallFor(previous)) as Unit, (dim) => unitFor(dim));
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
    if (q.get('c') && set('condition', q.get('c'))) {
      conditionAnswered = true;
    }
    for (const v of (q.get('b') ?? '').split(',').filter(Boolean)) {
      const box = [...form.querySelectorAll<HTMLInputElement>('[name="bespoke"]')].find((input) => input.value === v);
      if (box) box.checked = true;
    }
    set('trimTop', q.get('tt'));
    set('trimBottom', q.get('tb'));
    form.querySelectorAll<HTMLInputElement>('input[data-dim]').forEach((input) => {
      if (!input.value.trim() || !Number.isFinite(Number(input.value))) return;
      const exact = input.dataset.shown === input.value && input.dataset.exactCm ? Number(input.dataset.exactCm) : Number(input.value) * CM_PER[unitFor(input.dataset.dim as Dim)];
      input.value = String(convert(exact, 'cm', unitFor(input.dataset.dim as Dim)));
      input.dataset.exactCm = String(exact);
      input.dataset.shown = input.value;
    });
    // A tampered or old link may carry a custom size with a preset id. Keep the actual size visible.
    const option = formatOption();
    if (!option.dataset.other && Number(option.dataset.width) > 0) {
      const presetWidth = Number(option.dataset.width) * CM_PER[(option.dataset.wunit ?? 'cm') as Unit];
      const presetLength = Number(option.dataset.length) * CM_PER[(option.dataset.lunit ?? 'm') as Unit];
      if (Math.abs(cm(field('rollWidth')) - presetWidth) > .011 || Math.abs(cm(field('rollLength')) - presetLength) > .011) toOther();
    }
    syncFormat(false);
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

  /* ---------- the answer: the docket beside the form, the working below ---------- */

  const docket = $<HTMLElement>('[data-docket]');
  const docketBody = $<HTMLElement>('[data-docket-body]');
  const docketHeading = $<HTMLElement>('#qc-docket-heading');
  const staleNote = $<HTMLElement>('[data-stale-note]');
  const status = form.querySelector<HTMLElement>('[data-qc-status]')!;
  // The working shows once "Work it out" is pressed or a shared link opens; the docket is live from the first measurement.
  let submitted = false;
  let lastSentence = '';
  const announce = (sentence: string) => {
    if (sentence === lastSentence) return;
    lastSentence = sentence;
    status.textContent = sentence;
  };
  const q0 = () => new URLSearchParams(location.search);
  const shareUrl = () => `${location.origin}${location.pathname}?${toQuery()}`;

  /** The next step for an outcome: one ink button, and the brief travels with it. */
  const actions = (state: Read, summary: string, outcome: string) => {
    const brief = ['From the quantity calculator on mrwallcover.com:', ...describeInputs(state), summary, `Link: ${shareUrl()}`].join('\n');
    const keep = () => {
      try {
        sessionStorage.setItem(BRIEF_KEY, brief);
      } catch {
        /* private mode: the enquiry starts empty */
      }
    };
    const wrap = el('div', undefined, 'qc-actions-wrap');
    const box = el('div', undefined, 'qc-actions');
    const chosen = Boolean(state.makerId || state.link);
    const plan = outcome === 'plan' || outcome === 'plan-check';
    const action = (name: 'send' | 'check' | 'request') => document.querySelector<HTMLTemplateElement>(`[data-qc-action="${name}"]`)!.content.firstElementChild!.cloneNode(true) as HTMLAnchorElement;
    const send = action(plan ? 'send' : 'request');
    send.href = `/contact/?intent=${chosen ? 'install' : 'source'}&from=calculator`;
    send.addEventListener('click', () => {
      keep();
      track('measurements_click', { outcome, chosen });
    });
    if (plan) {
      const check = action('check');
      check.addEventListener('click', () => {
        keep();
        track('check_click', { outcome });
      });
      box.append(check, send);
    } else {
      box.append(send);
    }
    wrap.append(box, el('p', 'Your figures go with your message.', 'qc-small'));
    return wrap;
  };

  const utility = () => {
    const row = el('div', undefined, 'qc-utility');
    const share = el('button', 'Copy a link to this result');
    share.type = 'button';
    share.addEventListener('click', async () => {
      history.replaceState(null, '', `?${toQuery()}`);
      try {
        await navigator.clipboard.writeText(shareUrl());
        share.textContent = 'Link copied';
        announce('Link copied.');
      } catch {
        share.textContent = 'The link is in the address bar';
        announce('The link is in the address bar.');
      }
    });
    const print = el('button', 'Print');
    print.type = 'button';
    print.addEventListener('click', () => window.print());
    const dot = el('span', '·', 'qc-dot');
    dot.setAttribute('aria-hidden', 'true');
    row.append(share, dot, print);
    return row;
  };

  const byLength = (r: PlanResult) => r.working.unit.one === 'metre' || r.working.unit.one === 'yard';
  /** Yards always with metres beside them; metres with yards for someone measuring in feet or inches. */
  const otherUnit = (r: PlanResult, count: number) => r.working.unit.one === 'yard' ? `${fmtM(count * 0.9144)} m` : r.working.unit.one === 'metre' && imperial() ? `${fmtM(count / 0.9144)} yd` : '';

  const ledger = (r: PlanResult) => {
    const dl = el('dl', undefined, 'qc-order');
    const row = (label: string, op: string, count: string, alt: string, cls?: string) => {
      const div = el('div', undefined, cls);
      const dt = el('dt');
      if (op) {
        const sign = el('span', op, 'qc-op');
        sign.setAttribute('aria-hidden', 'true');
        dt.append(sign);
      }
      dt.append(label);
      const dd = el('dd');
      dd.append(el('strong', count));
      if (alt) dd.append(el('span', alt, 'qc-alt'));
      div.append(dt, dd);
      dl.append(div);
    };
    row('Working', '', plural(r.working), otherUnit(r, r.working.count));
    row('Spare', '+', plural(r.spare), otherUnit(r, r.spare.count));
    row('Order', '=', plural(r.order), r.singleRollsPriced ? `US papers are priced by the single roll: ${r.singleRollsPriced} single rolls.` : otherUnit(r, r.order.count), 'qc-total');
    return dl;
  };

  const planSentences = (r: PlanResult): string[] => {
    const sentences: string[] = [];
    const also = (v: number) => (imperial() ? ` (${ftIn(v)})` : '');
    sentences.push(`${r.drops} ${r.drops === 1 ? 'drop' : 'drops'} across the ${measure() === 'room' ? 'room, counted as one run of ' + fmt(r.runs[0].widthCm) + ' cm' : r.runs.length > 1 ? 'walls, each rounded up' : 'wall'}.`);
    const over = r.drops - r.fullDrops;
    if (r.shortPieces) sentences.push(`${over ? `${over} of them ${over === 1 ? 'sits' : 'sit'} over an opening and ${over === 1 ? 'is' : 'are'} cut as shorter pieces. ` : ''}With any reveals and niche backs, that is ${r.fullDrops} full-height ${r.fullDrops === 1 ? 'drop' : 'drops'} and ${r.shortPieces} shorter ${r.shortPieces === 1 ? 'piece' : 'pieces'}, cut from offcuts where the pattern lines up.`);
    if (r.match === 'straight') sentences.push(`The straight match moves the start of the next drop on by ${fmt(r.cutPitchCm)} cm${also(r.cutPitchCm)}.`);
    if (['half', 'third', 'quarter'].includes(r.match)) {
      const step = r.match === 'half' ? 'half' : r.match === 'third' ? 'a third' : 'a quarter';
      sentences.push(`Each drop starts ${step} of a repeat lower in the pattern than the one before. ${r.method === 'phase' ? 'The drops that start at the same point are cut together, which needs fewer rolls here.' : 'The drops are cut in order along the roll.'}`);
    }
    if (r.startLossCm) sentences.push(`${fmt(r.startLossCm)} cm${also(r.startLossCm)} is allowed at the start of each roll to find the pattern.`);
    if (r.noOffcutInfill) sentences.push('The maker asks for every piece to be cut and hung in order as it comes off the roll, so offcuts are not reused.');
    return sentences;
  };

  const facts = (r: PlanResult) => {
    const dl = el('dl', undefined, 'qc-facts');
    const fact = (label: string, value: string, small?: string) => {
      const div = el('div');
      const dd = el('dd', value);
      if (small) dd.append(el('small', small));
      div.append(el('dt', label), dd);
      dl.append(div);
    };
    const height = r.dropLengthCm - r.trimTopCm - r.trimBottomCm;
    const unit = byLength(r) ? 'piece' : r.working.unit.one.startsWith('set') ? 'roll' : r.working.unit.one;
    fact('Drops', String(r.drops), r.shortPieces ? `${r.fullDrops} full, ${r.shortPieces} short` : undefined);
    fact('Cut length', `${fmt(r.dropLengthCm)} cm`, `${fmt(r.trimTopCm)} + ${fmt(height)} + ${fmt(r.trimBottomCm)}${imperial() ? ` · ${ftIn(r.dropLengthCm)}` : ''}`);
    fact(`Drops per ${unit}`, String(r.dropsPerRoll));
    return dl;
  };

  const SHORT_LABEL: Record<string, string> = { above: 'over', below: 'under', part: 'reveal', back: 'back' };
  /** The roll strips: each roll to scale, drops as panels, pattern loss hatched, the offcut shaded. */
  const rollStrips = (r: PlanResult, lengthCm: number) => {
    const list = el('ol', undefined, 'qc-rolls');
    list.setAttribute('role', 'list');
    const L = lengthCm > 0 ? lengthCm : 3000;
    const one = byLength(r) ? 'Piece' : r.working.unit.one.startsWith('set') ? 'Roll' : r.working.unit.one[0].toUpperCase() + r.working.unit.one.slice(1);
    const shape = (roll: PlanResult['rolls'][number]) => roll.cuts.every((cut) => cut.kind === 'full' && cut.wall === roll.cuts[0].wall) ? `${roll.cuts.map((cut) => `${cut.lengthCm}@${cut.atCm}`).join(',')}|${roll.leftoverCm}` : null;
    const groups: PlanResult['rolls'][] = [];
    for (const roll of r.rolls) {
      const last = groups[groups.length - 1];
      if (last && shape(roll) !== null && shape(roll) === shape(last[0])) last.push(roll);
      else groups.push([roll]);
    }
    const sentence = (group: PlanResult['rolls']) => {
      const roll = group[0];
      if (group.length > 1) {
        const at = roll.cuts.map((cut) => fmt(cut.atCm));
        return `${one}s ${roll.roll} to ${group[group.length - 1].roll}: drops ${roll.cuts[0].drop} to ${group[group.length - 1].cuts[group[group.length - 1].cuts.length - 1].drop}, ${roll.cuts.length} on each (${fmt(roll.cuts[0].lengthCm)} cm), cut at ${at.slice(0, -1).join(', ')}${at.length > 1 ? ' and ' : ''}${at[at.length - 1]} cm. ${fmt(roll.leftoverCm)} cm left on each.`;
      }
      const parts = roll.cuts.map((cut) => `${cut.kind === 'full' ? `drop ${cut.drop}${r.runs.length > 1 ? ` of wall ${cut.wall}` : ''}` : `${KIND_LABEL[cut.kind]}${r.runs.length > 1 ? ` on wall ${cut.wall}` : ''}`} (${fmt(cut.lengthCm)} cm) at ${fmt(cut.atCm)} cm`);
      return `${one} ${roll.roll}: ${parts.join(', ')}. ${fmt(roll.leftoverCm)} cm left.`;
    };
    const set = (node: HTMLElement, at: number, len: number) => {
      node.style.setProperty('--at', String((at / L) * 100));
      node.style.setProperty('--len', String((len / L) * 100));
    };
    groups.forEach((group, index) => {
      const roll = group[0];
      const li = el('li', undefined, 'qc-roll');
      const last = group[group.length - 1].roll;
      li.append(el('span', group.length > 1 ? `${one}s ${roll.roll}–${last} ×${group.length}` : `${one} ${roll.roll}`, 'qc-roll-name'));
      const bar = el('span', undefined, 'qc-roll-bar');
      bar.setAttribute('aria-hidden', 'true');
      for (const cut of roll.cuts) {
        const index = roll.cuts.indexOf(cut);
        const drops = group.map((item) => item.cuts[index].drop);
        const label = group.length > 1 ? (drops.length <= 3 ? drops.join(' / ') : `${drops[0]}…${drops[drops.length - 1]}`) : String(cut.drop);
        const piece = el('span', cut.kind === 'full' ? label : SHORT_LABEL[cut.kind] ?? '', 'qc-cut');
        if (group.length > 1) piece.classList.add('qc-cut-grouped');
        piece.dataset.kind = cut.kind;
        set(piece, cut.atCm, cut.lengthCm);
        bar.append(piece);
      }
      if (roll.leftoverCm > 0) {
        const left = el('span', roll.leftoverCm / L >= .14 ? `${fmt(roll.leftoverCm)} cm` : '', 'qc-left');
        set(left, L - roll.leftoverCm, roll.leftoverCm);
        bar.append(left);
      }
      li.append(bar);
      if (index === 0) {
        const scale = el('span', undefined, 'qc-roll-scale');
        scale.setAttribute('aria-hidden', 'true');
        scale.append(el('span', '0'), el('span', `${fmtM(L / 100)} m`));
        li.append(scale);
      }
      li.append(el('span', sentence(group), 'qc-roll-text'));
      list.append(li);
    });
    const spare = el('li', undefined, 'qc-roll qc-roll-spare');
    const bar = el('span', undefined, 'qc-roll-bar');
    bar.setAttribute('aria-hidden', 'true');
    spare.append(el('span', 'Spare', 'qc-roll-name'), bar, el('span', byLength(r) ? 'One more drop, uncut, from the same batch.' : `${plural(r.spare)}, uncut, from the same batch.`, 'qc-roll-text'));
    list.append(spare);
    return list;
  };

  const linkButton = (text: string, go: () => void) => {
    const button = el('button', text, 'qc-link');
    button.type = 'button';
    button.addEventListener('click', go);
    return button;
  };
  const openAndFocus = (target: () => HTMLElement | null) => () => {
    more.open = true;
    target()?.focus();
  };

  const assumedSection = (state: Read, r: PlanResult, materials: ReturnType<typeof materialsFor>) => {
    const section = el('section', undefined, 'qc-assumed-section');
    section.append(el('p', 'What we assumed', 'qc-eyebrow'));
    const list = el('ul', undefined, 'qc-assumed');
    list.setAttribute('role', 'list');
    const item = (text: string, button?: HTMLButtonElement) => {
      const li = el('li');
      li.append(el('span', text));
      if (button) li.append(button);
      list.append(li);
    };
    const option = formatOption();
    const roll = ['mural', 'panel-set'].includes(soldKind()) ? option.textContent ?? '' : option.dataset.other ? `${value('rollWidth')} ${widthUnit()} wide${value('rollLength') ? ` × ${value('rollLength')} ${lengthUnit()}` : ''}, typed in` : `${option.textContent}, a size makers print: check it against your product`;
    item(`Roll: ${roll}.`, linkButton('Change', () => formatSelect.focus()));
    item(`Match: ${MATCH_LABEL[r.match]}${state.input.paper.repeatCm ? `, repeat ${fmt(state.input.paper.repeatCm)} cm` : ''}.`, linkButton('Change', () => (field('match') as HTMLElement).focus()));
    const condition = wallpapering.conditionQuestion.options.find((entry) => entry.id === value('condition'));
    item(`Walls: ${(condition?.label ?? 'painted and sound').toLowerCase()}${state.condition ? '' : ' (assumed)'}.`, linkButton('Change', openAndFocus(() => field('condition') as HTMLElement)));
    const hasOpenings = Boolean(state.input.room?.openings?.length || state.input.walls?.some((wall) => wall.openings?.length));
    if (!hasOpenings) item('Doors and windows: none taken out.', linkButton('Add one', openAndFocus(() => form.querySelector<HTMLElement>('[data-add-opening="window"]'))));
    item(`Trim: ${fmt(r.trimTopCm)} cm at the top and ${fmt(r.trimBottomCm)} cm at the bottom.`, linkButton('Change', openAndFocus(() => field('trimTop') as HTMLElement)));
    for (const note of materials.assumed) if (!/^The walls are/.test(note)) item(note);
    section.append(list);
    return section;
  };

  const ROLE: Record<string, string> = { primer: 'Primer', treatment: 'Treatment', lining: 'Lining paper', 'lining-paste': 'Lining paste', paste: 'Wallpaper paste' };
  const materialsSection = (materials: ReturnType<typeof materialsFor>) => {
    const section = el('section');
    section.append(el('h3', 'Materials'));
    const dl = el('dl', undefined, 'qc-materials');
    for (const line of materials.lines) {
      const div = el('div');
      const dd = el('dd');
      const named = line.name !== 'The paste the wallpaper maker names';
      dd.append(el('span', named ? line.name : 'The maker’s own', 'qc-mat-name'));
      const packs = line.packs ?? (line.need ? null : line.amount);
      if (packs) dd.append(el('span', packs, 'qc-mat-packs'));
      if (line.need) dd.append(el('span', `You need ${line.need}.`, 'qc-mat-need'));
      const quoted = line.note?.match(/^(.*?)\s*(?:The (?:data sheet|label):\s*)?"([^"]+)"\s*$/);
      const link = line.source ? Object.assign(el('a', line.sourceLabel ?? "Maker's page", 'qc-target'), { href: line.source, rel: 'noopener' }) : null;
      if (quoted) {
        if (quoted[1].trim()) dd.append(el('span', quoted[1].trim(), 'qc-mat-note'));
        const figure = el('figure', undefined, 'qc-quote');
        figure.append(el('blockquote', `“${quoted[2]}”`));
        if (link) {
          const cite = el('figcaption');
          cite.append(link);
          figure.append(cite);
        }
        dd.append(figure);
      } else {
        dd.append(el('span', line.note || 'Check the product’s current hanging instructions before ordering.', 'qc-mat-note'));
        if (link) {
          const span = el('span', undefined, 'qc-mat-note');
          span.append(link);
          dd.append(span);
        }
      }
      div.append(el('dt', ROLE[line.role] ?? line.role), dd);
      dl.append(div);
    }
    section.append(dl);
    const listed = el('p', 'The products, grades and data sheets are listed on ', 'qc-small');
    listed.append(Object.assign(el('a', 'wall-preparation guidance'), { href: '/advice/wall-preparation/' }), '.');
    section.append(listed);
    return section;
  };

  /* ---------- errors at the field ---------- */

  const clearError = (box: Element) => {
    box.removeAttribute('aria-invalid');
    const id = (box as HTMLElement).dataset.errorId;
    if (!id) return;
    document.getElementById(id)?.remove();
    const rest = (box.getAttribute('aria-describedby') ?? '').split(' ').filter((token) => token && token !== id).join(' ');
    if (rest) box.setAttribute('aria-describedby', rest);
    else box.removeAttribute('aria-describedby');
    delete (box as HTMLElement).dataset.errorId;
  };
  const clearErrors = () => form.querySelectorAll('[aria-invalid="true"]').forEach(clearError);
  let errorCount = 0;
  const showErrors = (problems: Problem[], reset = true) => {
    if (reset) clearErrors();
    for (const problem of problems) {
      const box = problem.field;
      if (!box || box.getAttribute('aria-invalid') === 'true') continue;
      const id = `qc-error-${++errorCount}`;
      const note = el('p', problem.message, 'form-error');
      note.id = id;
      const anchor = box.closest('.qc-unit') ?? (box.parentElement?.tagName === 'LABEL' ? box.parentElement : box);
      anchor.after(note);
      box.setAttribute('aria-invalid', 'true');
      box.setAttribute('aria-describedby', [box.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
      box.dataset.errorId = id;
    }
  };
  // The engine's own refusals name a field too.
  const fieldFor = (reason: string): HTMLElement | null =>
    /repeat/i.test(reason) ? (field('repeat') as HTMLElement)
    : /usable width|width of the paper/i.test(reason) ? (field('rollWidth') as HTMLElement)
    : /roll length/i.test(reason) ? (field('rollLength') as HTMLElement)
    : /margin/i.test(reason) ? (field('margin') as HTMLElement)
    : /set needs/i.test(reason) ? (field('rollsPerSet') as HTMLElement)
    : /pattern match/i.test(reason) ? (field('match') as HTMLElement)
    : /trim/i.test(reason) ? (field('trimTop') as HTMLElement)
    : null;
  const unitName = () => ({ cm: 'centimetres', m: 'metres', in: 'inches', ft: 'feet' })[measureUnit()];

  /* ---------- rendering ---------- */

  const docketProblems = (problems: Problem[]) => {
    docket.classList.remove('is-stale');
    staleNote.hidden = true;
    const lead = el('p', 'Check the figures', 'qc-docket-lead');
    const list = el('ul', undefined, 'qc-assumed');
    list.setAttribute('role', 'list');
    for (const problem of problems) {
      const li = el('li');
      if (problem.field) li.append(linkButton(problem.message, () => problem.field!.focus()));
      else li.append(el('span', problem.message));
      list.append(li);
    }
    docketBody.replaceChildren(lead, list);
  };

  const render = (state: Read, result: QuantityResult) => {
    docket.classList.remove('is-stale');
    staleNote.hidden = true;
    output.classList.remove('is-stale');
    const rule = state.makerId ? maker(state.makerId) : undefined;
    if (!result.ok) {
      output.hidden = true;
      delete form.dataset.hasResult;
      if (result.route === 'error') {
        const reason = result.reason.replace('in centimetres', `in ${unitName()}`);
        docketProblems([{ message: reason, field: fieldFor(reason) }]);
        announce(`Check the figures: ${reason}`);
        return;
      }
      docketBody.replaceChildren(
        el('p', 'We will measure this for you.', 'qc-docket-lead'),
        el('p', result.reason),
        el('p', 'Send us the measurements you have and a photograph, and we will work out the order with you.', 'qc-small'),
        actions(state, result.reason, result.route),
      );
      form.dataset.hasResult = '';
      announce(result.reason);
      return;
    }
    if (result.kind === 'mural') {
      output.hidden = true;
      delete form.dataset.hasResult;
      const dl = el('dl', undefined, 'qc-order');
      const div = el('div', undefined, 'qc-total');
      const dd = el('dd');
      dd.append(el('strong', `${fmtM(result.areaM2)} m²`), el('span', `${fmt(result.widthCm)} × ${fmt(result.heightCm)} cm, including the ${fmt(result.marginCm)} cm margin the maker asks for.`, 'qc-alt'));
      div.append(el('dt', 'Order'), dd);
      dl.append(div);
      docketBody.replaceChildren(dl, el('p', 'A mural is made to the measurements you send the maker, so we check the wall and the set-out before you order.', 'qc-small'), actions(state, `Mural: ${fmt(result.widthCm)} × ${fmt(result.heightCm)} cm, ${fmtM(result.areaM2)} m².`, 'mural'));
      form.dataset.hasResult = '';
      announce(`Order ${fmtM(result.areaM2)} square metres of mural.`);
      return;
    }

    const r = result;
    const materials = materialsFor(state.input, r, { condition: state.condition, makerId: state.makerId || undefined });
    const checks = materials.checks;
    const summary = `Result: ${plural(r.working)} working + ${plural(r.spare)} spare = ${plural(r.order)}.${checks.length ? ' Please check: ' + checks.join(' ') : ''}`;
    const outcome = checks.length ? 'plan-check' : 'plan';

    // The docket: the ledger, the close call, the spare, the next step.
    const docketParts: Node[] = [ledger(r)];
    const close = closeCall(state.input, r);
    if (close) docketParts.push(el('p', `${close.extraCm} cm more ${close.dimension} would make this ${close.working} working ${close.working === 1 ? r.working.unit.one : r.working.unit.many}. Measure twice.`, 'qc-warning'));
    docketParts.push(el('p', byLength(r) ? 'The spare is one more drop, from the same batch, for a damaged length or a later repair.' : 'The spare is from the same batch, for a damaged length or a later repair.', 'qc-note'));
    docketParts.push(actions(state, summary, outcome));
    if (submitted) {
      const jump = Object.assign(el('a', 'The cutting plan and materials ↓', 'qc-docket-link qc-small'), { href: '#qc-result' });
      docketParts.push(jump);
    }
    docketBody.replaceChildren(...docketParts);
    form.dataset.hasResult = '';
    announce(`Order ${plural(r.order)}: ${plural(r.working)} working and ${plural(r.spare)} spare.`);
    if (!submitted) return;

    // The working.
    output.hidden = false;
    form.dataset.hasResult = '';
    const sections: HTMLElement[] = [assumedSection(state, r, materials)];
    const how = el('section');
    how.append(el('h3', 'How we worked it out'), facts(r));
    const list = el('ul');
    list.setAttribute('role', 'list');
    for (const sentence of planSentences(r)) list.append(el('li', sentence));
    how.append(list);
    if (r.rolls.length) {
      how.append(el('p', 'The cutting plan, each roll to scale:', 'qc-small'));
      const key = el('p', undefined, 'qc-key');
      key.setAttribute('aria-hidden', 'true');
      key.append(el('span', 'Drop', 'k-drop'));
      if (r.startLossCm) key.append(el('span', 'Pattern lost', 'k-lost'));
      key.append(el('span', 'Left over', 'k-left'));
      how.append(key, rollStrips(r, state.input.paper.lengthCm));
    }
    sections.push(how, materialsSection(materials));
    if (checks.length) {
      const box = el('section');
      box.append(el('h3', 'Have Mr Wallcover check this'));
      const items = el('ul');
      items.setAttribute('role', 'list');
      for (const reason of checks) items.append(el('li', reason));
      box.append(items);
      sections.push(box);
    }
    const before = el('section');
    before.append(el('h3', 'Before you order'));
    const steps = el('ul');
    steps.setAttribute('role', 'list');
    const unit = byLength(r) ? 'length' : r.working.unit.one;
    steps.append(
      el('li', `Order every ${unit}, including the spare, from one batch, and check the batch number before anything is cut.`),
      el('li', `Hang the first three drops, then stop and check the shade and the match in daylight.${rule ? ` We follow ${rule.name}'s hanging instructions first.` : ''}`),
    );
    before.append(steps);
    const inputs = el('section', undefined, 'qc-inputs');
    inputs.append(el('h3', 'Your measurements'));
    const given = el('ul');
    given.setAttribute('role', 'list');
    for (const line of describeInputs(state)) given.append(el('li', line));
    inputs.append(given, el('p', `${shareUrl()} · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 'qc-small qc-print-only'));
    const end = el('section');
    const terms = el('p', undefined, 'qc-terms');
    terms.append(el('small', 'An order quantity for the measurements and wallpaper shown. Not a set-out, not a price.'));
    end.append(terms, actions(state, summary, outcome), utility());
    sections.push(before, inputs, end);
    output.replaceChildren(...sections);
  };

  const ready = () =>
    measure() === 'room'
      ? ['roomLength', 'roomWidth', 'roomHeight'].every((name) => cm(field(name)) > 0)
      : wallRows().every((row) => cm(row.querySelector('[name="width"]')) > 0 && cm(row.querySelector('[name="height"]')) > 0);

  const markStale = () => {
    docket.classList.add('is-stale');
    staleNote.hidden = false;
    announce('The measurements are incomplete. Update the measurement to refresh this result.');
    if (!output.hidden) output.classList.add('is-stale');
    for (const box of [docketBody, output]) box.querySelectorAll<HTMLElement>('.qc-actions-wrap, .qc-utility').forEach((controls) => (controls.inert = true));
  };

  /** Live while typing (the docket only, never an error), on submit (everything), or from a shared link. */
  const run = (mode: 'live' | 'submit' | 'link') => {
    const state = read();
    if (mode === 'live' && !ready() && !state.input.bespoke?.length && soldKind() !== 'panel-set') {
      if (lastSentence) markStale();
      return;
    }
    if (state.problems.length) {
      if (mode === 'live') {
        markStale();
        return;
      }
      output.hidden = true;
      delete form.dataset.hasResult;
      showErrors(state.problems);
      docketProblems(state.problems);
      announce(`Check the figures: ${state.problems[0].message}`);
      return;
    }
    const result = calculate(state.input);
    if (mode === 'live' && !result.ok && result.route === 'error') {
      markStale();
      return;
    }
    output.classList.remove('is-stale');
    if (mode !== 'live') {
      submitted = true;
      clearErrors();
    }
    render(state, result);
    if (!result.ok && result.route === 'error' && mode === 'submit') {
      const box = fieldFor(result.reason);
      if (box) showErrors([{ message: result.reason.replace('in centimetres', `in ${unitName()}`), field: box }]);
    }
    if (mode === 'submit') {
      const plan = result.ok && result.kind === 'plan' ? result : null;
      track('calculator_complete', plan
        ? { outcome: 'plan', mode: measure(), match: plan.match, sold: soldKind(), working: plan.working.count, check: materialsFor(state.input, plan, { condition: state.condition, makerId: state.makerId || undefined }).checks.length > 0, openings: plan.shortPieces > 0 }
        : { outcome: result.ok ? result.kind : result.route, mode: measure(), sold: soldKind() });
      requestAnimationFrame(() => docketHeading.focus());
    }
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
    const target = event.target as HTMLElement;
    if (target.matches('input[data-dim]')) syncUnits();
    if (target.getAttribute('aria-invalid') === 'true') clearError(target);
  });
  form.addEventListener('focusout', (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches('input[data-dim]')) return;
    const problems = read().problems.filter((problem) => problem.field === target);
    if (problems.length) showErrors(problems, false);
  });
  // A retained answer is visibly dimmed while a field is incomplete. It cannot send or share stale figures.
  form.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.closest('.is-stale') && target.closest('.qc-actions-wrap, .qc-utility')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  // A patterned match needs its repeat: clear the 0 and ask for it, rather than show an error.
  form.querySelector('[name="match"]')!.addEventListener('change', () => {
    syncMatch();
    const repeat = field('repeat') as HTMLInputElement;
    if (!['free', 'reverse'].includes(value('match')) && !(Number(repeat.value) > 0)) {
      repeat.value = '';
      repeat.placeholder = 'Add the pattern repeat';
      repeat.focus();
    }
  });
  form.querySelector('[name="condition"]')!.addEventListener('change', () => (conditionAnswered = true));
  form.querySelector('[name="link"]')!.addEventListener('change', readLink);
  form.querySelectorAll('[name="measure"]').forEach((radio) => radio.addEventListener('change', syncMeasure));
  addWall.addEventListener('click', () => addWallRow().querySelector('input')?.focus());
  form.querySelectorAll<HTMLButtonElement>('[data-add-opening]').forEach((button) =>
    button.addEventListener('click', () => addOpening(button.dataset.addOpening as OpeningInput['kind']).querySelector<HTMLInputElement>('[name="o-width"]')?.focus()),
  );
  form.querySelector('[data-add-return]')!.addEventListener('click', () => addReturn().querySelector<HTMLInputElement>('[name="r-depth"]')?.focus());
  // After a Remove, focus goes to the matching Add button, never to the page.
  form.addEventListener('click', (event) => {
    const remove = (event.target as Element).closest('[data-remove]');
    if (!remove) return;
    const row = remove.closest<HTMLElement>('[data-wall], [data-opening], [data-return]');
    if (!row) return;
    const next = row.matches('[data-wall]') ? addWall : row.matches('[data-opening]') ? form.querySelector<HTMLElement>(`[data-add-opening="${row.dataset.kind}"]`) : form.querySelector<HTMLElement>('[data-add-return]');
    row.remove();
    nameRows();
    labelWalls();
    next?.focus();
    live();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(timer);
    run('submit');
  });
  // The docket follows the typing, about 300 ms after the last key.
  let timer = 0;
  const live = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => run('live'), 300);
  };
  form.addEventListener('input', live);
  form.addEventListener('change', live);

  syncFormat(false);
  syncMatch();
  syncMeasure();
  syncUnits();
  if (fromQuery(new URLSearchParams(location.search))) {
    if (q0().has('mk') || q0().has('link')) $<HTMLDetailsElement>('[data-maker-box]').open = true;
    run('link');
  }
}
