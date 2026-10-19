#!/usr/bin/env node
/**
 * Post-build: the plain-text layer for answer engines, generated from the
 * built HTML so it can never disagree with the pages.
 *
 *   dist/llms-full.txt        every published page's main content, in order,
 *                             each headed by its title and canonical URL
 *   dist/<path>/index.md      a Markdown twin of each published page
 *                             (the home page's twin is dist/index.md)
 *   dist/ai/index.json        discoverable manifest of exactly those pages
 *   dist/ai/pages.json        semantic page records, including Markdown,
 *                             public JSON-LD and meaningful media descriptions
 *   dist/ai/pages/<path>/index.json one complete page record for selective retrieval
 *   dist/ai/projects.json    existing project summary fields enriched with the
 *                             exact corresponding semantic page record
 *   dist/ai/projects/*.json  one complete record for selective retrieval
 *
 * A page is published when it is built, carries no noindex meta and is not a
 * redirect stub. Drafts are never built, so they never appear. The 404,
 * thank-you and search pages are noindex, so they are left out too.
 *
 * Main content is read without scripts, styles or navigation chrome. Public
 * form guidance and choices, image alt text, diagram descriptions, media
 * references, headings, lists, captions, tables and code are retained. No
 * input values, submission endpoints or client-side state are exported.
 *
 * Runs as `npm run build`'s postbuild step. Usage: node scripts/build-ai-layer.mjs [distDir]
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildReaderMirror } from './ai-reader-mirror.mjs';

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
const DROP = ['script', 'style', 'template', 'nav', 'textarea', 'datalist', 'iframe', 'canvas', 'object'];
const VOID = new Set(['br', 'hr', 'img', 'input', 'source', 'meta', 'link', 'wbr', 'area', 'col', 'embed', 'track']);
const BLOCK = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'aside', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'details', 'summary', 'blockquote', 'main', 'table', 'thead', 'tbody', 'tr', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'hr', 'form', 'fieldset', 'legend', 'label', 'select', 'optgroup', 'option', 'button', 'address']);

const plainText = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const markdownLabel = (text) => text.replace(/([\\\[\]])/g, '\\$1');

function publicUrl(value, base, { mailto = false } = {}) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return (['http:', 'https:', ...(mailto ? ['mailto:'] : [])].includes(url.protocol)) ? url.href : null;
  } catch {
    return null;
  }
}

/** A diagram's accessible name/description is content; its drawing commands are not. */
function diagramDescription(svg) {
  const opening = svg.match(/^<svg\b[^>]*>/i)?.[0] ?? '';
  if (attr(opening, 'aria-hidden') === 'true') return null;
  const byId = new Map([...svg.matchAll(/<(title|desc)\b([^>]*)>([\s\S]*?)<\/\1>/gi)]
    .map((match) => [attr(match[2], 'id'), plainText(match[3])]));
  const labelled = (attr(opening, 'aria-labelledby') ?? '').split(/\s+/).map((id) => byId.get(id)).filter(Boolean);
  const described = (attr(opening, 'aria-describedby') ?? '').split(/\s+/).map((id) => byId.get(id)).filter(Boolean);
  const label = attr(opening, 'aria-label');
  const fallback = [...byId.values()].filter(Boolean);
  const description = [...new Set([...(label ? [label] : labelled.length ? labelled : fallback), ...described])].join(' ');
  const labels = [...new Set([...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map((match) => plainText(match[1])).filter(Boolean))];
  return [description, labels.length ? `Labels: ${labels.join('; ')}.` : ''].filter(Boolean).join(' ') || null;
}

function mediaSources(tag, body, base) {
  return [...new Set([attr(tag, 'src'), ...[...body.matchAll(/<source\b[^>]*>/gi)].map((match) => attr(match[0], 'src'))]
    .map((value) => publicUrl(value, base)).filter(Boolean))];
}

/** Keep only content, never form input values, embedded payloads or telephone controls. */
function contentHtml(html) {
  let src = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of DROP) src = src.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
  src = src.replace(/<p\b[^>]*class=["'][^"']*\bhoneypot\b[^"']*["'][^>]*>[\s\S]*?<\/p>/gi, ' ');
  src = src.replace(/<button\b[^>]*\bdata-phone-reveal\b[^>]*>[\s\S]*?<\/button>/gi, ' ');
  src = src.replace(/<a\b[^>]*href=["']tel:[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, ' ');
  // These are empty/output templates, not assertions about a completed enquiry.
  src = src.replace(/<div\b[^>]*\bdata-receipt\b[^>]*>[\s\S]*?<\/div>/gi, ' ');
  return src;
}

/**
 * Convert one page's <main> HTML to Markdown. Deliberately small: it handles
 * the elements this site emits and treats anything else as inline text.
 */
export function toMarkdown(html, { base = SITE, demote = 0 } = {}) {
  let src = contentHtml(html);
  const codeBlocks = [];
  src = src.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, body) => {
    const language = attr(body.match(/<code\b[^>]*>/i)?.[0] ?? '', 'class')?.match(/(?:^|\s)language-([\w-]+)/)?.[1] ?? '';
    const text = decode(body.replace(/<[^>]+>/g, '')).replace(/^\n|\n$/g, '');
    const fence = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1)));
    codeBlocks.push(`${fence}${language}\n${text}\n${fence}`);
    return `<ai-code-block data-index="${codeBlocks.length - 1}"></ai-code-block>`;
  });
  src = src.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, (svg) => {
    const description = diagramDescription(svg);
    return description ? `<p>Diagram: ${escapeHtml(description)}</p>` : ' ';
  });
  src = src.replace(/<(video|audio)\b([^>]*)>([\s\S]*?)<\/\1>|<(video|audio)\b([^>]*)\/>/gi, (match, kind, attributes, body = '', voidKind) => {
    const tag = match.match(/^<[^>]+>/)[0];
    const type = kind ?? voidKind;
    const description = attr(tag, 'aria-label') ?? `${type[0].toUpperCase()}${type.slice(1)}`;
    const sources = mediaSources(tag, body, base);
    return `<p>${sources.length ? sources.map((url) => `[${markdownLabel(`${type[0].toUpperCase()}${type.slice(1)}: ${description}`)}](${url})`).join(' ') : escapeHtml(description)}</p>`;
  });
  src = src.replace(/<img\b[^>]*>/gi, (tag) => {
    const alt = attr(tag, 'alt');
    const url = publicUrl(attr(tag, 'src'), base);
    return alt && url && attr(tag, 'aria-hidden') !== 'true' ? ` ![${markdownLabel(alt)}](${url}) ` : ' ';
  });
  src = src.replace(/<(input|source|meta|link)\b[^>]*>/gi, ' ');

  const blocks = [];
  let line = '';
  let prefix = '';
  let kind = 'p';
  const lists = [];
  const links = [];
  let afterLink = false; // two links side by side get a space between them
  // Tables are buffered and written at </table>, so a cell's lists and notes always stay with
  // their own row. A cell is a list of parts (text, list items, dt/dd pairs). A table whose cells
  // are plain text is written as a Markdown table; a table with lists or definition lists in its
  // cells is written as one record per row ("- **Header**: value", with the list as sub-items).
  let table = null;
  let row = null;
  let cell = null;
  let partKind = 'text';
  let partSep = '';
  const ROWLEVEL = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr']);
  const subNote = (token) => /\b(fr-sub|fr-maker)\b/.test(attr(token, 'class') ?? '');
  /** End the cell part being collected; the next part has this kind and, in a Markdown table, this separator before it. */
  const cut = (kind = 'text', sep = ' ') => {
    const text = line.replace(/\s+/g, ' ').trim();
    if (text) cell.parts.push({ kind: partKind, sep: partSep, text });
    line = '';
    partKind = kind;
    partSep = sep;
  };
  const cellText = (c) => c.parts.map((part, i) => `${i ? part.sep : ''}${part.kind === 'dt' ? `**${part.text}**:` : part.text}`).join('').trim();
  const writeTable = (t) => {
    const rows = t.rows.filter((r) => r.cells.length);
    if (!rows.length) return;
    const head = rows[0].cells.every((c) => c.th) ? rows[0] : null;
    if (!rows.some((r) => r.cells.some((c) => c.list))) {
      rows.forEach((r, i) => {
        blocks.push({ kind: 'tr', text: `| ${r.cells.map((c) => cellText(c).replace(/\|/g, '\\|')).join(' | ')} |` });
        if (i === 0) blocks.push({ kind: 'tr', text: `|${r.cells.map(() => ' --- |').join('')}` });
      });
      return;
    }
    const labels = head ? head.cells.map(cellText) : [];
    for (const r of head ? rows.slice(1) : rows) {
      const out = [];
      r.cells.forEach((c, j) => {
        const label = labels[j] ? `**${labels[j]}**:` : '';
        if (!c.list) {
          const text = cellText(c);
          if (text) out.push(`- ${label ? `${label} ` : ''}${text}`);
          return;
        }
        const pad = label ? '  ' : '';
        if (label) out.push(`- ${label}`);
        for (let k = 0; k < c.parts.length; k += 1) {
          const part = c.parts[k];
          if (part.kind === 'dt' && c.parts[k + 1]?.kind === 'dd') {
            out.push(`${pad}- **${part.text}**: ${c.parts[k + 1].text}`);
            k += 1;
          } else out.push(`${pad}- ${part.kind === 'dt' ? `**${part.text}**` : part.text}`);
        }
      });
      if (out.length) blocks.push({ kind: 'record', text: out.join('\n') });
    }
  };

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
    if (cell && !ROWLEVEL.has(name) && name !== 'th' && name !== 'td') {
      const hasText = /\S/.test(line);
      if (name === 'li' || name === 'dt' || name === 'dd') {
        if (!closing) {
          cell.list = true;
          cut(name, name === 'dd' ? ' ' : '; ');
        } else cut('text', ' ');
        continue;
      }
      if (BLOCK.has(name)) {
        if (partKind === 'text') cut('text', ' ');
        else line += ' ';
        continue;
      }
      if (name === 'span' && !closing && /display:\s*block/.test(attr(token, 'style') ?? '')) {
        if (partKind === 'text') cut('text', '; ');
        else line += '; ';
        continue;
      }
      if (name === 'small' || (name === 'span' && (closing || subNote(token)))) {
        if (!closing && hasText) line = /[(—]\s*$/.test(line) ? line : `${line.replace(/\s+$/, '')} — `;
        else if (closing) line += ' ';
        continue;
      }
    }
    if (!closing) {
      if (name === 'ai-code-block') {
        flush();
        blocks.push({ kind: 'code', text: codeBlocks[Number(attr(token, 'data-index'))] });
      } else if (/^h[1-6]$/.test(name)) {
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
      } else if (name === 'option') {
        flush();
        kind = 'li';
        prefix = '- ';
      } else if (name === 'optgroup') {
        flush();
        line = attr(token, 'label') ?? '';
        flush();
      } else if (name === 'select') {
        flush();
        line = attr(token, 'aria-label') ?? '';
        flush();
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
        table = { rows: [] };
      } else if (name === 'tr') {
        flush();
        row = { cells: [] };
      } else if (name === 'th' || name === 'td') {
        line = '';
        cell = { parts: [], list: false, th: name === 'th' };
        partKind = 'text';
        partSep = '';
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
        const href = publicUrl(link.href, base, { mailto: true });
        if (!href) continue;
        line = `${line.slice(0, link.start)}[${text}](${href})`;
        afterLink = true;
      } else if (name === 'strong' || name === 'b') {
        line += '**';
      } else if (name === 'em' || name === 'i') {
        line += '*';
      } else if (name === 'th' || name === 'td') {
        if (cell) {
          cut();
          if (row) row.cells.push(cell);
        }
        cell = null;
        line = '';
      } else if (name === 'tr') {
        if (row && row.cells.length) (table ??= { rows: [] }).rows.push(row);
        row = null;
        line = '';
      } else if (name === 'table') {
        flush();
        if (table) writeTable(table);
        table = null;
      } else if (BLOCK.has(name)) {
        flush();
      }
    }
  }
  flush();
  if (table) writeTable(table);

  let out = '';
  let previous = null;
  for (const block of blocks) {
    const tight = previous && ((previous.kind === 'li' && block.kind === 'li') || (previous.kind === 'tr' && block.kind === 'tr') || (previous.kind === 'dt' && block.kind === 'dd'));
    out += (previous ? (tight ? '\n' : '\n\n') : '') + block.text;
    previous = block;
  }
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

