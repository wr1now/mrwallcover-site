/** Public homepage content moved on the owner's 19 October 2026 instruction.
 * The committed inventory contains only previously published content. Every entry
 * must remain in an indexable page's main content, never merely in an archive file.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readPage } from './build-ai-layer.mjs';

const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const decode = text => text.replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, decimal) => String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10)))
  .replace(/&(nbsp|amp|lt|gt|quot|apos|ndash|mdash|rsquo|lsquo|rdquo|ldquo|hellip|thinsp);/g, (_, name) => ({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',hellip:'…',thinsp:' '})[name]);
export const normalizePublicText = text => decode(text).normalize('NFKC').replace(/\s+/g, ' ').trim();
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].slice(1).map(match => [match[1].toLowerCase(), decode(match[2] ?? match[3] ?? match[4] ?? '')]));
const mainOf = html => html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
const imageSlot = value => {
  try { return new URL(value, 'https://www.mrwallcover.com').pathname.replace(/\.[a-z0-9]+$/i, '').replace(/-(?:\d{2,5}w?|preview|thumb)$/i, ''); }
  catch { return value; }
};

function treeOf(html) {
  const root = {tag:'root',attrs:{},children:[]}, stack = [root];
  const source = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|svg|canvas|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  for (const token of source.match(/<[^>]+>|[^<]+/g) ?? []) {
    if (token.startsWith('</')) {
      const tag = token.match(/^<\/([\w:-]+)/)?.[1]?.toLowerCase();
      const at = stack.findLastIndex(node => node.tag === tag);
      if (at > 0) stack.length = at;
    } else if (token.startsWith('<')) {
      const tag = token.match(/^<([\w:-]+)/)?.[1]?.toLowerCase();
      if (!tag) continue;
      const node = {tag,attrs:attrs(token),children:[]};
      stack.at(-1).children.push(node);
      if (!VOID.has(tag) && !token.endsWith('/>')) stack.push(node);
    } else stack.at(-1).children.push(token);
  }
  return root;
}
const hidden = node => node.attrs?.['aria-hidden'] === 'true' || Object.hasOwn(node.attrs ?? {}, 'hidden');
const textOf = node => typeof node === 'string' ? node : hidden(node) ? '' : node.children.map(textOf).join(' ');
const contains = (node, tag) => typeof node !== 'string' && node.children.some(child => typeof child !== 'string' && (child.tag === tag || contains(child, tag)));
function collect(tree, visit, includeHidden = false) {
  if (typeof tree === 'string' || (!includeHidden && hidden(tree))) return;
  visit(tree);
  for (const child of tree.children) collect(child, visit, includeHidden);
}
function faqPairs(html) {
  const pairs = [];
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    if (value['@type'] === 'FAQPage') for (const item of value.mainEntity ?? []) pairs.push([normalizePublicText(item.name ?? ''), normalizePublicText(item.acceptedAnswer?.text ?? '')]);
    Object.values(value).forEach(visit);
  };
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) if (attrs('<script '+match[1]+'>').type === 'application/ld+json') visit(JSON.parse(match[2]));
  return pairs;
}
const unique = items => [...new Map(items.map(item => [JSON.stringify(item), item])).values()];

export function publishedHomeInventory(html, sourceCommit) {
  const main = mainOf(html), tree = treeOf(main), blocks = [], images = [], links = [], films = [];
  collect(tree, node => {
    if (['p','figcaption','dt','dd'].includes(node.tag) || (node.tag === 'li' && !contains(node, 'li'))) {
      const text = normalizePublicText(textOf(node));
      if (text) blocks.push(text);
    }
    if (node.tag === 'a' && node.attrs.href && !node.attrs.href.startsWith('#') && !node.attrs.href.startsWith('tel:')) links.push(node.attrs.href);
    for (const value of Object.values(node.attrs)) if (/^\/(?:media|videos)\/[^\s]+\.(?:mp4|webm|mov)(?:\?.*)?$/i.test(value)) films.push(value);
  });
  // Inactive carousel frames are still real photographs. Preserve them as well.
  collect(tree,node=>{
    if (node.tag === 'img' && node.attrs.src && !node.attrs.src.startsWith('data:') && !node.attrs.src.includes('/design-objects/')) images.push({slot:imageSlot(node.attrs.src),alt:node.attrs.alt ?? ''});
  },true);
  return {version:1,sourceCommit,source:'Previously published homepage main content; owner-authorised relocation, 19 October 2026.',mainSha256:createHash('sha256').update(main).digest('hex'),blocks:unique(blocks),links:unique(links),images:unique(images),films:unique(films),faqs:unique(faqPairs(html))};
}

async function htmlFiles(dir) {
  const result = [];
  for (const item of await readdir(dir, {withFileTypes:true})) {
    const file = path.join(dir,item.name);
    if (item.isDirectory()) result.push(...await htmlFiles(file));
    else if (item.name.endsWith('.html')) result.push(file);
  }
  return result;
}

export async function verifyHomePreservation(dist, inventory) {
  const pages = [];
  for (const file of await htmlFiles(dist)) {
    const page = await readPage(file);
    if (!page) continue;
    const html = await readFile(file,'utf8');
    const tree = treeOf(page.main), images = [], hrefs = [];
    collect(tree,node => {
      if (node.tag === 'a' && node.attrs.href) hrefs.push(node.attrs.href);
      if (node.tag === 'img' && node.attrs.src && !node.attrs.src.startsWith('data:')) images.push({slot:imageSlot(node.attrs.src),alt:node.attrs.alt ?? ''});
    });
    pages.push({path:page.pathname,text:normalizePublicText(textOf(tree)),html:page.main,images,hrefs,faqs:faqPairs(html)});
  }
  const missing = [], locations = [];
  const check = (kind, entries, predicate) => {
    for (const entry of entries) {
      const destinations = pages.filter(page => predicate(page,entry)).map(page => page.path);
      if (!destinations.length) missing.push({kind,value:entry});
      else locations.push({kind,value:entry,destinations});
    }
  };
  check('authored block',inventory.blocks,(page,text)=>page.text.includes(text));
  check('public link',inventory.links,(page,href)=>page.hrefs.includes(href));
  check('real photograph',inventory.images,(page,image)=>page.images.some(actual=>actual.slot===image.slot&&actual.alt===image.alt));
  check('film',inventory.films,(page,url)=>page.html.includes(url));
  check('FAQ pair',inventory.faqs,(page,pair)=>page.faqs.some(actual=>JSON.stringify(actual)===JSON.stringify(pair))&&pair.every(text=>page.text.includes(text)));
  return {passed:missing.length===0,sourceCommit:inventory.sourceCommit,publishedPages:pages.length,counts:{blocks:inventory.blocks.length,links:inventory.links.length,photographs:inventory.images.length,films:inventory.films.length,faqPairs:inventory.faqs.length},locations,missing};
}
