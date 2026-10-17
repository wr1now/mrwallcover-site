/**
 * The materials dataset (src/data/wallpapering.json) as typed data, plus the quantity rules the
 * calculator and the Wallpapering hub share, so the two can never disagree.
 *
 * Every coverage figure comes from the product's own data sheet or page, copied as printed.
 * A product whose status is not 'confirmed' is listed for reference but never used in a sum.
 */
import data from '../data/wallpapering.json' with { type: 'json' };
import { liningPlan, type PlanResult, type QuantityInput } from './quantity.ts';

export type ProductKind = 'primer' | 'stain-block' | 'alkali-primer' | 'lining' | 'lining-paste' | 'paste' | 'vov';

export interface Coverage {
  printed: string;
  min?: number;
  max?: number;
  perUnit?: number;
  unit: string;
  coats?: number;
  conflict?: string;
}

export interface Packs {
  printed: string | null;
  sizes?: number[];
  unit?: string;
  status: string;
  source?: string;
}

export interface LiningRoll {
  lengthM: number;
  widthCm: number;
  printed: string;
}

export interface Product {
  id: string;
  kind: ProductKind;
  role: 'house' | 'maker-named' | 'reference';
  name: string;
  maker: string | null;
  what?: string;
  for?: string;
  grade?: number;
  wall?: string;
  rolls?: LiningRoll[];
  soak?: string;
  paste?: string;
  step?: number | null;
  stepStatus?: 'owner' | 'proposed' | 'unplaced';
  stepBasis?: string;
  coverage?: Coverage | null;
  packs?: Packs;
  quotes?: string[];
  dataSheet?: string | null;
  page?: string;
  /** When the maker no longer lists it: where the figures come from, and what to check. */
  availability?: string;
  checked: string | null;
  status: 'confirmed' | 'unconfirmed';
}

export interface MakerRule {
  id: string;
  name: string;
  lining: { need: string; grades: number[]; direction: string; printed: string | null };
  liningPaste?: string;
  liningPastePrinted?: string;
  paste?: string;
  pastePrinted?: string;
  pasteStep?: number;
  pasteName?: string;
  pasteStatus?: string;
  primerPrinted?: string;
  noOffcutInfill?: boolean;
  notes?: string[];
  notesSource?: string;
  pages?: string;
  source: string;
  checked: string;
  status: 'confirmed' | 'unconfirmed';
}

export interface WallType {
  id: string;
  name: string;
  treatment: string;
  primer: string | null;
  primerNote?: string;
  lining: number | null;
  inspect: string;
}

export interface Condition {
  id: string;
  name: string;
  treatment: string;
  products: string[];
  /** The surface is sealed: a vinyl-over-vinyl adhesive (VOV), outside the ladder (owner, 14 Oct 2026). */
  vov?: boolean;
  lining: string;
  inspect: boolean;
}

export interface ConditionOption {
  id: string;
  label: string;
  primers: string[];
  lining: number | null;
  check: boolean;
  vov?: boolean;
}

export const wallpapering = data as unknown as {
  checked: string;
  independence: string;
  ladder: { step: number; label: string; alt?: string }[];
  vov: { title: string; text: string };
  houseRules: { id: string; title: string; text: string }[];
  products: Product[];
  makers: MakerRule[];
  wallTypes: WallType[];
  conditions: Condition[];
  conditionQuestion: { label: string; options: ConditionOption[] };
};

export const products = wallpapering.products;
/** Vinyl-over-vinyl adhesives (VOV): for sealed surfaces, overlaps and borders; not on the ladder. The owner's label is "Vinyl-over-vinyl adhesive (VOV)". */
export const vovAdhesives = products.filter((item) => item.kind === 'vov');
export const makers = wallpapering.makers;

export function product(id: string): Product {
  const found = products.find((item) => item.id === id);
  if (!found) throw new Error(`No product "${id}" in src/data/wallpapering.json`);
  return found;
}

