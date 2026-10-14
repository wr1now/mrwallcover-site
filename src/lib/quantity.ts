/**
 * Mr Wallcover's wallpaper quantity engine, built to the spec the owner signed off on 14 October 2026
 * (docs/calculator/spec.md). It cuts every drop from rolls the way an installer would and reports the
 * cutting plan, the working rolls, one spare on its own line, and the order. It never gives a price.
 *
 * Inputs are centimetres. Internally every length is a whole number of ticks (120 per centimetre, so
 * 12 per millimetre), which keeps half, third and quarter repeats exact.
 */

export type Match = 'free' | 'reverse' | 'straight' | 'half' | 'third' | 'quarter';

export type SoldBy =
  | { kind: 'roll' }
  | { kind: 'double-roll' }
  | { kind: 'bolt'; minimumBolts?: number }
  | { kind: 'set'; rollsPerSet: number }
  | { kind: 'length'; unit: 'm' | 'yd'; minimumUnits?: number }
  | { kind: 'mural'; marginCm: number }
  | { kind: 'panel-set' };

export interface PaperInput {
  /** Usable width: the nominal width less any overlap or selvedge the maker prints. */
  widthCm: number;
  /** Roll, double-roll or bolt length. For paper sold by length, the longest piece the maker supplies. */
  lengthCm: number;
  repeatCm?: number;
  match: Match;
  soldBy?: SoldBy;
  trimTopCm?: number;
  trimBottomCm?: number;
  /** The maker says pieces are cut and hung in the order they come off the roll (Muraspec, Phillip Jeffries). */
  noOffcutInfill?: boolean;
}

export type OpeningKind = 'door' | 'window' | 'niche';

export interface OpeningInput {
  kind: OpeningKind;
  widthCm: number;
  heightCm: number;
  /** Floor (top of the skirting) to the bottom of the opening: 0 for a door, the sill for a window or a niche. */
  fromFloorCm?: number;
  /** Reveal depth. 0 or missing: a flush opening. */
  depthCm?: number;
  /** Which reveals are papered. A niche always has all four, and its back. */
  reveals?: 'none' | 'sides' | 'sides-head';
}

export interface WallInput {
  widthCm: number;
  /** Height to paper: from the top of the skirting to where the paper stops. */
  heightCm: number;
  /** Depth of each return on this wall (each side of a chimney breast or an alcove). */
  returnsCm?: number[];
  openings?: OpeningInput[];
}

export interface RoomInput {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  returnsCm?: number[];
  openings?: OpeningInput[];
}

export type Bespoke = 'stairs' | 'slope' | 'curved' | 'ceiling';

export interface QuantityInput {
  paper: PaperInput;
  walls?: WallInput[];
  room?: RoomInput;
  bespoke?: Bespoke[];
}

export type PieceKind = 'full' | 'above' | 'below' | 'part' | 'back';

export interface Cut {
  kind: PieceKind;
  /** Wall number, from 1. A room is wall 1. */
  wall: number;
  /** Drop number on that wall, from 1. */
  drop: number;
  lengthCm: number;
  /** Where the cut starts on the roll. */
  atCm: number;
  /** Half, third or quarter offset this drop needs, in centimetres of pattern. */
  offsetCm: number;
}

export interface RollPlan {
  roll: number;
  cuts: Cut[];
  /** Length left at the end of the roll. */
  leftoverCm: number;
}

export interface Unit {
  one: string;
  many: string;
}

export interface OrderLine {
  count: number;
  unit: Unit;
}

export interface CloseCall {
  extraCm: number;
  dimension: 'height' | 'width';
  working: number;
}

export type PlanResult = {
  ok: true;
  kind: 'plan';
  /** Strips across the wall or walls, before openings. */
  drops: number;
  fullDrops: number;
  shortPieces: number;
  /** Height of the first wall plus trim. */
  dropLengthCm: number;
  /** Straight match: distance between the starts of two drops cut from one roll. Otherwise the drop length. */
  cutPitchCm: number;
  /** Full drops that fit on a new roll, for the first wall. */
  dropsPerRoll: number;
  /** Allowed at the start of each roll to find the pattern. */
  startLossCm: number;
  trimTopCm: number;
  trimBottomCm: number;
  match: Match;
  method: 'drop-order' | 'phase';
  noOffcutInfill: boolean;
  rolls: RollPlan[];
  working: OrderLine;
  spare: OrderLine;
  order: OrderLine;
  /** Paper sold by length: what the plan uses, before rounding. */
  usedCm?: number;
  /** US double rolls: what the order is in single rolls, as priced. */
  singleRollsPriced?: number;
  /** Area the paper covers, for the materials list. */
  areaM2: number;
  /** Each run: its width after returns, its height and the drops across it. */
  runs: { widthCm: number; heightCm: number; drops: number }[];
};