/** Media is described and linked, never embedded or represented as invented visual evidence. */
function pageSemantics(html, base) {
  const src = contentHtml(html);
  const figures = [...src.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    caption: plainText(match[1].match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '') || null,
  }));
  const captionAt = (index) => figures.find((figure) => figure.start <= index && index < figure.end)?.caption ?? null;
  const images = [...src.matchAll(/<img\b[^>]*>/gi)].flatMap((match) => {
    const tag = match[0];
    const url = publicUrl(attr(tag, 'src'), base);
    const alt = attr(tag, 'alt');
    if (!url || !alt || attr(tag, 'aria-hidden') === 'true') return [];
    const dimension = (name) => /^\d+$/.test(attr(tag, name) ?? '') ? Number(attr(tag, name)) : null;
    return [{ url, alt, caption: captionAt(match.index), width: dimension('width'), height: dimension('height') }];
  });
  const diagrams = [...src.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)].flatMap((match) => {
    const description = diagramDescription(match[0]);
    return description ? [{ description, caption: captionAt(match.index) }] : [];
  });
  const media = [...src.matchAll(/<(video|audio)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => {
    const tag = match[0].match(/^<[^>]+>/)[0];
    return {
      type: match[1].toLowerCase(),
      urls: mediaSources(tag, match[2], base),
      description: attr(tag, 'aria-label') ?? null,
      caption: captionAt(match.index),
      poster: publicUrl(attr(tag, 'poster') ?? attr(tag, 'data-poster'), base),
    };
  });
  const headings = [...src.matchAll(/<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map((match) => ({
    level: Number(match[1][1]),
    id: attr(match[2], 'id') ?? null,
    text: plainText(match[3]),
  }));
  const links = [...src.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    const url = publicUrl(attr(match[1], 'href'), base, { mailto: true });
    const text = plainText(match[2]) || attr(match[1], 'aria-label');
    return url && text ? [{ url, text }] : [];
  });
  // Navigation is omitted from prose, but its public destinations remain discoverable.
  for (const match of html.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi)) {
    for (const link of match[0].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const url = publicUrl(attr(link[1], 'href'), base, { mailto: true });
      const text = plainText(link[2]);
      if (url && text) links.push({ url, text });
    }
  }
  const unique = (items) => [...new Map(items.map((item) => [JSON.stringify(item), item])).values()];
  return { headings, links: unique(links), images: unique(images), diagrams: unique(diagrams), media: unique(media) };
}

