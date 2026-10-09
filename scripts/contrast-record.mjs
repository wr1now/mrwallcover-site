#!/usr/bin/env node
/**
 * WCAG contrast record for the Glass Atelier tokens (stage 5, step G3).
 *
 * Reads src/styles/tokens.css (one token per line), measures every
 * text/background pair the site uses, including text on each glass variant
 * composited over the lightest and darkest plausible backdrop (white and ink;
 * the worst case wins), and renders docs/glass-atelier/CONTRAST.md.
 *
 *   node scripts/contrast-record.mjs          print the table, exit 1 on a failing "used" pair
 *   node scripts/contrast-record.mjs --write  also rewrite docs/glass-atelier/CONTRAST.md
 *
 * tests/contrast.test.ts (npm run check) imports evaluate() and render() from
 * here, so the test, the table and the tokens can never disagree.
 *
 * Thresholds (WCAG 2.2 AA): 4.5:1 for body text, 3:1 for large text (at least
 * 24px regular or 18.66px bold) and for user-interface boundaries and
 * indicators (1.4.11). Pairs marked "forbidden" are measured to show why a
 * colour is not used as text in that place; they are expected to fail and the
 * test holds them to that, so the rule stays honest when a token changes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const TOKENS_PATH = path.join(here, '..', 'src', 'styles', 'tokens.css');
export const DOC_PATH = path.join(here, '..', 'docs', 'glass-atelier', 'CONTRAST.md');

const NEEDS = { body: 4.5, large: 3, ui: 3 };

/** `--name: value;` lines, whatever block they sit in. Values keep their trailing comment stripped. */
export function readTokens(file = TOKENS_PATH) {
  const css = readFileSync(file, 'utf8');
  const tokens = new Map();
  for (const line of css.split('\n')) {
    const m = line.match(/^\s*--([a-z0-9-]+)\s*:\s*([^;]+);/i);
    if (m) tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

function parseHex(value) {
  const m = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`not a 6-digit hex colour: ${value}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function channel(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Browser compositing: alpha blend in 8-bit sRGB, not in linear light. */
export function composite(fg, alpha, bg) {
  return fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]);
}

/**
 * A colour spec is a token name ("ink"), a literal ("#ffffff"), or a composite
 * { tint, alpha, over: [...] } which yields one candidate per backdrop.
 */
function resolve(tokens, spec) {
  if (typeof spec === 'string') {
    if (spec.startsWith('#')) return [{ label: spec, rgb: parseHex(spec) }];
    const value = tokens.get(`color-${spec}`);
    if (!value) throw new Error(`unknown colour token: ${spec}`);
    return [{ label: spec, rgb: parseHex(value) }];
  }
  const tint = resolve(tokens, spec.tint)[0];
  const alphaRaw = tokens.get(spec.alpha);
  if (!alphaRaw) throw new Error(`unknown alpha token: ${spec.alpha}`);
  const alpha = Number(alphaRaw);
  return spec.over.map((backdrop) => {
    const over = resolve(tokens, backdrop)[0];
    const rgb = composite(tint.rgb, alpha, over.rgb);
    return { label: `${tint.label} ${Math.round(alpha * 100)}% over ${over.label} = ${toHex(rgb)}`, rgb };
  });
}

const GLASS_BACKDROPS = ['#ffffff', 'ink'];
const champagne = { tint: 'ivory', alpha: 'glass-champagne-alpha', over: GLASS_BACKDROPS };
const smoked = { tint: 'ink', alpha: 'glass-smoked-alpha', over: GLASS_BACKDROPS };
const clearLight = { tint: '#ffffff', alpha: 'glass-clear-alpha', over: ['#ffffff', 'ivory', 'paper'] };
const clearDark = { tint: '#ffffff', alpha: 'glass-clear-alpha', over: ['ink'] };
const dock = { tint: 'ivory', alpha: 'glass-dock-alpha', over: GLASS_BACKDROPS };
const ghostRing = { tint: 'ivory', alpha: 'ghost-ring-alpha', over: ['ink'] };

/** Every text/background pair the shipped CSS produces. "where" names the selector or component. */
export const PAIRS = [
  // Opaque reading surfaces
  { id: 'ink/ivory', fg: 'ink', bg: 'ivory', size: 'body', status: 'used', where: 'body text on the page' },
  { id: 'ink/paper', fg: 'ink', bg: 'paper', size: 'body', status: 'used', where: 'cards, guide cards, material finder, proof section' },
  { id: 'ink/panel', fg: 'ink', bg: 'panel', size: 'body', status: 'used', where: 'form fields' },
  { id: 'ink/ivory-deep', fg: 'ink', bg: 'ivory-deep', size: 'body', status: 'used', where: 'guide "next step" band' },
  { id: 'stone/ivory', fg: 'stone', bg: 'ivory', size: 'body', status: 'used', where: '.lede, .caption (14.4px), breadcrumbs, text-stone' },
  { id: 'stone/paper', fg: 'stone', bg: 'paper', size: 'body', status: 'used', where: 'guide card text, captions on paper' },
  { id: 'stone-deep/panel', fg: 'stone-deep', bg: 'panel', size: 'body', status: 'used', where: 'field placeholders' },
  { id: 'brass/ivory', fg: 'brass', bg: 'ivory', size: 'body', status: 'used', where: '.eyebrow (12px uppercase), meta labels, footer pillars, guide "read" links' },
  { id: 'brass/paper', fg: 'brass', bg: 'paper', size: 'body', status: 'used', where: 'eyebrows on paper sections and guide cards' },
  { id: 'brass/ivory-deep', fg: 'brass', bg: 'ivory-deep', size: 'body', status: 'used', where: 'eyebrow in the guide "next step" band' },
  { id: 'error/ivory', fg: 'error', bg: 'ivory', size: 'body', status: 'used', where: '.form-error under a field' },
  { id: 'gold/ivory', fg: 'gold', bg: 'ivory', size: 'body', status: 'forbidden', where: 'gold is never text on ivory' },
  { id: 'gold/paper', fg: 'gold', bg: 'paper', size: 'body', status: 'forbidden', where: 'gold is never text on paper' },
  // Ink surfaces
  { id: 'ivory/ink', fg: 'ivory', bg: 'ink', size: 'body', status: 'used', where: 'hero copy, dark band, primary buttons, dock "Start" cell' },
  { id: 'ivory-soft/ink', fg: 'ivory-soft', bg: 'ink', size: 'body', status: 'used', where: '.on-dark .lede' },
  { id: 'gold/ink', fg: 'gold', bg: 'ink', size: 'body', status: 'used', where: '.on-dark .eyebrow (12px), the hero partnership link' },
  // Champagne glass (header; the chip and panel treatments are stage 6)
  { id: 'ink/champagne', fg: 'ink', bg: champagne, size: 'body', status: 'used', where: 'header links (15.2px), "Start", "Menu", wordmark' },
  { id: 'stone/champagne', fg: 'stone', bg: champagne, size: 'body', status: 'used', where: 'eyebrows and small text on glass (ink or stone, never brass or gold)' },
  { id: 'brass/champagne (large)', fg: 'brass', bg: champagne, size: 'large', status: 'used', where: 'wordmark "Mr" in brass, 26.4px serif' },
  { id: 'brass/champagne (small)', fg: 'brass', bg: champagne, size: 'body', status: 'forbidden', where: 'brass is not small text on glass' },
  { id: 'gold/champagne', fg: 'gold', bg: champagne, size: 'body', status: 'forbidden', where: 'gold is never text on glass' },
  { id: 'nav current line/champagne', fg: 'brass', bg: champagne, size: 'ui', status: 'used', where: '.nav-link[aria-current] 1px brass rule' },
  // Smoked glass (controls over dark photography; no shipped title uses it)
  { id: 'ivory/smoked', fg: 'ivory', bg: smoked, size: 'body', status: 'used', where: 'Glass variant="smoked" text' },
  { id: 'ivory-soft/smoked', fg: 'ivory-soft', bg: smoked, size: 'body', status: 'used', where: 'secondary text on smoked' },
  { id: 'gold/smoked (small)', fg: 'gold', bg: smoked, size: 'body', status: 'forbidden', where: 'a gold eyebrow on smoked over light paper fails; eyebrows on smoked are ivory' },
  { id: 'gold/smoked (large)', fg: 'gold', bg: smoked, size: 'large', status: 'used', where: 'gold allowed on smoked at 24px and above only' },
  // Clear glass (small controls, light backgrounds only)
  { id: 'ink/clear over light', fg: 'ink', bg: clearLight, size: 'body', status: 'used', where: 'material studio preset buttons over the page' },
  { id: 'ink/clear over ink', fg: 'ink', bg: clearDark, size: 'body', status: 'forbidden', where: 'why clear glass never sits over dark photography' },
  { id: 'clear border/light', fg: { tint: 'ink', alpha: 'glass-clear-border-alpha', over: ['ivory'] }, bg: 'ivory', size: 'ui', status: 'noted', where: 'clear 1px ink ring at 12%: decorative, the control is identified by its label and ink text' },
  // Opaque dock (champagne without blur)
  { id: 'ink/dock', fg: 'ink', bg: dock, size: 'body', status: 'used', where: 'dock labels (13px) on the opaque champagne dock' },
  // User-interface boundaries and indicators (1.4.11, 3:1)
  { id: 'ghost ring/ink', fg: ghostRing, bg: 'ink', size: 'ui', status: 'used', where: '.btn-ghost border, ivory at 45% on ink' },
  { id: 'line border/ivory', fg: 'ink', bg: 'ivory', size: 'ui', status: 'used', where: '.btn-line border' },
  { id: 'field border/panel', fg: 'field-border', bg: 'panel', size: 'ui', status: 'used', where: '.field input/select/textarea border' },
  { id: 'focus ring/ivory', fg: 'brass', bg: 'ivory', size: 'ui', status: 'used', where: ':focus-visible outline' },
  { id: 'focus ring/paper', fg: 'brass', bg: 'paper', size: 'ui', status: 'used', where: ':focus-visible outline on paper' },
  { id: 'focus ring/ink', fg: 'gold', bg: 'ink', size: 'ui', status: 'used', where: '.on-dark :focus-visible outline' },
  { id: 'focus ring/champagne', fg: 'brass', bg: champagne, size: 'ui', status: 'used', where: 'focus outline on the header' },
  { id: 'focus ring/smoked', fg: 'gold', bg: smoked, size: 'ui', status: 'used', where: 'focus outline on smoked glass' },
  // Review-build banner (noindex preview only)
  { id: 'review banner', fg: '#473719', bg: '#e9dfcb', size: 'body', status: 'used', where: '.review-banner, MW_CONTENT_PREVIEW builds only' },
];

export function evaluate(tokens = readTokens()) {
  return PAIRS.map((pair) => {
    const fgs = resolve(tokens, pair.fg);
    const bgs = resolve(tokens, pair.bg);
    let worst = null;
    const combos = [];
    for (const fg of fgs) {
      for (const bg of bgs) {
        const ratio = contrast(fg.rgb, bg.rgb);
        combos.push({ fg: fg.label, bg: bg.label, ratio });
        if (!worst || ratio < worst.ratio) worst = { fg: fg.label, bg: bg.label, ratio };
      }
    }
    const needs = NEEDS[pair.size];
    const passes = worst.ratio >= needs;
    const ok = pair.status === 'used' ? passes : pair.status === 'forbidden' ? !passes : true;
    return { ...pair, needs, ratio: worst.ratio, worst, combos, passes, ok };
  });
}

function fmt(n) {
  return `${n.toFixed(2)}:1`;
}

export function render(results) {
  const lines = [
    '# Contrast record',
    '',
    'Generated by `node scripts/contrast-record.mjs --write` from `src/styles/tokens.css`; `tests/contrast.test.ts` (npm run check) fails when this file is stale, when a used pair drops below its threshold, or when a forbidden pair starts passing without the record being updated.',
    '',
    'Thresholds (WCAG 2.2 AA): body text 4.5:1; large text (24px regular, or 18.66px bold) and user-interface boundaries 3:1. Glass is measured as its tint composited over the lightest and darkest plausible backdrop (white and ink); the worst case is the ratio recorded. Browsers blend in 8-bit sRGB, so the composite is computed the same way.',
    '',
    '| Pair | Foreground | Background (worst case) | Ratio | Needs | Result | Where |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const r of results) {
    const result = r.status === 'forbidden' ? (r.passes ? 'PASSES, record is stale' : 'fails, as intended: not used') : r.status === 'noted' ? 'noted, no requirement' : r.passes ? 'pass' : 'FAIL';
    lines.push(`| ${r.id} | ${r.worst.fg} | ${r.worst.bg} | ${fmt(r.ratio)} | ${r.needs}:1 ${r.size} | ${result} | ${r.where} |`);
  }
  lines.push('', '## Composites in full', '');
  for (const r of results) {
    if (r.combos.length < 2) continue;
    lines.push(`- ${r.id}: ${r.combos.map((c) => `${c.fg} on ${c.bg} ${fmt(c.ratio)}`).join('; ')}`);
  }
  lines.push(
    '',
    '## Rules the record enforces',
    '',
    '- Gold is an accent. It is text only on ink (eyebrows, the hero partnership link) and on smoked glass at 24px and above. Never on ivory, paper or champagne.',
    '- Brass is text on ivory and paper, and on champagne glass only at display size (the wordmark). Eyebrows on glass are stone or ink.',
    '- Smoked glass carries ivory text and sits over dark photography or the studio stage. It carries no page title.',
    '- Clear glass is for small controls over the page and other light surfaces. Over ink it fails, so it is not used there.',
    '- The dock is champagne without blur (ivory at 96%), so the header is the only blurred surface on phones.',
    '',
  );
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const results = evaluate();
  const doc = render(results);
  if (process.argv.includes('--write')) writeFileSync(DOC_PATH, doc);
  else console.log(doc);
  const broken = results.filter((r) => !r.ok);
  for (const r of broken) console.error(`${r.status} pair out of place: ${r.id} ${fmt(r.ratio)} (needs ${r.needs}:1)`);
  process.exit(broken.length ? 1 : 0);
}
