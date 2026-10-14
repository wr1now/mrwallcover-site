/**
 * The materials dataset (src/data/wallpapering.json) as typed data, plus the quantity rules the
 * calculator and the Wallpapering hub share, so the two can never disagree.
 *
 * Every coverage figure comes from the product's own data sheet or page, copied as printed.
 * A product whose status is not 'confirmed' is listed for reference but never used in a sum.
 */
import data from '../data/wallpapering.json' with { type: 'json' };

export type ProductKind = 'primer' | 'stain-block' | 'alkali-primer' | 'lining' | 'lining-paste' | 'paste';

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
  role: 'house' | 'maker-named';
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
  stepStatus?: 'owner' | 'proposed';
  stepBasis?: string;
  coverage?: Coverage | null;
  packs?: Packs;
  quotes?: string[];
  dataSheet?: string | null;
  page?: string;
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
  lining: string;
  inspect: boolean;
}

export interface ConditionOption {
  id: string;
  label: string;
  primers: string[];
  lining: number | null;
  check: boolean;
}

export const wallpapering = data as unknown as {
  checked: string;
  independence: string;
  ladder: { step: number; label: string }[];
  houseRules: { id: string; title: string; text: string }[];
  products: Product[];
  makers: MakerRule[];
  wallTypes: WallType[];
  conditions: Condition[];
  conditionQuestion: { label: string; options: ConditionOption[] };
};

export const products = wallpapering.products;
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
 * The fewest containers that hold at least `amount`, from the sizes the maker prints.
 * Ties go to fewer containers, then less left over.
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
      if (!best || picked.length < best.length || (picked.length === best.length && total < best.reduce((a, b) => a + b, 0))) best = [...picked];
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
