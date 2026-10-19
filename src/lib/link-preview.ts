/**
 * Reading a wallpaper link for the room preview: which image a product page shows and,
 * where the page states them, the roll width, the pattern repeat and the match. Pure
 * functions shared by the private API (server/index.ts) and the page script, and the
 * network guard the API applies before fetching anything.
 */
/** 4, 6 or 0, without node:net so the same module runs in the browser. */
export function isIP(host: string): 0 | 4 | 6 {
  if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(host)) return host.split('.').every((part) => Number(part) <= 255) ? 4 : 0;
  if (host.includes(':') && /^[0-9a-f:.]+$/i.test(host)) return 6;
  return 0;
}

export interface LinkPreview {
  ok: true;
  url: string;
  title: string;
  /** Absolute URL of the product image on the source site. */
  image: string;
  /** The same image served by the private API with CORS headers, so a canvas can use it. */
  imageProxy?: string;
  widthCm?: number;
  repeatCm?: number;
  match?: 'straight' | 'half' | 'free';
  /** Where the figures came from: 'page' when read from the page text, otherwise absent. */
  source?: 'page';
}

const UNIT_TO_CM: Record<string, number> = { cm: 1, mm: 0.1, m: 100, in: 2.54, '"': 2.54, inch: 2.54, inches: 2.54 };

const toCm = (value: string, unit: string) => {
  const cm = Number(value.replace(',', '.')) * (UNIT_TO_CM[unit.toLowerCase()] ?? NaN);
  return cm > 0 && cm < 1000 ? Math.round(cm * 10) / 10 : undefined;
};

/**
 * First number after any of the labels, in centimetres. The unit may follow the number
 * ("Width 52 cm", "Repeat 25.6\"") or sit in brackets after the label, as some makers
 * print their tables ("Width (mm): 520").
 */
function measure(text: string, labels: string[]): number | undefined {
  const label = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(?:${label})\\s*(?:\\(\\s*(cm|mm|m|in|inch(?:es)?)\\s*\\))?\\s*[:：=|\\-–]?\\s*(?:approx\\.?|approximately|about)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(cm|mm|m\\b|in\\b|inch(?:es)?|")?`, 'i');
  const m = text.match(re);
  if (!m) return undefined;
  const unit = m[3] || m[1];
  return unit ? toCm(m[2], unit) : undefined;
}

export function matchFromText(text: string): LinkPreview['match'] | undefined {
  if (/half[\s-]*drop|offset match|drop match|\bmatch\b\s*[:|\-–]?\s*(?:half|offset)/i.test(text)) return 'half';
  if (/straight match|straight repeat|straight across|\bmatch\b\s*[:|\-–]?\s*straight/i.test(text)) return 'straight';
  if (/free match|random match|no match|non[\s-]*match|\bmatch\b\s*[:|\-–]?\s*(?:free|random|none)/i.test(text)) return 'free';
  return undefined;
}

/** Width, repeat and match from the visible text of a product page or a pasted description. */
export function linkPreviewFromText(text: string): Pick<LinkPreview, 'widthCm' | 'repeatCm' | 'match'> {
  const flat = text.replace(/\s+/g, ' ');
  let widthCm = measure(flat, ['roll width', 'usable width', 'width of roll', 'width', 'wide']);
  let repeatCm = measure(flat, ['vertical pattern repeat', 'pattern repeat', 'vertical repeat', 'repeat', 'design repeat']);
  // Panel sets and murals are often given as one size: "Roll dimensions: W 180cm x H 300cm". The set is the tile.
  const set = flat.match(/\bW\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)\b\s*[x×]\s*H\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)\b/i);
  if (set) {
    widthCm = widthCm ?? toCm(set[1], set[2]);
    repeatCm = repeatCm ?? toCm(set[3], set[4]);
  }
  // "each 45cm wide", "68.5 cm wide".
  const wide = flat.match(/(\d+(?:[.,]\d+)?)\s*(cm|mm|m|in|inch(?:es)?)\s+wide\b/i);
  if (widthCm === undefined && wide) widthCm = toCm(wide[1], wide[2]);
  return { widthCm, repeatCm, match: matchFromText(flat) };
}

const attr = (tag: string, name: string): string | undefined => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
};
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