export function maker(id: string): MakerRule | undefined {
  return makers.find((item) => item.id === id);
}

export const ladderLabel = (step: number) => wallpapering.ladder.find((item) => item.step === step)?.label ?? `Step ${step}`;
export const TOP_STEP = Math.max(...wallpapering.ladder.map((item) => item.step));

/** House lining papers, lightest grade first. */
export const liningGrades = products.filter((item) => item.kind === 'lining' && item.role === 'house').sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0));

/** "9 October 2026" style is used on pages; the dataset keeps ISO dates. */
export const isConfirmed = (item: { status: string }) => item.status === 'confirmed';

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Litres of a primer for an area, from the printed coverage range: the low figure uses the
 * best coverage, the high figure the worst. Coats default to the data sheet's single coat.
 */
export function primerLitres(areaM2: number, item: Product, coats = item.coverage?.coats ?? 1): { min: number; max: number } | null {
  const cover = item.coverage;
  if (!isConfirmed(item) || !cover || cover.unit !== 'm2/l' || !cover.min || !cover.max || !(areaM2 > 0)) return null;
  return { min: round2((areaM2 * coats) / cover.max), max: round2((areaM2 * coats) / cover.min) };
}

/**
 * Containers that hold at least `amount`, from the sizes the maker prints: the least left over first,
 * then the fewest containers.
 */
export function packsFor(amount: number, sizes: number[]): number[] {
  if (!(amount > 0) || !sizes.length) return [];
  const units = (value: number) => Math.round(value * 100);
  const need = units(amount);
  const list = [...new Set(sizes.map(units))].sort((a, b) => b - a);
  const largest = list[0];
  // Fill with the largest container, then finish with the smallest set that covers the remainder.
  const full = Math.max(0, Math.floor((need - 1) / largest));
  const rest = need - full * largest;
  let best: number[] | null = null;
  const search = (remaining: number, from: number, picked: number[]) => {
    if (remaining <= 0) {
      const total = picked.reduce((a, b) => a + b, 0);
      const bestTotal = best ? best.reduce((a, b) => a + b, 0) : Infinity;
      if (!best || total < bestTotal || (total === bestTotal && picked.length < best.length)) best = [...picked];
      return;
    }
    if (picked.length >= 4) return;
    for (let i = from; i < list.length; i++) search(remaining - list[i], i, [...picked, list[i]]);
  };
  search(rest, 0, []);
  return [...Array(full).fill(largest), ...(best ?? [largest])].map((value) => value / 100);
}

/** Kilograms of a paste whose coverage is printed per kilogram. */
export function pasteKg(areaM2: number, item: Product): number | null {
  const cover = item.coverage;
  if (!isConfirmed(item) || !cover || cover.unit !== 'm2/kg' || !cover.perUnit || !(areaM2 > 0)) return null;
  return round2(areaM2 / cover.perUnit);
}

export type LiningPasteDecision =
  | { ok: true; paste: Product | null; pasteName: string; rule: 'house' | 'maker-same' | 'maker-named'; note: string }
  | { ok: false; reason: string };

export const HOUSE_LINING_PASTE = 'wallrock-power';

/**
 * Which paste goes under the lining (owner, 14 Oct 2026):
 * 1. The wallpaper maker's instruction wins: the same paste as the wallpaper (de Gournay), or a named lining paste (Muraspec).
 * 2. Otherwise the house lining paste, which must be at least one ladder step stronger than the wallpaper paste.
 * 3. If the wallpaper paste is already on the top step, nothing is stronger: have Mr Wallcover check it.
 */