export type MuralResult = {
  ok: true;
  kind: 'mural';
  widthCm: number;
  heightCm: number;
  marginCm: number;
  areaM2: number;
};

export type Refusal = { ok: false; route: 'request' | 'check' | 'error'; reason: string };

export type QuantityResult = PlanResult | MuralResult | Refusal;

/* ---------- units ---------- */

const TICKS = 120;
const toT = (cm: number) => Math.round(cm * TICKS);
const toCm = (t: number) => Math.round((t * 10) / TICKS) / 10;
const mod = (a: number, m: number) => ((a % m) + m) % m;
const bad = (value: unknown) => typeof value !== 'number' || !Number.isFinite(value) || value <= 0;
const negative = (value: unknown) => value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0);

export const DEFAULT_TRIM_CM = 5;
export const PHASES: Record<Match, number> = { free: 1, reverse: 1, straight: 1, half: 2, third: 3, quarter: 4 };

const UNITS: Record<string, Unit> = {
  roll: { one: 'roll', many: 'rolls' },
  'double-roll': { one: 'double roll', many: 'double rolls' },
  bolt: { one: 'bolt', many: 'bolts' },
  m: { one: 'metre', many: 'metres' },
  yd: { one: 'yard', many: 'yards' },
};
export const plural = (line: OrderLine) => `${line.count} ${line.count === 1 ? line.unit.one : line.unit.many}`;

const BESPOKE: Record<Bespoke | 'panel-set', string> = {
  stairs: 'A stairwell has sloping lines and drops of changing length, so it is set out from a site measure.',
  slope: 'A sloping wall or ceiling changes the length of every drop, so it is set out from a site measure.',
  curved: 'A curved wall is set out on site.',
  ceiling: 'A papered ceiling is set out from the room, so we measure it for you.',
  'panel-set': 'Scenic and panel sets are ordered by panel from the elevations, not by roll.',
};

/* ---------- pieces ---------- */

interface Piece {
  kind: PieceKind;
  len: number;
  phase: number;
  cls: number;
  wall: number;
  drop: number;
  seq: number;
}

interface Ctx {
  w: number;
  R: number;
  m: number;
  t: number;
}

interface Run {
  width: number;
  height: number;
  openings: OpeningInput[];
  wall: number;
}

