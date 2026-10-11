/**
 * Restricted roll estimator.
 * Supports plain/free-match and simple straight-match on rectangular walls.
 * It refuses half-drop, murals, stairwells and panel layouts.
 * Results are assumptions for discussion, never a purchase quantity or a quote.
 */

export type MatchType = 'free' | 'straight' | 'half-drop' | 'mural' | 'stair' | 'panel';

export interface WallInput {
  widthM: number;
  heightM: number;
}

export interface EstimateInput {
  walls: WallInput[];
  /** Combined top and bottom trimming allowance, metres. */
  trimM: number;
  rollWidthM: number;
  rollLengthM: number;
  match: MatchType;
  /** Pattern repeat in metres. Required for straight match. */
  repeatM?: number;
}

export interface WallResult {
  drops: number;
  cutLengthM: number;
  dropsPerRoll: number;
  rolls: number;
}

export type EstimateResult =
  | {
      ok: true;
      match: 'free' | 'straight';
      walls: WallResult[];
      rolls: number;
      assumptions: string[];
    }
  | { ok: false; reason: string };

const UNSUPPORTED: Record<string, string> = {
  'half-drop': 'Half-drop matching needs a surveyed set-out. This calculator will not guess a roll count.',
  mural: 'Panelled murals are set out from the artwork, not from a roll formula.',
  stair: 'Stairwells and sloping walls need a site measure.',
  panel: 'Bespoke and panel layouts need a surveyed set-out.',
};

function mm(metres: number): number {
  return Math.round(metres * 1000);
}

function metresFromMm(value: number): number {
  return Math.round(value) / 1000;
}

function invalid(value: number): boolean {
  return !Number.isFinite(value) || value <= 0;
}

function wallRolls(wall: WallInput, trimM: number, rollWidthM: number, rollLengthM: number, cutMm: number): WallResult | string {
  const width = mm(wall.widthM);
  const rollWidth = mm(rollWidthM);
  const rollLength = mm(rollLengthM);
  if (width <= 0 || rollWidth <= 0) return 'Enter a wall width and a usable roll width greater than zero.';
  const drops = Math.ceil(width / rollWidth);
  if (cutMm <= 0) return 'The cut length must be greater than zero.';
  if (cutMm > rollLength) return 'The roll is shorter than one cut length, so a roll count would not be reliable.';
  const dropsPerRoll = Math.floor(rollLength / cutMm);
  if (dropsPerRoll < 1) return 'The roll is shorter than one cut length, so a roll count would not be reliable.';
  const rolls = Math.ceil(drops / dropsPerRoll);
  return {
    drops,
    cutLengthM: metresFromMm(cutMm),
    dropsPerRoll,
    rolls,
  };
}

export function estimateRolls(input: EstimateInput): EstimateResult {
  if (input.match in UNSUPPORTED) {
    return { ok: false, reason: UNSUPPORTED[input.match] };
  }
  if (input.match !== 'free' && input.match !== 'straight') {
    return { ok: false, reason: 'This match type is not supported by the calculator.' };
  }
  if (!input.walls.length) return { ok: false, reason: 'Add at least one wall.' };
  if (invalid(input.trimM) && input.trimM !== 0) return { ok: false, reason: 'Trimming allowance cannot be negative.' };
  if (input.trimM < 0 || !Number.isFinite(input.trimM)) return { ok: false, reason: 'Trimming allowance cannot be negative.' };
  if (invalid(input.rollWidthM) || invalid(input.rollLengthM)) {
    return { ok: false, reason: 'Enter a usable roll width and roll length greater than zero.' };
  }

  const assumptions = [
    'Each wall is a plain rectangle. Doors and windows are not deducted, because a drop is still cut to full height.',
    'A leftover length on one wall is not used on the next wall.',
    'Units are metres. The maker’s instruction and a surveyed set-out override this figure.',
    'This is not a confirmed purchase quantity and it is not a quotation.',
  ];

  const walls: WallResult[] = [];
  for (const wall of input.walls) {
    if (invalid(wall.widthM) || invalid(wall.heightM)) {
      return { ok: false, reason: 'Each wall needs a width and a height greater than zero.' };
    }
    const baseCut = mm(wall.heightM + input.trimM);
    let cutMm = baseCut;
    if (input.match === 'straight') {
      if (input.repeatM === undefined || invalid(input.repeatM)) {
        return { ok: false, reason: 'Straight match needs a pattern repeat greater than zero.' };
      }
      const repeat = mm(input.repeatM);
      cutMm = Math.ceil(baseCut / repeat) * repeat;
      assumptions.push('Straight match uses an aligned starting phase and does not add a further pattern-start loss.');
    }
    const result = wallRolls(wall, input.trimM, input.rollWidthM, input.rollLengthM, cutMm);
    if (typeof result === 'string') return { ok: false, reason: result };
    walls.push(result);
  }

  return {
    ok: true,
    match: input.match,
    walls,
    rolls: walls.reduce((sum, wall) => sum + wall.rolls, 0),
    assumptions: [...new Set(assumptions)],
  };
}