export function liningPaste(wallpaperPasteStep: number | null, makerId?: string, wallpaperPasteName?: string): LiningPasteDecision {
  const rule = makerId ? maker(makerId) : undefined;
  if (rule?.liningPaste === 'same-as-paper') {
    return {
      ok: true,
      paste: null,
      pasteName: wallpaperPasteName ?? 'The same paste as the wallpaper',
      rule: 'maker-same',
      note: `${rule.name} asks for the lining to be hung with the same paste as the wallpaper. The maker's instruction replaces our house rule here.`,
    };
  }
  if (rule?.liningPaste === 'check') {
    return { ok: false, reason: `${rule.notes?.[0] ?? `${rule.name} gives no lining paste to check against.`} Have Mr Wallcover check this combination before anything is ordered.` };
  }
  if (rule?.liningPaste) {
    const named = product(rule.liningPaste);
    return { ok: true, paste: named, pasteName: named.name, rule: 'maker-named', note: `${rule.name} names ${named.name} for lining paper.` };
  }
  const house = product(HOUSE_LINING_PASTE);
  const houseStep = house.step ?? TOP_STEP;
  if (wallpaperPasteStep !== null && wallpaperPasteStep >= houseStep) {
    return {
      ok: false,
      reason: `The wallpaper paste is already ${ladderLabel(wallpaperPasteStep).toLowerCase()}, so no lining paste is a step stronger. Have Mr Wallcover check this combination before anything is ordered.`,
    };
  }
  const step = ladderLabel(houseStep).toLowerCase();
  return {
    ok: true,
    paste: house,
    pasteName: house.name,
    rule: 'house',
    note:
      wallpaperPasteStep === null
        ? `${house.name} is ${step}. The wallpaper paste must be at least one step lighter, so it cannot soften the lining.`
        : `${house.name} is ${step}, at least one step stronger than the wallpaper paste, so the wallpaper's paste cannot soften the lining.`,
  };
}

/* ---------- the materials list under a calculator result ---------- */


export interface MaterialLine {
  role: 'primer' | 'treatment' | 'lining' | 'lining-paste' | 'paste';
  name: string;
  /** The whole amount in words, e.g. "3.33–4.06 litres: 1 × 2.5 L + 2 × 1 L": need and packs together. */
  amount: string | null;
  /** What the wall needs, e.g. "3.33–4.06 litres", where a coverage gives it. */
  need?: string | null;
  /** What to buy, e.g. "1 × 2.5 L + 2 × 1 L" or "3 × 10 m rolls". */
  packs?: string | null;
  note?: string;
  source?: string | null;
  sourceLabel?: string;
}

export interface MaterialsList {
  lines: MaterialLine[];
  /** Reasons to have Mr Wallcover check the wall or the paste before anything is ordered. */
  checks: string[];
  /** What was assumed because the visitor did not say. */
  assumed: string[];
}

export interface MaterialsOptions {
  /** The wall-condition answer (conditionQuestion option id). */
  condition?: string;
  /** The wallpaper maker, when it has rules in the dataset. */
  makerId?: string;
}

const formatNumber = (value: number) => (Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100));
const packLine = (packs: number[], unit: string) => {
  const counts = new Map<number, number>();
  for (const size of packs) counts.set(size, (counts.get(size) ?? 0) + 1);
  return [...counts].map(([size, count]) => `${count} × ${formatNumber(size)} ${unit}`).join(' + ');
};
const sourceOf = (item: Product) => item.dataSheet ?? item.page ?? null;
/** The need and the packs, and the two together as the amount line. */
const amountOf = (need: string | null, packs: string | null) => ({ need, packs, amount: need && packs ? `${need}: ${packs}` : need ?? packs });

/** The lining grade: the maker's grade when it names one, otherwise the grade for the wall (owner, 14 Oct 2026). */
function liningGrade(conditionGrade: number | null, rule?: MakerRule): { grade: number; check?: string } | null {
  const makerWants = rule && ['all-walls', 'recommended'].includes(rule.lining.need);
  if (!conditionGrade && !makerWants) return null;
  const grades = rule?.lining.grades ?? [];
  if (!grades.length) return { grade: conditionGrade ?? 1000 };
  const wanted = conditionGrade ?? 0;
  const fit = [...grades].sort((a, b) => a - b).find((grade) => grade >= wanted);
  if (fit) return { grade: fit };
  return { grade: Math.max(...grades), check: `${rule!.name} asks for ${grades.join(' or ')} grade lining, lighter than this wall needs.` };
}

