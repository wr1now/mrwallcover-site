#!/usr/bin/env node
/**
 * Post-build: the plain-text layer for answer engines, generated from the
 * built HTML so it can never disagree with the pages.
 *
 *   dist/llms-full.txt        every published page's main content, in order,
 *                             each headed by its title and canonical URL
 *   dist/<path>/index.md      a Markdown twin of each published page
 *                             (the home page's twin is dist/index.md)
 *
 * A page is published when it is built, carries no noindex meta and is not a
 * redirect stub. Drafts are never built, so they never appear. The 404,
 * thank-you and search pages are noindex, so they are left out too.
 *
 * Only the <main> element is read. Scripts, styles, forms, media, buttons
 * and every <nav> (breadcrumbs, contents, related pages) are dropped;
 * headings, paragraphs, lists, definition lists, figure captions, tables and
 * links (made absolute) are kept.
 *
 * Runs as `npm run build`'s postbuild step. Usage: node scripts/build-ai-layer.mjs [distDir]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://www.mrwallcover.com';
const dist = path.resolve(process.argv[2] ?? 'dist');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? decode(match[1] ?? match[2] ?? match[3]) : undefined;
}

/** Elements whose whole subtree is dropped. None of them nests inside itself in this site. */
const DROP = ['script', 'style', 'svg', 'noscript', 'template', 'video', 'audio', 'picture', 'form', 'button', 'nav', 'select', 'textarea', 'iframe', 'canvas', 'object'];
const VOID = new Set(['br', 'hr', 'img', 'input', 'source', 'meta', 'link', 'wbr', 'area', 'col', 'embed', 'track']);
const BLOCK = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'aside', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'details', 'summary', 'blockquote', 'main', 'table', 'thead', 'tbody', 'tr', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'hr', 'fieldset', 'legend', 'address']);

/**
 * Convert one page's <main> HTML to Markdown. Deliberately small: it handles
 * the elements this site emits and treats anything else as inline text.
 */
export function toMarkdown(html, { base = SITE, demote = 0 } = {}) {
  let src = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of DROP) src = src.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
  src = src.replace(/<(img|input|source|meta|link)\b[^>]*>/gi, ' ');

  const blocks = [];
  let line = '';
  let prefix = '';
  let kind = 'p';
  const lists = [];
  const links = [];
  let row = null; // table row cells being collected
  let rowsInTable = 0;
  let inTable = false;
  let afterLink = false; // two links side by side get a space between them

  const flush = () => {
    const text = line.replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ kind, text: prefix + text });
    line = '';
    prefix = '';
    kind = 'p';
  };
  const indent = () => '  '.repeat(Math.max(0, lists.length - 1));

  for (const token of src.split(/(<[^>]+>)/g)) {
    if (!token) continue;
    if (token[0] !== '<') {
      line += decode(token);
      if (/\S/.test(token)) afterLink = false;
      continue;
    }
    const closing = token[1] === '/';
    const name = token.match(/^<\/?([a-z0-9-]+)/i)?.[1]?.toLowerCase();
    if (!name) continue;
    if (!closing) {
      if (/^h[1-6]$/.test(name)) {
        flush();
        kind = 'heading';
        prefix = '#'.repeat(Math.min(6, Number(name[1]) + demote)) + ' ';
      } else if (name === 'ul' || name === 'ol') {
        flush();
        lists.push({ type: name, index: 0 });
      } else if (name === 'li') {
        flush();
        const list = lists.at(-1) ?? { type: 'ul', index: 0 };
        list.index += 1;
        kind = 'li';
        prefix = `${indent()}${list.type === 'ol' ? `${list.index}.` : '-'} `;
      } else if (name === 'dt') {
        flush();
        kind = 'dt';
        prefix = '**';
      } else if (name === 'dd') {
        flush();
        kind = 'dd';
        prefix = ': ';
      } else if (name === 'a') {
        if (afterLink && line && !/\s$/.test(line)) line += ' ';
        const href = attr(token, 'href');
        links.push({ href, start: line.length });
      } else if (name === 'strong' || name === 'b') {
        line += '**';
      } else if (name === 'em' || name === 'i') {
        line += '*';
      } else if (name === 'br') {
        // A forced line break inside a heading or paragraph reads as a space in plain text.
        line += ' ';
      } else if (name === 'hr') {
        flush();
        blocks.push({ kind: 'p', text: '---' });
      } else if (name === 'table') {
        flush();
        inTable = true;
        rowsInTable = 0;
      } else if (name === 'tr') {
        flush();
        row = [];
      } else if (name === 'th' || name === 'td') {
        line = '';
      } else if (BLOCK.has(name)) {
        flush();
      }
      if (VOID.has(name)) continue;
    } else {
      if (/^h[1-6]$/.test(name)) {
        flush();
      } else if (name === 'ul' || name === 'ol') {
        flush();
        lists.pop();
      } else if (name === 'dt') {
        line += '**';
        flush();
      } else if (name === 'a') {
        const link = links.pop();
        if (!link) continue;
        const text = line.slice(link.start).replace(/\s+/g, ' ').trim();
        if (!link.href || link.href.startsWith('#') || !text) continue;
        const href = /^(mailto:|tel:|https?:)/i.test(link.href) ? link.href : new URL(link.href, base).href;
        line = `${line.slice(0, link.start)}[${text}](${href})`;
        afterLink = true;
      } else if (name === 'strong' || name === 'b') {
        line += '**';
      } else if (name === 'em' || name === 'i') {
        line += '*';
      } else if (name === 'th' || name === 'td') {
        if (row) row.push(line.replace(/\s+/g, ' ').trim());
        line = '';
      } else if (name === 'tr') {
        if (row && row.length) {
          blocks.push({ kind: 'tr', text: `| ${row.join(' | ')} |` });
          rowsInTable += 1;
          if (rowsInTable === 1) blocks.push({ kind: 'tr', text: `|${row.map(() => ' --- |').join('')}` });
        }
        row = null;
        line = '';
      } else if (name === 'table') {
        inTable = false;
        flush();
      } else if (BLOCK.has(name)) {
        flush();
      }
    }
  }
  flush();

  let out = '';
  let previous = null;
  for (const block of blocks) {
    const tight = previous && ((previous.kind === 'li' && block.kind === 'li') || (previous.kind === 'tr' && block.kind === 'tr') || (previous.kind === 'dt' && block.kind === 'dd'));
    out += (previous ? (tight ? '\n' : '\n\n') : '') + block.text;
    previous = block;
  }
  void inTable;
  return out.trim() + '\n';
}

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Read a built page. Returns null for pages that are not published. */
export async function readPage(file) {
  const html = await readFile(file, 'utf8');
  if (/<meta name="robots" content="noindex">/.test(html) || /http-equiv="refresh"/.test(html)) return null;
  const main = html.match(/<main id="main"[^>]*>([\s\S]*?)<\/main>/)?.[1];
  if (!main) throw new Error(`${file}: no <main id="main">`);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (!canonical) throw new Error(`${file}: no canonical`);
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const description = decode(html.match(/<meta name="description" content="([^"]*)">/)?.[1] ?? '');
  const author = decode(html.match(/<meta name="author" content="([^"]*)">/)?.[1] ?? '');
  const stamp = main.match(/<time datetime="(\d{4}-\d{2}-\d{2})" data-page-updated="(updated|reviewed)">/);
  return {
    file,
    pathname: new URL(canonical).pathname,
    canonical,
    title,
    description,
    author,
    dateKind: stamp?.[2] ?? null,
    date: stamp?.[1] ?? null,
    main,
  };
}

