#!/usr/bin/env node
/** Public factual catalogue metadata only. Does not copy artwork, photographs,
 * descriptions, private research or credentials. See catalogue provenance. */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const SOURCE = 'https://ukcheckout.bauwerkcolour.com/collections/colour-lab/products.json';
export const COLLECTION = 'https://www.bauwerkcolour.com/en-gb/collection/colour-lab';
const OUTPUT = new URL('../src/room-studio/catalogue/bauwerk-uk.json', import.meta.url);

export function normaliseProduct(product) {
  const tags = Array.isArray(product.tags) ? product.tags : String(product.tags ?? '').split(',').map(t => t.trim());
  if (product.product_type !== 'Colour' || tags.includes('search:hidden')) return null;
  const colour = tags.find(tag => /^colour-code:#[0-9a-f]{6}$/i.test(tag))?.split(':')[1].toUpperCase();
  if (!colour) throw new Error(`Official digital colour-code missing for ${product.handle}`);
  if (!Number.isSafeInteger(product.id) || !/^[a-z0-9-]+$/.test(product.handle ?? '') || !product.title?.trim()) throw new Error('Invalid source product identity');
  const families = tags.filter(tag => tag.startsWith('colour:')).map(tag => tag.slice(7).split('-#')[0]);
  if (!families.length) throw new Error(`Colour family missing for ${product.handle}`);
  return {
    id: String(product.id), name: product.title.trim(), slug: product.handle,
    colour, colourMethod: 'manufacturer-web-preview', families: [...new Set(families)].sort(),
    available: product.variants?.some(variant => variant.available === true) === true,
    productUrl: `https://www.bauwerkcolour.com/en-gb/product/${product.handle}`,
    sampleUrl: `https://www.bauwerkcolour.com/en-gb/product/${product.handle}`,
    sourceUpdatedAt: product.updated_at,
  };
}

export function validateCatalogue(data) {
  if (data.provider !== 'bauwerk' || data.market !== 'GB' || data.source !== SOURCE || !/^\d{4}-\d{2}-\d{2}$/.test(data.checkedAt)) throw new Error('Invalid catalogue provenance');
  if (data.shades.length < 300 || data.shades.length > 500) throw new Error('Unexpected full-palette size; inspect source before replacing catalogue');
  for (const key of ['id', 'slug', 'name']) if (new Set(data.shades.map(shade => shade[key])).size !== data.shades.length) throw new Error(`Duplicate ${key}`);
  if (data.shadeCount !== data.shades.length) throw new Error('Catalogue count mismatch');
  for (const shade of data.shades) {
    if (!/^#[0-9A-F]{6}$/.test(shade.colour) || shade.colourMethod !== 'manufacturer-web-preview') throw new Error('Invalid preview colour');
    if (shade.productUrl !== `https://www.bauwerkcolour.com/en-gb/product/${shade.slug}` || !shade.families.length) throw new Error('Invalid source link or family');
  }
  return data;
}

async function sync() {
  if (process.argv.includes('--check')) {
    const data = validateCatalogue(JSON.parse(await readFile(OUTPUT, 'utf8')));
    console.log(`Bauwerk UK catalogue valid: ${data.shades.length} sourced shades, checked ${data.checkedAt}.`);
    return;
  }
  const dateIndex = process.argv.indexOf('--date');
  const checkedAt = dateIndex >= 0 ? process.argv[dateIndex + 1] : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt ?? '')) throw new Error('Use --date YYYY-MM-DD');
  const products = [];
  const sourcePages = [];
  for (let page = 1; page <= 10; page++) {
    const url = `${SOURCE}?limit=250&page=${page}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'MrWallcover-CatalogueSync/1.0 (public product metadata verification)' } });
    if (!response.ok) throw new Error(`Source unavailable (${response.status}); existing catalogue retained`);
    const data = await response.json();
    if (!Array.isArray(data.products)) throw new Error('Unexpected source response; existing catalogue retained');
    products.push(...data.products);
    sourcePages.push(url);
    if (data.products.length < 250) break;
    if (page === 10) throw new Error('Pagination limit reached; no catalogue written');
  }
  const shades = products.map(normaliseProduct).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
  const digest = createHash('sha256').update(JSON.stringify(shades)).digest('hex');
  const data = validateCatalogue({
    schemaVersion: 1, provider: 'bauwerk', market: 'GB', checkedAt,
    version: `bauwerk-uk-${checkedAt}-${digest.slice(0, 12)}`, source: SOURCE, collectionUrl: COLLECTION,
    sourcePages, sourceMetadataSha256: digest, shadeCount: shades.length,
    colourNote: 'Manufacturer-published website preview colour-code metadata. Approximate screen representation; not measured paint colour or a physical colour match.',
    shades,
  });
  if (!process.argv.includes('--dry-run')) {
    await mkdir(new URL('../src/room-studio/catalogue/', import.meta.url), { recursive: true });
    await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`);
  }
  console.log(`${process.argv.includes('--dry-run') ? 'Verified' : 'Saved'} ${shades.length} Bauwerk UK shades (${checkedAt}); no artwork copied.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  sync().catch(error => { console.error(error.message); process.exitCode = 1; });
}