function piecesFor(run: Run, ctx: Ctx): { pieces: Piece[]; drops: number } | string {
  const { w, R, m, t } = ctx;
  const N = Math.ceil(run.width / w);
  const H = run.height;
  const phaseOf = (i: number) => (R && m > 1 ? ((i % m) * R) / m : 0);
  const pieces: Piece[] = [];
  const over = new Set<number>();
  let next = 1;
  for (const opening of run.openings) {
    const Ow = toT(opening.widthCm);
    const Oh = toT(opening.heightCm);
    const F = toT(opening.fromFloorCm ?? 0);
    const d = toT(opening.depthCm ?? 0);
    if (bad(opening.widthCm) || bad(opening.heightCm) || negative(opening.fromFloorCm) || negative(opening.depthCm)) {
      return 'Each door, window or niche needs a width and a height greater than zero.';
    }
    const A = H - F - Oh;
    if (A < 0) return 'An opening reaches higher than the wall. Check its height and its distance from the floor.';
    const niche = opening.kind === 'niche';
    const sides = niche || opening.reveals === 'sides' || opening.reveals === 'sides-head';
    const head = niche || opening.reveals === 'sides-head';
    const k = Math.floor(Ow / w);
    if (next + k > N) return 'The openings are wider than the wall. Check the widths.';
    const strips = Array.from({ length: k }, (_, j) => next + j);
    for (const i of strips) {
      over.add(i);
      const turnHead = head ? d : 0;
      if (A + turnHead > 0) pieces.push({ kind: 'above', len: A + turnHead + t, phase: phaseOf(i), cls: i % m, wall: run.wall, drop: i + 1, seq: i * 10 + 1 });
      if (opening.kind !== 'door' && F > 0) {
        const turnBase = niche ? d : 0;
        const y = H - F - turnBase;
        pieces.push({ kind: 'below', len: F + turnBase + t, phase: R ? mod(phaseOf(i) + y, R) : 0, cls: i % m, wall: run.wall, drop: i + 1, seq: i * 10 + 2 });
      }
    }
    if (sides && d > 0) {
      // The owner's rule: each reveal side adds a part-drop of 1.3 × (ceiling to head + reveal depth), rounded up to the repeat.
      const raw13 = 13 * (A + d);
      const P = R ? Math.ceil(raw13 / (10 * R)) * R : Math.ceil(raw13 / (10 * TICKS)) * TICKS;
      const left = Math.max(0, next - 1);
      const right = Math.min(N - 1, next + k);
      pieces.push({ kind: 'part', len: P, phase: phaseOf(left), cls: left % m, wall: run.wall, drop: left + 1, seq: left * 10 + 5 });
      pieces.push({ kind: 'part', len: P, phase: phaseOf(right), cls: right % m, wall: run.wall, drop: right + 1, seq: right * 10 + 5 });
    }
    if (niche) {
      const backs = Math.ceil(Ow / w);
      const first = k ? next : Math.max(0, next - 1);
      for (let j = 0; j < backs; j++) {
        pieces.push({ kind: 'back', len: Oh + t, phase: R ? mod(phaseOf(first) + A, R) : 0, cls: first % m, wall: run.wall, drop: first + 1, seq: first * 10 + 3 + j / 100 });
      }
    }
    next += k + 1;
  }
  for (let i = 0; i < N; i++) {
    if (!over.has(i)) pieces.push({ kind: 'full', len: H + t, phase: phaseOf(i), cls: i % m, wall: run.wall, drop: i + 1, seq: i * 10 });
  }
  return { pieces, drops: N };
}

/* ---------- the cutting plan ---------- */

interface Roll {
  no: number;
  cursor: number;
  align: number | null;
  cuts: { piece: Piece; at: number }[];
}

interface Plan {
  rolls: Roll[];
  method: 'drop-order' | 'phase';
}

function simulate(pieces: Piece[], L: number, R: number, method: 'drop-order' | 'phase', noInfill: boolean): Plan | string {
  const startLoss = R;
  const rolls: Roll[] = [];
  let current: Roll | null = null;
  const open = () => {
    const roll: Roll = { no: rolls.length + 1, cursor: 0, align: null, cuts: [] };
    rolls.push(roll);
    return roll;
  };
  const startOn = (roll: Roll, piece: Piece): number | null => {
    let start: number;
    if (roll.align === null) start = startLoss;
    else if (!R) start = roll.cursor;
    else start = roll.cursor + mod(piece.phase - (roll.align + roll.cursor), R);
    return start + piece.len <= L ? start : null;
  };
  const place = (roll: Roll, piece: Piece, at: number) => {
    if (roll.align === null) roll.align = R ? mod(piece.phase - at, R) : 0;
    roll.cuts.push({ piece, at });
    roll.cursor = at + piece.len;
  };
  const bestFit = (piece: Piece) => {
    let best: { roll: Roll; at: number; left: number } | null = null;
    for (const roll of rolls) {
      const at = startOn(roll, piece);
      if (at === null) continue;
      const left = L - (at + piece.len);
      if (!best || left < best.left) best = { roll, at, left };
    }
    return best;
  };
  const fresh = (piece: Piece): string | null => {
    current = open();
    const at = startOn(current, piece);
    if (at === null) return `A ${toCm(piece.len)} cm drop does not fit on one roll once ${toCm(startLoss)} cm is allowed to find the pattern.`;
    place(current, piece, at);
    return null;
  };
  const inOrder = (piece: Piece, offcuts: boolean): string | null => {
    const at = current ? startOn(current, piece) : null;
    if (current && at !== null) {
      place(current, piece, at);
      return null;
    }
    if (offcuts) {
      const best = bestFit(piece);
      if (best) {
        place(best.roll, piece, best.at);
        return null;
      }
    }
    return fresh(piece);
  };

  const bySeq = (a: Piece, b: Piece) => a.wall - b.wall || a.seq - b.seq;
  if (noInfill) {
    for (const piece of [...pieces].sort(bySeq)) {
      const error = inOrder(piece, false);
      if (error) return error;
    }
    return { rolls, method: 'drop-order' };
  }
  const full = pieces.filter((piece) => piece.kind === 'full').sort(bySeq);
  const ordered = method === 'phase' ? [...full].sort((a, b) => a.wall - b.wall || a.cls - b.cls || a.seq - b.seq) : full;
  for (const piece of ordered) {
    const error = inOrder(piece, true);
    if (error) return error;
  }
  const shorts = pieces.filter((piece) => piece.kind !== 'full').sort((a, b) => b.len - a.len || bySeq(a, b));
  for (const piece of shorts) {
    const best = bestFit(piece);
    if (best) place(best.roll, piece, best.at);
    else {
      const error = fresh(piece);
      if (error) return error;
    }
  }
  return { rolls, method };
}