export function materialsFor(input: QuantityInput, result: PlanResult, options: MaterialsOptions = {}): MaterialsList {
  const lines: MaterialLine[] = [];
  const checks: string[] = [];
  const assumed: string[] = [];
  const option = wallpapering.conditionQuestion.options.find((item) => item.id === options.condition) ?? wallpapering.conditionQuestion.options[0];
  if (!options.condition) assumed.push(`The walls are ${option.label.toLowerCase()}.`);
  if (option.check) checks.push(`The walls are "${option.label.toLowerCase()}", so we should see them before anything is ordered.`);
  const rule = options.makerId ? maker(options.makerId) : undefined;
  const area = result.areaM2;

  // Primer and treatments: the maker's primer when it names one; otherwise the house primers for the wall.
  for (const id of option.primers) {
    const item = product(id);
    const litres = primerLitres(area, item);
    const sizes = item.packs?.sizes ?? [];
    const coats = item.coverage?.coats ?? 1;
    lines.push({
      role: item.kind === 'primer' ? 'primer' : 'treatment',
      name: item.name,
      ...amountOf(litres ? `${litres.min === litres.max ? formatNumber(litres.max) : `${formatNumber(litres.min)}–${formatNumber(litres.max)}`} litres` : null, litres && sizes.length ? packLine(packsFor(litres.max, sizes), 'L') : null),
      note: litres ? `${coats === 1 ? 'One coat' : `${coats} coats`}. The data sheet: "${item.coverage!.printed}"` : 'Quantity from its data sheet once the area is confirmed.',
      source: sourceOf(item),
      sourceLabel: item.dataSheet ? 'Data sheet' : "Maker's page",
    });
  }

  // Lining paper, hung across by default (owner), every roll the same grade.
  const graded = liningGrade(option.lining, rule);
  let lined = false;
  if (graded) {
    if (graded.check) checks.push(graded.check);
    const paper = liningGrades.find((item) => item.grade === graded.grade && isConfirmed(item));
    const roll = paper?.rolls?.[0];
    const plan = roll ? liningPlan(input, roll.widthCm, roll.lengthM * 100, 'across') : null;
    const doubles = paper?.rolls?.[1];
    const planDouble = doubles ? liningPlan(input, doubles.widthCm, doubles.lengthM * 100, 'across') : null;
    if (paper && roll && plan) {
      lined = true;
      lines.push({
        role: 'lining',
        name: paper.name,
        ...amountOf(null, `${plan.rolls} × ${roll.lengthM} m rolls${planDouble && doubles ? `, or ${planDouble.rolls} × ${doubles.lengthM} m` : ''}`),
        note: `Hung across, ${plan.pieces} courses. Every roll the same grade, so the same thickness and the same white.${rule && ['all-walls', 'recommended'].includes(rule.lining.need) ? ` ${rule.name} asks for lining.` : ''}`,
        source: sourceOf(paper),
        sourceLabel: "Maker's page",
      });
    }
  }

  // A sealed surface (gloss paint, an old vinyl) takes a VOV adhesive instead of a water-based paste.
  if (option.vov) {
    checks.push('An old wallcovering has to come off first: hanging vinyl over it voids the makers\u2019 fire rating certification. Check the wallpaper maker\u2019s guide.');
    const named = vovAdhesives.find((item) => rule && item.maker && rule.name && item.maker.includes(rule.name) && isConfirmed(item));
    // An amount only from a coverage the maker prints today, per kilogram (Muraspec's label); never from an archived page.
    const cover = named?.coverage;
    const kg = named && !named.availability && cover?.unit === 'm2/kg' && cover.min && cover.max && area > 0 ? { min: round2(area / cover.max), max: round2(area / cover.min) } : null;
    lines.push({
      role: 'paste',
      name: named ? named.name : 'A vinyl-over-vinyl adhesive (VOV) made for sealed surfaces',
      ...amountOf(kg ? `${formatNumber(kg.min)}–${formatNumber(kg.max)} kg` : null, kg && named!.packs?.sizes ? packLine(packsFor(kg.max, named!.packs.sizes), 'kg') : null),
      note: named
        ? kg
          ? `${rule!.name}\u2019s adhesive for a sealed surface. The label: "${cover!.printed}"`
          : `${rule!.name}\u2019s adhesive for a sealed surface.${named.availability ? ` ${named.availability}` : ' We confirm the amount from its instructions.'}`
        : 'A water-based paste cannot soak into a sealed surface. We choose the VOV adhesive with the wallpaper maker\u2019s instruction.',
      source: named ? sourceOf(named) : null,
      sourceLabel: named ? (named.dataSheet ? 'Data sheet' : "Maker's page") : undefined,
    });
    return { lines, checks, assumed };
  }

  // Wallpaper paste: the maker's own, with its printed quantity when there is one.
  const pasteProduct = rule?.paste ? product(rule.paste) : null;
  const pasteStep: number | null = pasteProduct?.step ?? rule?.pasteStep ?? null;
  const pasteName = pasteProduct?.name ?? rule?.pasteName ?? 'The paste the wallpaper maker names';
  let paste = amountOf(null, null);
  if (pasteProduct?.coverage?.unit === 'kg/roll' && pasteProduct.coverage.perUnit && isConfirmed(pasteProduct)) {
    const kg = pasteProduct.coverage.perUnit * result.working.count;
    paste = amountOf(`${formatNumber(kg)} kg`, pasteProduct.packs?.sizes ? packLine(packsFor(kg, pasteProduct.packs.sizes), 'kg') : null);
  }
  const fb = rule as (MakerRule & { pasteCoverage?: { perUnit: number } }) | undefined;
  if (!paste.amount && fb?.pasteCoverage?.perUnit) {
    const tubes = Math.ceil(result.working.count / fb.pasteCoverage.perUnit);
    paste = amountOf(null, `${tubes} ${tubes === 1 ? 'tube' : 'tubes'}`);
  }
  const pasteAmount = paste.amount;
  lines.push({
    role: 'paste',
    name: pasteName,
    ...paste,
    note: pasteAmount ? `"${pasteProduct?.coverage?.printed ?? 'Each tube can be used to hang five rolls of wallpaper.'}"` : 'We confirm the paste from the maker’s hanging instruction for the product.',
    source: pasteProduct ? sourceOf(pasteProduct) : rule?.source ?? null,
    sourceLabel: pasteProduct ? (pasteProduct.dataSheet ? 'Data sheet' : "Maker's page") : "Maker's instructions",
  });

  // Lining paste: at least one step stronger than the wallpaper paste, unless the maker says otherwise.
  if (lined) {
    const decision = liningPaste(pasteStep, rule?.id, pasteName);
    if (!decision.ok) checks.push(decision.reason);
    else {
      const kg = decision.paste ? pasteKg(area, decision.paste) : null;
      lines.push({
        role: 'lining-paste',
        name: decision.pasteName,
        ...amountOf(kg ? `${formatNumber(kg)} kg` : null, kg && decision.paste?.packs?.sizes ? packLine(packsFor(kg, decision.paste.packs.sizes), 'kg') : null),
        note: decision.note,
        source: decision.paste ? sourceOf(decision.paste) : rule?.source ?? null,
        sourceLabel: decision.paste ? (decision.paste.dataSheet ? 'Data sheet' : "Maker's page") : "Maker's instructions",
      });
    }
  }
  return { lines, checks, assumed };
}
