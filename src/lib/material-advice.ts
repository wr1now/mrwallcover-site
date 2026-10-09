export const preferenceOptions = {
  use: { quiet: 'Bedroom or sitting room', busy: 'Busy hall or family space', commercial: 'Hotel or commercial space', wet: 'A wall exposed to splashes or regular steam', unsure: 'Not sure yet' },
  look: { natural: 'Natural texture', uniform: 'A more uniform finish', scenic: 'A scene or large composition', sheen: 'Sheen and changing light', unsure: 'Still exploring' },
  cleaning: { frequent: 'Regular cleaning matters', gentle: 'Gentle care is fine', unsure: 'Not sure yet' },
  panels: { visible: 'I like visible natural panels', discreet: 'I prefer a more uniform wall', unsure: 'Show me the difference' },
  light: { side: 'Strong light across the wall', mixed: 'A mix of daylight and lamps', unsure: 'Not sure yet' },
} as const;
export type Preferences = { [K in keyof typeof preferenceOptions]: keyof typeof preferenceOptions[K] };
export const defaultPreferences: Preferences = { use: 'unsure', look: 'unsure', cleaning: 'unsure', panels: 'unsure', light: 'unsure' };
export const PREFERENCE_KEY = 'mw-material-preferences';

export function parsePreferences(raw: unknown): Preferences | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const result = { ...defaultPreferences };
  for (const key of Object.keys(preferenceOptions) as (keyof Preferences)[]) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value !== 'string' || !Object.hasOwn(preferenceOptions[key], value)) return null;
    (result as Record<string, string>)[key] = value;
  }
  return result;
}

export function preferencesFromJSON(raw: string): Preferences | null {
  try { return parsePreferences(JSON.parse(raw)); } catch { return null; }
}

export function preferenceSummary(preferences: Preferences): string {
  return (Object.keys(preferenceOptions) as (keyof Preferences)[])
    .map((key) => (preferenceOptions[key] as Record<string, string>)[preferences[key]]).join(' · ');
}

/** Family-level editorial comparisons, never technical approval of a product. */
export function recommendFamilies(preferences: Preferences): { slugs: string[]; explanation: string } {
  if (preferences.use === 'wet') return { slugs: [], explanation: 'This position needs a product and wall-condition review. A material family cannot establish suitability for steam or direct splashes. Send photographs and the exact product reference before buying.' };
  if (preferences.look === 'scenic') return { slugs: ['murals', 'hand-painted'], explanation: 'Compare how the scene is produced and laid out. If cleaning matters, ask which grounds and care methods the supplier offers for the particular design.' };
  if (preferences.cleaning === 'frequent' || preferences.use === 'busy' || preferences.use === 'commercial') return { slugs: ['contract-vinyl', 'paper-and-non-woven'], explanation: 'Start by comparing the actual cleaning instructions and expected wear. These families contain different products; they are not all washable or approved for your project.' };
  if (preferences.look === 'natural' && preferences.panels !== 'discreet') return { slugs: ['grasscloth-and-weaves', 'silk-and-textiles', 'contract-vinyl'], explanation: 'Compare natural fibre, a textile face and a woven-look alternative. Look at a whole wall as well as a small sample before deciding how much variation you want.' };
  if (preferences.look === 'sheen') return { slugs: ['silk-and-textiles', 'paper-and-non-woven'], explanation: 'View samples in the room, by daylight and under lamps. Sheen and side lighting can emphasise both texture and the wall underneath.' };
  return { slugs: ['paper-and-non-woven', 'contract-vinyl'], explanation: 'Start with pattern, surface and care requirements. A more uniform appearance still has joints; ask to see an installed example of the actual product.' };
}