/** JSON-LD is already public; telephone/contact payload fields remain outside this export. */
function publicStructuredData(value) {
  if (Array.isArray(value)) return value.map(publicStructuredData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/^_|^(?:phone|telephone|faxNumber|apiKey|token|manifestNote|placeholder)$/i.test(key))
    .map(([key, item]) => [key, publicStructuredData(item)]));
  return value;
}

/** Read a built page. Returns null for pages that are not published. */
export async function readPage(file) {
  const html = await readFile(file, 'utf8');
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  if (metas.some((tag) => (attr(tag, 'name')?.toLowerCase() === 'robots' && /\bnoindex\b/i.test(attr(tag, 'content') ?? ''))
    || attr(tag, 'http-equiv')?.toLowerCase() === 'refresh')) return null;
  const mainMatch = html.match(/<main\b([^>]*)>([\s\S]*?)<\/main>/i);
  const main = attr(mainMatch?.[1] ?? '', 'id') === 'main' ? mainMatch[2] : null;
  if (!main) throw new Error(`${file}: no <main id="main">`);
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]).find((tag) => attr(tag, 'rel')?.split(/\s+/).includes('canonical'));
  const canonical = publicUrl(attr(canonicalTag ?? '', 'href'), SITE);
  if (!canonical) throw new Error(`${file}: no canonical`);
  if (new URL(canonical).origin !== SITE) throw new Error(`${file}: canonical is outside ${SITE}`);
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const meta = (name) => attr(metas.find((tag) => attr(tag, 'name') === name) ?? '', 'content') ?? '';
  const description = meta('description');
  const author = meta('author');
  const stamp = [...main.matchAll(/<time\b[^>]*>/gi)].map((match) => match[0]).find((tag) => /^(updated|reviewed)$/.test(attr(tag, 'data-page-updated') ?? ''));
  const date = attr(stamp ?? '', 'datetime') ?? null;
  const dateKind = attr(stamp ?? '', 'data-page-updated') ?? null;
  const structuredData = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => attr(match[1], 'type')?.toLowerCase() === 'application/ld+json')
    .map((match) => publicStructuredData(JSON.parse(match[2])));
  const nodes = structuredData.flatMap((value) => value['@graph'] ?? value);
  const article = nodes.find((node) => node.url === canonical && (Array.isArray(node['@type']) ? node['@type'].includes('Article') : node['@type'] === 'Article'));
  return {
    file,
    pathname: new URL(canonical).pathname,
    canonical,
    title,
    description,
    author,
    language: attr(html.match(/<html\b[^>]*>/i)?.[0] ?? '', 'lang') ?? null,
    dateKind,
    date,
    dates: {
      published: article?.datePublished ?? null,
      modified: article?.dateModified ?? (dateKind === 'updated' ? date : null),
      reviewed: dateKind === 'reviewed' ? date : null,
    },
    structuredData,
    ...pageSemantics(main, canonical),
    main,
  };
}