/** Full drops of one height that fit on a new roll, cut the way the plan cuts them. */
function capacity(h: number, L: number, R: number, m: number, method: 'drop-order' | 'phase'): number {
  let cursor = 0;
  let align: number | null = null;
  let count = 0;
  for (let i = 0; i < 1000; i++) {
    const phase = R && m > 1 && method === 'drop-order' ? ((i % m) * R) / m : 0;
    const start = align === null ? R : R ? cursor + mod(phase - (align + cursor), R) : cursor;
    if (start + h > L) break;
    if (align === null) align = R ? mod(phase - start, R) : 0;
    cursor = start + h;
    count++;
  }
  return count;
}

/* ---------- the calculation ---------- */

function runsOf(input: QuantityInput): Run[] | string {
  if (input.room) {
    const room = input.room;
    if (bad(room.lengthCm) || bad(room.widthCm) || bad(room.heightCm)) return 'Enter the room length, width and height in centimetres.';
    const returns = (room.returnsCm ?? []).reduce((sum, depth) => sum + depth, 0);
    if ((room.returnsCm ?? []).some((depth) => negative(depth))) return 'A return depth cannot be negative.';
    return [{ width: toT(2 * (room.lengthCm + room.widthCm) + returns), height: toT(room.heightCm), openings: room.openings ?? [], wall: 1 }];
  }
  const walls = input.walls ?? [];
  if (!walls.length) return 'Add at least one wall.';
  const runs: Run[] = [];
  for (const [index, wall] of walls.entries()) {
    if (bad(wall.widthCm) || bad(wall.heightCm)) return 'Each wall needs a width and a height greater than zero.';
    if ((wall.returnsCm ?? []).some((depth) => negative(depth))) return 'A return depth cannot be negative.';
    const returns = (wall.returnsCm ?? []).reduce((sum, depth) => sum + depth, 0);
    runs.push({ width: toT(wall.widthCm + returns), height: toT(wall.heightCm), openings: wall.openings ?? [], wall: index + 1 });
  }
  return runs;
}

function areaOf(runs: Run[]): number {
  let cm2 = 0;
  for (const run of runs) {
    cm2 += toCm(run.width) * toCm(run.height);
    for (const o of run.openings) {
      const d = o.depthCm ?? 0;
      const niche = o.kind === 'niche';
      cm2 -= o.widthCm * o.heightCm;
      if (niche || o.reveals === 'sides' || o.reveals === 'sides-head') cm2 += 2 * d * o.heightCm;
      if (niche || o.reveals === 'sides-head') cm2 += d * o.widthCm;
      if (niche) cm2 += d * o.widthCm + o.widthCm * o.heightCm;
    }
  }
  return Math.round(cm2 / 100) / 100;
}