/** A lower-cased copy whose indexes line up with the original: a few code points change length under toLowerCase, so ASCII-only folding is used when they do. */
function foldForIndex(s: string): string {
  const low = s.toLowerCase();
  return low.length === s.length ? low : s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** Every `<open ...>...</close>` block replaced by a space, found with indexOf so a hostile page costs linear time. */
function cutBlocks(html: string, open: string, close: string): string {
  const low = foldForIndex(html);
  let out = '';
  let i = 0;
  for (;;) {
    const a = low.indexOf(open, i);
    if (a < 0) return out + html.slice(i);
    const b = low.indexOf(close, a + open.length);
    out += html.slice(i, a) + ' ';
    if (b < 0) return out;
    i = b + close.length;
  }
}

/** Each `<name ...>` tag in the page as [tag text, body text up to `</name>`], scanned with indexOf. */
function* tags(html: string, name: string, withBody = false): Generator<[string, string]> {
  const low = foldForIndex(html);
  const open = `<${name}`;
  let i = 0;
  for (;;) {
    const a = low.indexOf(open, i);
    if (a < 0) return;
    const next = low.charAt(a + open.length);
    if (next && !/[\s/>]/.test(next)) { i = a + open.length; continue; }
    const gt = low.indexOf('>', a);
    if (gt < 0) return;
    const tag = html.slice(a, gt + 1);
    let body = '';
    i = gt + 1;
    if (withBody) {
      const c = low.indexOf(`</${name}`, gt);
      if (c < 0) return;
      body = html.slice(gt + 1, c);
      i = c;
    }
    yield [tag, body];
  }
}

/** Title, lead image and stated sizes from a product page's HTML. Linear in the page size. */
export function parseProductPage(html: string, pageUrl: string): Omit<LinkPreview, 'ok' | 'imageProxy'> {
  const base = new URL(pageUrl);
  const resolve = (href: string | undefined) => {
    if (!href) return '';
    try {
      const url = new URL(decode(href), base);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };
  let title = '';
  let image = '';
  // JSON-LD Product first: it names the product image deliberately.
  for (const [tag, body] of tags(html, 'script', true)) {
    if (!/application\/ld\+json/i.test(attr(tag, 'type') || '')) continue;
    try {
      const data = JSON.parse(body);
      const nodes: any[] = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
      for (const node of nodes) {
        const type = String(node?.['@type'] || '');
        if (!/Product/i.test(type)) continue;
        title = title || String(node.name || '');
        const img = Array.isArray(node.image) ? node.image[0] : node.image;
        image = image || resolve(typeof img === 'string' ? img : img?.url || img?.contentUrl);
      }
    } catch {
      /* not JSON */
    }
  }
  for (const [tag] of tags(html, 'meta')) {
    const property = (attr(tag, 'property') || attr(tag, 'name') || '').toLowerCase();
    const content = attr(tag, 'content');
    if (!content) continue;
    if (!image && (property === 'og:image' || property === 'og:image:secure_url' || property === 'twitter:image')) image = resolve(content);
    if (!title && (property === 'og:title' || property === 'twitter:title')) title = decode(content);
  }
  if (!title) for (const [, body] of tags(html, 'title', true)) { title = decode(body.trim()); break; }
  const stripped = cutBlocks(cutBlocks(cutBlocks(html, '<script', '</script>'), '<style', '</style>'), '<!--', '-->');
  const text = decode(stripped.replace(/<[^<>]*>/g, ' '));
  const sizes = linkPreviewFromText(text);
  return { url: pageUrl, title: title.slice(0, 200), image, ...sizes, source: sizes.widthCm || sizes.repeatCm || sizes.match ? 'page' : undefined };
}

/** Only public http(s) hosts: no local names, no private or loopback addresses, no odd ports. */
export function isPublicHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(url.protocol)) return false;
  if (url.username || url.password) return false;
  if (url.port && !['', '80', '443'].includes(url.port)) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (!host) return false;
  if (!host.includes('.') && !isIP(host)) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  return !isPrivateAddress(host);
}

/** Loopback, link-local, private and reserved ranges, for both the hostname and any resolved address. */
export function isPrivateAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (kind === 6) {
    const lower = address.toLowerCase();
    if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // IPv4 mapped into IPv6, in dotted or (as the URL parser writes it) hex form.
    const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateAddress(dotted[1]);
    const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return false;
  }
  return false;
}