/** Reuse the canonical page corpus; a missing or excluded project page is a release error. */
export function enrichProjects(payload, records) {
  const byUrl = new Map(records.map((record) => [record.url, record]));
  const seen = new Set();
  if (!Array.isArray(payload.projects) || !payload.projects.length) throw new Error('project JSON has no published records');
  return {
    ...payload,
    projects: payload.projects.map((project) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) throw new Error(`invalid project JSON slug: ${project.slug}`);
      if (seen.has(project.slug)) throw new Error(`duplicate project JSON slug: ${project.slug}`);
      seen.add(project.slug);
      const expectedUrl = `${SITE}/projects/${project.slug}/`;
      const page = byUrl.get(expectedUrl);
      if (project.url !== expectedUrl || !page || page.id !== expectedUrl || page.path !== `/projects/${project.slug}/`) {
        throw new Error(`${project.slug}: project JSON requires its published, indexable canonical page ${expectedUrl}`);
      }
      return {
        ...project,
        published: page.dates.published,
        updated: page.dates.modified,
        formats: {
          html: page.url,
          markdown: page.formats.markdown,
          json: `${SITE}/ai/projects/${project.slug}.json`,
        },
        pageContent: page,
      };
    }),
  };
}

/** Only canonical directory paths become generated record paths; never decode or normalise traversal. */
export function pageRecordPath(pathname) {
  if (typeof pathname !== 'string' || !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/.test(pathname)) {
    throw new Error(`invalid canonical page path: ${pathname}`);
  }
  return `/ai/pages${pathname}index.json`;
}