export function calculate(input: QuantityInput): QuantityResult {
  const bespoke = input.bespoke ?? [];
  if (bespoke.length) return { ok: false, route: 'request', reason: BESPOKE[bespoke[0]] };
  const paper = input.paper;
  const soldBy = paper.soldBy ?? { kind: 'roll' };
  if (soldBy.kind === 'panel-set') return { ok: false, route: 'request', reason: BESPOKE['panel-set'] };

  if (soldBy.kind === 'mural') {
    const walls = input.walls ?? [];
    if (input.room || walls.length !== 1) return { ok: false, route: 'request', reason: 'A mural across more than one wall is set out from the elevations, so we measure it for you.' };
    const wall = walls[0];
    if (bad(wall.widthCm) || bad(wall.heightCm)) return { ok: false, route: 'error', reason: 'Enter the wall width and height in centimetres.' };
    if (negative(soldBy.marginCm)) return { ok: false, route: 'error', reason: 'The margin cannot be negative.' };
    const widthCm = wall.widthCm + soldBy.marginCm;
    const heightCm = wall.heightCm + soldBy.marginCm;
    return { ok: true, kind: 'mural', widthCm, heightCm, marginCm: soldBy.marginCm, areaM2: Math.round((widthCm * heightCm) / 100) / 100 };
  }

  if (bad(paper.widthCm)) return { ok: false, route: 'error', reason: 'Enter the usable width of the paper, greater than zero.' };
  if (soldBy.kind !== 'length' && bad(paper.lengthCm)) return { ok: false, route: 'error', reason: 'Enter the roll length, greater than zero.' };
  if (negative(paper.trimTopCm) || negative(paper.trimBottomCm)) return { ok: false, route: 'error', reason: 'Trim cannot be negative.' };
  if (negative(paper.repeatCm)) return { ok: false, route: 'error', reason: 'The pattern repeat cannot be negative.' };
  const patterned = paper.match !== 'free' && paper.match !== 'reverse';
  if (patterned && bad(paper.repeatCm)) return { ok: false, route: 'error', reason: 'A patterned paper needs its pattern repeat. Free match papers have none.' };
  if (soldBy.kind === 'set' && !(Number.isInteger(soldBy.rollsPerSet) && soldBy.rollsPerSet > 1)) return { ok: false, route: 'error', reason: 'A set needs at least two rolls.' };

  const runs = runsOf(input);
  if (typeof runs === 'string') return { ok: false, route: 'error', reason: runs };

  const trimTopCm = paper.trimTopCm ?? DEFAULT_TRIM_CM;
  const trimBottomCm = paper.trimBottomCm ?? DEFAULT_TRIM_CM;
  const ctx: Ctx = { w: toT(paper.widthCm), R: patterned ? toT(paper.repeatCm ?? 0) : 0, m: patterned ? PHASES[paper.match] : 1, t: toT(trimTopCm + trimBottomCm) };
  const L = soldBy.kind === 'length' ? toT(paper.lengthCm > 0 ? paper.lengthCm : 3000) : toT(paper.lengthCm);

  const pieces: Piece[] = [];
  const runInfo: PlanResult['runs'] = [];
  let drops = 0;
  for (const run of runs) {
    const made = piecesFor(run, ctx);
    if (typeof made === 'string') return { ok: false, route: 'error', reason: made };
    pieces.push(...made.pieces);
    drops += made.drops;
    runInfo.push({ widthCm: toCm(run.width), heightCm: toCm(run.height), drops: made.drops });
  }

  const noInfill = Boolean(paper.noOffcutInfill);
  const methods: ('drop-order' | 'phase')[] = ctx.m > 1 && !noInfill ? ['drop-order', 'phase'] : ['drop-order'];
  let chosen: Plan | null = null;
  for (const method of methods) {
    const plan = simulate(pieces, L, ctx.R, method, noInfill);
    if (typeof plan === 'string') return { ok: false, route: 'check', reason: `${plan} Have Mr Wallcover check this.` };
    if (!chosen || plan.rolls.length < chosen.rolls.length) chosen = plan;
  }
  const plan = chosen!;
  const h = runs[0].height + ctx.t;
  const cutPitch = ctx.R && ctx.m === 1 ? Math.ceil(h / ctx.R) * ctx.R : h;
  const rolls: RollPlan[] = plan.rolls.map((roll) => ({
    roll: roll.no,
    leftoverCm: toCm(L - roll.cursor),
    cuts: roll.cuts.map(({ piece, at }) => ({ kind: piece.kind, wall: piece.wall, drop: piece.drop, lengthCm: toCm(piece.len), atCm: toCm(at), offsetCm: toCm(piece.phase && piece.kind === 'full' ? piece.phase : 0) })),
  }));

  const used = plan.rolls.length;
  let working: OrderLine;
  let spare: OrderLine;
  let usedCm: number | undefined;
  let singleRollsPriced: number | undefined;
  switch (soldBy.kind) {
    case 'double-roll':
      working = { count: used, unit: UNITS['double-roll'] };
      spare = { count: 1, unit: UNITS['double-roll'] };
      singleRollsPriced = (used + 1) * 2;
      break;
    case 'bolt':
      working = { count: Math.max(used, soldBy.minimumBolts ?? 0), unit: UNITS.bolt };
      spare = { count: 1, unit: UNITS.bolt };
      break;
    case 'set': {
      const unit = { one: `set of ${soldBy.rollsPerSet} rolls`, many: `sets of ${soldBy.rollsPerSet} rolls` };
      working = { count: Math.ceil(used / soldBy.rollsPerSet), unit };
      spare = { count: 1, unit };
      break;
    }
    case 'length': {
      const unitT = toT(soldBy.unit === 'yd' ? 91.44 : 100);
      const total = plan.rolls.reduce((sum, roll) => sum + roll.cursor, 0);
      usedCm = toCm(total);
      working = { count: Math.max(Math.ceil(total / unitT), soldBy.minimumUnits ?? 0), unit: UNITS[soldBy.unit] };
      spare = { count: Math.ceil(cutPitch / unitT), unit: UNITS[soldBy.unit] };
      break;
    }
    default:
      working = { count: used, unit: UNITS.roll };
      spare = { count: 1, unit: UNITS.roll };
  }
  const order = { count: working.count + spare.count, unit: working.unit };

  return {
    ok: true,
    kind: 'plan',
    drops,
    fullDrops: pieces.filter((piece) => piece.kind === 'full').length,
    shortPieces: pieces.filter((piece) => piece.kind !== 'full').length,
    dropLengthCm: toCm(h),
    cutPitchCm: toCm(cutPitch),
    dropsPerRoll: capacity(h, L, ctx.R, ctx.m, plan.method),
    startLossCm: toCm(ctx.R),
    trimTopCm,
    trimBottomCm,
    match: paper.match,
    method: plan.method,
    noOffcutInfill: noInfill,
    rolls,
    working,
    spare,
    order,
    usedCm,
    singleRollsPriced,
    areaM2: areaOf(runs),
    runs: runInfo,
  };
}

