import data from '../data/roll-formats.json' with { type: 'json' };
import type { SoldBy } from './quantity.ts';

/**
 * The roll sizes offered on /calculator/ (src/data/roll-formats.json). Each preset is a size a maker prints;
 * any other width or length can be typed, in centimetres or inches and metres, feet or yards.
 */

export type WidthUnit = 'cm' | 'in';
export type LengthUnit = 'm' | 'ft' | 'yd';
export type GroupId = 'roll' | 'double-roll' | 'set' | 'bolt' | 'length-m' | 'length-yd' | 'mural' | 'panel-set';

export interface FormatGroup {
  id: GroupId;
  label: string;
  soldBy: SoldBy['kind'];
  unit?: 'm' | 'yd';
}

export interface RollFormat {
  id: string;
  group: GroupId;
  width?: number;
  widthUnit?: WidthUnit;
  length?: number | null;
  lengthUnit?: LengthUnit;
  overlapCm?: number;
  rollsPerSet?: number;
  source?: { label: string; url: string };
}

/** Centimetres in one of each unit. */
export const CM_PER: Record<WidthUnit | LengthUnit, number> = { cm: 1, in: 2.54, m: 100, ft: 30.48, yd: 91.44 };
export const toCm = (value: number, unit: WidthUnit | LengthUnit) => value * CM_PER[unit];
/** A value converted between units, rounded to two decimals for the form. */
export const convert = (value: number, from: WidthUnit | LengthUnit, to: WidthUnit | LengthUnit) => Math.round((value * CM_PER[from] * 100) / CM_PER[to]) / 100;

export const rollFormats = data as unknown as {
  checked: string;
  groups: FormatGroup[];
  formats: RollFormat[];
  widthSuggestions: Record<WidthUnit, number[]>;
};
export const formatGroups = rollFormats.groups;
export const formats = rollFormats.formats;
export const groupOf = (format: RollFormat) => formatGroups.find((group) => group.id === format.group)!;

const n = (value: number) => String(value);
const metric = (format: RollFormat) => {
  const w = toCm(format.width!, format.widthUnit!);
  const l = format.length ? toCm(format.length, format.lengthUnit!) / 100 : null;
  return `${Math.round(w * 10) / 10} cm${l ? ` × ${Math.round(l * 100) / 100} m` : ''}`;
};

/** The words for a preset in the size list, e.g. "52 cm × 10.05 m" or "27 in × 27 ft (68.6 cm × 8.23 m)". */
export function formatLabel(format: RollFormat): string {
  if (format.group === 'mural') return 'Made-to-measure mural, by the m²';
  if (format.group === 'panel-set') return 'Scenic or panel set';
  const size = `${n(format.width!)} ${format.widthUnit}${format.length ? ` × ${n(format.length)} ${format.lengthUnit}` : ''}`;
  const imperial = format.widthUnit === 'in' ? ` (${metric(format)})` : '';
  const extra = [format.overlapCm ? `${format.overlapCm} cm overlap` : '', format.rollsPerSet ? `${format.rollsPerSet} rolls a set` : ''].filter(Boolean).join(', ');
  const lead = format.id === 'standard' ? 'Standard roll, ' : '';
  return `${lead}${size}${imperial}${extra ? `, ${extra}` : ''}`;
}

/** The order unit for a group, as the calculator's SoldBy. */
export function soldByFor(group: FormatGroup, options: { rollsPerSet?: number; marginCm?: number } = {}): SoldBy {
  switch (group.soldBy) {
    case 'double-roll': return { kind: 'double-roll' };
    case 'bolt': return { kind: 'bolt' };
    case 'set': return { kind: 'set', rollsPerSet: options.rollsPerSet ?? 2 };
    case 'length': return { kind: 'length', unit: group.unit ?? 'm' };
    case 'mural': return { kind: 'mural', marginCm: options.marginCm ?? 0 };
    case 'panel-set': return { kind: 'panel-set' };
    default: return { kind: 'roll' };
  }
}