/** Replace only this generator's metadata, preserving project-specific and other alternates. */
function pageRecordAlternate(html, jsonUrl) {
  let foundHead = false;
  const result = html.replace(/(<head\b[^>]*>)([\s\S]*?)(<\/head>)/i, (_, open, body, close) => {
    foundHead = true;
    const clean = body.replace(/<link\b[^>]*\bdata-ai-page-record(?=[\s=>])[^>]*>/gi, '');
    return `${open}${clean}<link rel="alternate" type="application/json" href="${jsonUrl}" title="Complete page record as JSON" data-ai-page-record>${close}`;
  });
  if (!foundHead) throw new Error('published canonical page has no head for JSON discovery');
  return result;
}

export async function build(distDir = dist) {
  const pages = [];
  for (const file of await htmlFiles(distDir)) {
    const page = await readPage(file);
    if (page) pages.push(page);
  }
  pages.sort((a, b) => (a.pathname === '/' ? -1 : b.pathname === '/' ? 1 : a.pathname.localeCompare(b.pathname)));
  if (pages.length < 50) throw new Error(`only ${pages.length} published pages found under ${distDir}`);
  if (new Set(pages.map((page) => page.canonical)).size !== pages.length) throw new Error('published pages have duplicate canonical URLs');
  for (const page of pages) pageRecordPath(page.pathname);

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
  const records = [];
  const manifestPages = [];
  // Remove only generated individual page records, so an excluded page cannot leave a stale shard.
  await rm(path.join(distDir, 'ai', 'pages'), { recursive: true, force: true });
  for (const [index, page] of pages.entries()) {
    const body = toMarkdown(page.main, { base: page.canonical, demote: 0 });
    const dateLine = page.date ? `${page.dateKind === 'updated' ? 'last_updated' : 'last_reviewed'}: ${page.date}` : null;
    const front = ['---', `title: ${yamlString(page.title)}`, `url: ${page.canonical}`, ...(page.description ? [`description: ${yamlString(page.description)}`] : []), ...(page.author ? [`author: ${yamlString(page.author)}`] : []), ...(dateLine ? [dateLine] : []), '---', ''];
    const twinPath = path.join(distDir, page.pathname, 'index.md');
    await writeFile(twinPath, `${front.join('\n')}\n${body}`);
    twins += 1;

    const metadata = {
      id: page.canonical,
      url: page.canonical,
      path: page.pathname,
      title: page.title,
      description: page.description,
      language: page.language,
      author: page.author || null,
      dates: page.dates,
      formats: {
        html: page.canonical,
        markdown: `${page.canonical}index.md`,
        json: `${SITE}${pageRecordPath(page.pathname)}`,
        corpus: `${SITE}/ai/pages.json#/pages/${index}`,
      },
    };
    manifestPages.push(metadata);
    const record = {
      ...metadata,
      headings: page.headings,
      markdown: body,
      links: page.links,
      images: page.images,
      diagrams: page.diagrams,
      media: page.media,
      structuredData: page.structuredData,
    };
    records.push(record);
    const recordFile = path.join(distDir, pageRecordPath(page.pathname));
    await mkdir(path.dirname(recordFile), { recursive: true });
    await writeFile(recordFile, `${JSON.stringify(record, null, 2)}\n`);
    await writeFile(page.file, pageRecordAlternate(await readFile(page.file, 'utf8'), metadata.formats.json));

    full.push('---', '', `# ${page.title}`, `URL: ${page.canonical}`);
    if (page.date) full.push(`${page.dateKind === 'updated' ? 'Last updated' : 'Last reviewed'}: ${page.date}`);
    full.push('', toMarkdown(page.main, { base: page.canonical, demote: 1 }));
  }
  await writeFile(path.join(distDir, 'llms-full.txt'), full.join('\n'));
  await mkdir(path.join(distDir, 'ai'), { recursive: true });
  const exportMetadata = {
    schemaVersion: '1.0',
    source: SITE,
    manifestUrl: `${SITE}/ai/index.json`,
    corpusUrl: `${SITE}/ai/pages.json`,
    pageCount: pages.length,
    contentPolicy: 'Generated from the built, indexable, canonical public HTML. Excludes noindex pages and redirects. Drafts are not built. Main content preserves public wording, headings, tables, code, form guidance and meaningful media descriptions; scripts, styles, navigation chrome, input values and submission endpoints are omitted. Link records retain public main-content navigation destinations. Media URLs are references, not embedded assets or transcripts.',
    datePolicy: 'Dates are copied only from the published page byline and Article JSON-LD. Null means no corresponding date was published; build time is never used as a content date.',
    recordPolicy: 'Each record id is its canonical HTML URL. The json format URL retrieves that individual complete page record; the corpus format URL retains its JSON Pointer address in the aggregate. Markdown matches the corresponding index.md body. Structured data is copied from public JSON-LD without telephone or private payload fields.',
  };
  await writeFile(path.join(distDir, 'ai', 'index.json'), `${JSON.stringify({ ...exportMetadata, pages: manifestPages }, null, 2)}\n`);
  await writeFile(path.join(distDir, 'ai', 'pages.json'), `${JSON.stringify({ ...exportMetadata, pages: records }, null, 2)}\n`);
  const projectFile = path.join(distDir, 'ai', 'projects.json');
  const projectPayload = enrichProjects(JSON.parse(await readFile(projectFile, 'utf8')), records);
  await writeFile(projectFile, `${JSON.stringify(projectPayload, null, 2)}\n`);
  // A second run must not retain a previously published project's shard after exclusion.
  await rm(path.join(distDir, 'ai', 'projects'), { recursive: true, force: true });
  await mkdir(path.join(distDir, 'ai', 'projects'), { recursive: true });
  for (const project of projectPayload.projects) {
    await writeFile(path.join(distDir, 'ai', 'projects', `${project.slug}.json`), `${JSON.stringify({
      schemaVersion: projectPayload.schemaVersion,
      resourceReviewed: projectPayload.resourceReviewed,
      url: project.formats.json,
      sourceUrl: project.url,
      publisher: projectPayload.publisher,
      fieldNotes: projectPayload.fieldNotes,
      project,
    }, null, 2)}\n`);
  }

  // /sitemap.xml is the address crawlers and people try first. @astrojs/sitemap only writes
  // sitemap-index.xml, so serve an identical copy of the index at the conventional path too.
  await writeFile(path.join(distDir, 'sitemap.xml'), await readFile(path.join(distDir, 'sitemap-index.xml'), 'utf8'));
  await buildReaderMirror({ distDir, production: true });
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