/**
 * The close-call warning (owner, 14 Oct 2026): when 1–5 cm more height, or 1–5 cm more width, would add a
 * working roll, say so. Width is checked for one wall or a room.
 */
export function closeCall(input: QuantityInput, base: PlanResult, limitCm = 5): CloseCall | null {
  const working = (variant: QuantityInput) => {
    const result = calculate(variant);
    return result.ok && result.kind === 'plan' ? result.working.count : null;
  };
  for (let extra = 1; extra <= limitCm; extra++) {
    const taller: QuantityInput = input.room
      ? { ...input, room: { ...input.room, heightCm: input.room.heightCm + extra } }
      : { ...input, walls: (input.walls ?? []).map((wall) => ({ ...wall, heightCm: wall.heightCm + extra })) };
    const count = working(taller);
    if (count !== null && count > base.working.count) return { extraCm: extra, dimension: 'height', working: count };
    const single = input.room || (input.walls ?? []).length === 1;
    if (!single) continue;
    const wider: QuantityInput = input.room
      ? { ...input, room: { ...input.room, lengthCm: input.room.lengthCm + extra / 2 } }
      : { ...input, walls: (input.walls ?? []).map((wall) => ({ ...wall, widthCm: wall.widthCm + extra })) };
    const countWide = working(wider);
    if (countWide !== null && countWide > base.working.count) return { extraCm: extra, dimension: 'width', working: countWide };
  }
  return null;
}

/* ---------- lining paper ---------- */

export interface LiningPlan {
  orientation: 'across' | 'upright';
  rolls: number;
  pieces: number;
  areaM2: number;
}

/**
 * Lining counted like the wallpaper, so no waste percentage is invented (spec 8.3). Across (cross-lined,
 * the owner's default): each wall gets ceil(height ÷ lining width) courses of the wall's width plus trim,
 * split where a course is longer than a roll. Upright: ceil(run ÷ lining width) strips of height plus trim.
 */
