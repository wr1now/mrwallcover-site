import type { APIRoute } from 'astro';
import { SITE_URL } from '../../config';
import { HOUSE_LINING_PASTE, isConfirmed, wallpapering, type Coverage, type MakerRule, type Product } from '../../lib/materials.ts';
import { formatLabel, rollFormats } from '../../lib/roll-formats.ts';

// An allowlisted projection of the published tables and calculator data. Do not serialize
// wallpapering.json wholesale: it also holds reference-only products and unconfirmed rules.
const liningPage = `${SITE_URL}/wallpapering/lining-and-adhesives/`;
const preparationPage = `${SITE_URL}/wallpapering/preparation/`;
const calculatorPage = `${SITE_URL}/calculator/`;

const coverage = (value: Coverage | null | undefined) => value ? {
  printed: value.printed,
  min: value.min,
  max: value.max,
  perUnit: value.perUnit,
  unit: value.unit,
  coats: value.coats,
  conflict: value.conflict,
  source: value.source,
  rollSizes: value.rollSizes?.map((roll) => ({ widthCm: roll.widthCm, lengthCm: roll.lengthCm, source: roll.source })),
} : null;

function publicProduct(item: Product) {
  return {
    id: item.id,
    kind: item.kind,
    role: item.role,
    name: item.name,
    maker: item.maker,
    what: item.what,
    for: item.for,
    grade: item.grade,
    wall: item.wall,
    rolls: item.rolls?.map((roll) => ({ lengthM: roll.lengthM, widthCm: roll.widthCm, printed: roll.printed })),
    soak: item.soak,
    // Only owner-approved steps appear in the published paste table. A proposed or
    // unplaced position must never become a machine-readable strength recommendation.
    step: item.stepStatus === 'owner' ? item.step : null,
    stepStatus: item.stepStatus === 'owner' ? 'house-practice' : item.stepStatus ? 'not-placed' : undefined,
    stepBasis: item.stepBasis,
    coverage: coverage(item.coverage),
    packs: item.packs ? {
      printed: item.packs.printed,
      sizes: item.packs.sizes,
      unit: item.packs.unit,
      status: item.packs.status,
      source: item.packs.source,
    } : undefined,
    // This is the quotation exposed by the published paste table, not all notes
    // that happen to be stored beside the public record.
    quotes: item.kind === 'paste' ? item.quotes?.slice(0, 1) : undefined,
    availability: item.availability,
    dataSheet: item.dataSheet,
    page: item.page,
    checked: item.checked,
    status: item.status,
  };
}

function publicMaker(rule: MakerRule) {
  const pasteUnconfirmed = rule.pasteStatus === 'unconfirmed';
  return {
    id: rule.id,
    name: rule.name,
    lining: {
      need: rule.lining.need,
      grades: rule.lining.grades,
      direction: rule.lining.direction,
      printed: rule.lining.printed,
    },
    liningPaste: rule.liningPaste,
    liningPastePrinted: rule.liningPastePrinted,
    paste: pasteUnconfirmed ? null : rule.paste,
    pastePrinted: pasteUnconfirmed ? null : rule.pastePrinted,
    pasteName: pasteUnconfirmed ? 'Confirm for the specific product' : rule.pasteName,
    pasteStatus: pasteUnconfirmed ? 'unconfirmed' : rule.pasteStatus,
    pasteCheck: rule.pasteCheck,
    pasteCoverage: pasteUnconfirmed ? null : coverage(rule.pasteCoverage),
    pasteSource: rule.pasteSource,
    pasteChecked: rule.pasteChecked,
    noOffcutInfill: rule.noOffcutInfill,
    notes: rule.notes,
    notesSource: rule.notesSource,
    source: rule.source,
    checked: rule.checked,
    status: rule.status,
  };
}

export const GET: APIRoute = () => new Response(JSON.stringify({
  schemaVersion: '1.0',
  url: `${SITE_URL}/ai/wallpapering.json`,
  title: 'Wallpapering: preparation, lining, adhesives and roll formats',
  sourceUrls: [`${SITE_URL}/wallpapering/`, preparationPage, liningPage, calculatorPage],
  checked: wallpapering.checked,
  independence: wallpapering.independence,
  interpretation: {
    housePractice: 'Our house standard where the wallpaper maker is silent.',
    pasteScale: 'Strength steps are our house scale, not a rating shared by manufacturers.',
    precedence: "The wallpaper maker's instruction for the product always comes first.",
    calculator: 'A quantity to order, not a set-out, and never a price.',
    calculatorUrl: calculatorPage,
    methodUrl: `${SITE_URL}/advice/quantities/`,
  },
  houseRules: wallpapering.houseRules.map((rule) => ({ id: rule.id, title: rule.title, text: rule.text })),
  ladder: wallpapering.ladder.map((step) => ({ step: step.step, label: step.label, alt: step.alt })),
  houseLiningPaste: HOUSE_LINING_PASTE,
  products: wallpapering.products.filter((item) => isConfirmed(item) && (
    ['primer', 'stain-block', 'alkali-primer', 'vov'].includes(item.kind)
    || (item.kind === 'lining' && item.role === 'house')
    || item.id === HOUSE_LINING_PASTE
    || (item.kind === 'paste' && item.role !== 'reference')
  )).map(publicProduct),
  makers: wallpapering.makers.filter(isConfirmed).map(publicMaker),
  wallTypes: wallpapering.wallTypes.map((wall) => ({
    id: wall.id, name: wall.name, treatment: wall.treatment, primer: wall.primer,
    primerNote: wall.primerNote, lining: wall.lining, inspect: wall.inspect,
  })),
  conditions: wallpapering.conditions.map((condition) => ({
    id: condition.id, name: condition.name, treatment: condition.treatment,
    products: condition.products, vov: condition.vov, lining: condition.lining, inspect: condition.inspect,
  })),
  conditionQuestion: {
    basis: 'house-practice',
    label: wallpapering.conditionQuestion.label,
    options: wallpapering.conditionQuestion.options.map((option) => ({
      id: option.id, label: option.label, primers: option.primers,
      lining: option.lining, check: option.check, vov: option.vov,
    })),
  },
  vov: { title: wallpapering.vov.title, text: wallpapering.vov.text },
  rollFormats: {
    sourceUrl: calculatorPage,
    checked: rollFormats.checked,
    groups: rollFormats.groups.map((group) => ({ id: group.id, label: group.label, soldBy: group.soldBy, unit: group.unit })),
    formats: rollFormats.formats.map((format) => ({
      id: format.id, group: format.group, label: formatLabel(format), width: format.width,
      widthUnit: format.widthUnit, length: format.length, lengthUnit: format.lengthUnit,
      overlapCm: format.overlapCm, rollsPerSet: format.rollsPerSet,
      source: format.source ? { label: format.source.label, url: format.source.url } : undefined,
    })),
    widthSuggestions: { cm: rollFormats.widthSuggestions.cm, in: rollFormats.widthSuggestions.in },
  },
}, null, 2) + '\n', { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