export async function build(distDir = dist) {
  const pages = [];
  for (const file of await htmlFiles(distDir)) {
    const page = await readPage(file);
    if (page) pages.push(page);
  }
  pages.sort((a, b) => (a.pathname === '/' ? -1 : b.pathname === '/' ? 1 : a.pathname.localeCompare(b.pathname)));
  if (pages.length < 50) throw new Error(`only ${pages.length} published pages found under ${distDir}`);

  const facts = JSON.parse(await readFile(path.resolve('src/data/facts.json'), 'utf8'));
  const full = [
    `# ${facts.brand}: full text of every published page`,
    '',
    `> ${facts.description}`,
    '',
    `Generated from the published HTML at build time. ${pages.length} pages. Each begins with its title and canonical URL; headings inside a page are one level down from the title. A short index is at ${SITE}/llms.txt.`,
    '',
  ];
  let twins = 0;
  for (const page of pages) {
    const body = toMarkdown(page.main, { demote: 0 });
    const dateLine = page.date ? `${page.dateKind === 'updated' ? 'last_updated' : 'last_reviewed'}: ${page.date}` : null;
    const front = ['---', `title: ${yamlString(page.title)}`, `url: ${page.canonical}`, ...(page.description ? [`description: ${yamlString(page.description)}`] : []), ...(page.author ? [`author: ${yamlString(page.author)}`] : []), ...(dateLine ? [dateLine] : []), '---', ''];
    const twinPath = path.join(distDir, page.pathname, 'index.md');
    await writeFile(twinPath, `${front.join('\n')}\n${body}`);
    twins += 1;

    full.push('---', '', `# ${page.title}`, `URL: ${page.canonical}`);
    if (page.date) full.push(`${page.dateKind === 'updated' ? 'Last updated' : 'Last reviewed'}: ${page.date}`);
    full.push('', toMarkdown(page.main, { demote: 1 }));
  }
  await writeFile(path.join(distDir, 'llms-full.txt'), full.join('\n'));

  // /sitemap.xml is the address crawlers and people try first. @astrojs/sitemap only writes
  // sitemap-index.xml, so serve an identical copy of the index at the conventional path too.
  await writeFile(path.join(distDir, 'sitemap.xml'), await readFile(path.join(distDir, 'sitemap-index.xml'), 'utf8'));
  return { pages: pages.length, twins };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  build()
    .then(({ pages, twins }) => {
      console.log(`[ai-layer] llms-full.txt from ${pages} published pages; ${twins} Markdown twins written under ${path.relative(process.cwd(), dist) || '.'}`);
    })
    .catch((error) => {
      console.error(`[ai-layer] ${error.message}`);
      process.exit(1);
    });
}