export function liningPlan(input: QuantityInput, liningWidthCm: number, liningLengthCm: number, orientation: 'across' | 'upright' = 'across'): LiningPlan | null {
  const runs = runsOf(input);
  if (typeof runs === 'string' || bad(liningWidthCm) || bad(liningLengthCm)) return null;
  const w = toT(liningWidthCm);
  const L = toT(liningLengthCm);
  const t = toT(2 * DEFAULT_TRIM_CM);
  const pieces: Piece[] = [];
  let seq = 0;
  const add = (len: number, wall: number) => {
    let remaining = len;
    while (remaining > 0) {
      const part = Math.min(remaining, L);
      pieces.push({ kind: 'full', len: part, phase: 0, cls: 0, wall, drop: ++seq, seq });
      remaining -= part;
    }
  };
  // A room is lined wall by wall: two lengths and two widths.
  const walls = input.room
    ? [input.room.lengthCm, input.room.widthCm, input.room.lengthCm, input.room.widthCm].map((width, index) => ({ width: toT(width + (index === 0 ? (input.room!.returnsCm ?? []).reduce((a, b) => a + b, 0) : 0)), height: toT(input.room!.heightCm), wall: index + 1 }))
    : runs.map((run) => ({ width: run.width, height: run.height, wall: run.wall }));
  for (const wall of walls) {
    if (orientation === 'across') {
      const courses = Math.ceil(wall.height / w);
      for (let c = 0; c < courses; c++) add(wall.width + t, wall.wall);
    } else {
      const strips = Math.ceil(wall.width / w);
      for (let s = 0; s < strips; s++) add(wall.height + t, wall.wall);
    }
  }
  const plan = simulate(pieces, L, 0, 'drop-order', false);
  if (typeof plan === 'string') return null;
  return { orientation, rolls: plan.rolls.length, pieces: pieces.length, areaM2: areaOf(runs) };
}

/* ---------- the ordering allowance quoted elsewhere on the site ---------- */

export interface AllowanceWall {
  widthM: number;
  heightM: number;
}

export interface AllowanceInput {
  walls: AllowanceWall[];
  rollWidthM: number;
  rollLengthM: number;
  match: string;
}

export type AllowanceResult =
  | { ok: true; netAreaM2: number; rollAreaM2: number; minPct: number; maxPct: number; minRolls: number; maxRolls: number; note: string }
  | { ok: false; reason: string };

/**
 * The ordering allowance Mr Wallcover quotes (src/content/guides/installation-cost.md, buyer-answers.json):
 * typically 15–30% over the net wall area, with staircases at the high end (around 30%). The calculator no
 * longer shows it beside the cutting plan; the AI layer and the cost guide still quote it.
 */
export const ALLOWANCE = { minPct: 15, maxPct: 30, stairPct: 30 } as const;

export function allowanceRange(input: AllowanceInput): AllowanceResult {
  if (input.match === 'mural' || input.match === 'panel') {
    return { ok: false, reason: 'Murals and panel sets are ordered by panel from the elevations, not by roll, so no allowance figure is given.' };
  }
  if (!input.walls.length) return { ok: false, reason: 'Add at least one wall.' };
  if (bad(input.rollWidthM) || bad(input.rollLengthM)) return { ok: false, reason: 'Enter a usable roll width and roll length greater than zero.' };
  if (input.walls.some((wall) => bad(wall.widthM) || bad(wall.heightM))) return { ok: false, reason: 'Each wall needs a width and a height greater than zero.' };
  const netAreaM2 = Math.round(input.walls.reduce((sum, wall) => sum + wall.widthM * wall.heightM, 0) * 100) / 100;
  const rollAreaM2 = Math.round(input.rollWidthM * input.rollLengthM * 1000) / 1000;
  const stair = input.match === 'stair';
  const minPct = stair ? ALLOWANCE.stairPct : ALLOWANCE.minPct;
  const maxPct = stair ? ALLOWANCE.stairPct : ALLOWANCE.maxPct;
  // Integer arithmetic in square centimetres, so 13.5 m² × 1.15 never rounds the wrong way.
  const rolls = (pct: number) => Math.ceil((Math.round(netAreaM2 * 10000) * (100 + pct)) / (Math.round(rollAreaM2 * 10000) * 100));
  return {
    ok: true,
    netAreaM2,
    rollAreaM2,
    minPct,
    maxPct,
    minRolls: rolls(minPct),
    maxRolls: rolls(maxPct),
    note: stair ? 'Staircases sit at the high end, around 30%, because of the angles.' : 'Typically 15–30%, depending on the pattern repeat and the layout.',
  };
}
