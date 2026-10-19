/**
 * Cloudflare Worker for the room preview's link route.
 *
 * The "Mr Wallcover Atelier" page lets a visitor paste a link to a wallpaper. A browser cannot
 * read another website, and the static GitHub Pages site has no server, so this Worker
 * reads the page for it. It serves the same two routes as the private enquiry API
 * (server/index.ts), with the same guards and limits:
 *
 *   GET /api/link-preview?url=   the product's JSON-LD or Open Graph image, its title, and
 *                                the roll width, repeat and match where the page states them
 *   GET /api/link-image?url=     the picture itself, with CORS headers so a canvas can use it
 *   GET /health                  { ok: true }, for checking a deployment
 *
 * Only public http(s) addresses on ports 80/443 are read (isPublicHttpUrl), redirects are
 * followed by hand (three at most, each checked again), a request is given 10 s, a page
 * may be 2 MB and an image 15 MB, counted while the body streams in, and the content type
 * must be HTML or an image. The Worker stores nothing: the only state is a best-effort
 * per-address rate limit in the isolate's memory and a five-minute edge-cache copy of an
 * image, keyed by the image's own URL.
 *
 * Differences from the API, by necessity: the API also resolves the hostname and refuses
 * names that point at a private address; a Worker has no DNS lookup, and Cloudflare's
 * network does not route to private addresses, so the hostname and literal-address rules
 * are kept and the lookup is not. The Worker also refuses to fetch its own hostname.
 */
import { isPublicHttpUrl, parseProductPage } from '../../../src/lib/link-preview.ts';

export interface Env {
  /** Browser origins allowed to call the Worker, comma-separated. Default: the live site. */
  ALLOWED_ORIGINS?: string;
  /** Requests allowed per address per ten minutes in one isolate. Empty or "0" switches the limit off. */
  RATE_LIMIT?: string;
}

/** The part of the Workers ExecutionContext this module uses, so a test can pass a stub. */
export interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

export const DEFAULT_ORIGIN = 'https://www.mrwallcover.com';
/** The same limits and identification as server/index.ts. */
export const LINK_LIMITS = { pageBytes: 2 * 1024 * 1024, imageBytes: 15 * 1024 * 1024, timeoutMs: 10_000, redirects: 3 } as const;
export const USER_AGENT = 'Mozilla/5.0 (compatible; MrWallcoverRoomPreview/1.0; +https://www.mrwallcover.com/atelier/)';
const IMAGE_TYPES = /^image\/(jpeg|png|webp|avif|gif)$/i;
const PAGE_OR_IMAGE_TYPES = /^text\/html$|^application\/xhtml\+xml$|^image\/(jpeg|png|webp|avif|gif)$/i;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const IMAGE_CACHE_SECONDS = 300;

type Failure = 'too_large' | 'type' | 'redirect' | 'status' | 'body' | 'timeout' | 'network';

class LinkError extends Error {
  readonly reason: Failure;
  constructor(reason: Failure) {
    super(reason);
    this.reason = reason;
  }
}

interface Fetched {
  /** The address finally read, after any redirects. */
  url: string;
  type: string;
  body: Uint8Array;
}

/* ---------- CORS and the origin allow-list ---------- */

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || DEFAULT_ORIGIN).split(',').map((item) => item.trim()).filter(Boolean);
}

/** Vary: Origin on every answer; the allow headers only for an origin on the list. */
function corsHeaders(origin: string | null, env: Env): Headers {
  const headers = new Headers({ vary: 'Origin' });
  if (origin && allowedOrigins(env).includes(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', 'GET, OPTIONS');
    headers.set('access-control-allow-headers', 'accept, content-type');
    headers.set('access-control-max-age', '86400');
  }
  return headers;
}

function json(status: number, body: unknown, cors: Headers, extra: Record<string, string> = {}): Response {
  const headers = new Headers(cors);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(JSON.stringify(body), { status, headers });
}

/* ---------- Rate limit: best effort, per isolate ---------- */

const rateBuckets = new Map<string, number[]>();

function rateLimited(ip: string, env: Env): boolean {
  const limit = Number(env.RATE_LIMIT ?? 60);
  if (!Number.isFinite(limit) || limit <= 0) return false;
  const now = Date.now();
  if (rateBuckets.size > 10_000) {
    for (const [key, hits] of rateBuckets) if (!hits.some((at) => now - at < RATE_WINDOW_MS)) rateBuckets.delete(key);
  }
  const hits = (rateBuckets.get(ip) || []).filter((at) => now - at < RATE_WINDOW_MS);
  if (hits.length >= limit) {
    rateBuckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  return false;
}

/* ---------- Fetching with the guards ---------- */

function sameHost(target: string, selfHost: string): boolean {
  try {
    return new URL(target).hostname.toLowerCase() === selfHost.toLowerCase();
  } catch {
    return false;
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * GET with a timeout, manual redirects that are guarded again, a content-type check and a
 * byte cap applied while the body streams in. The cap may depend on the type, because a
 * link given as a page may turn out to be a picture.
 */
async function fetchLimited(target: string, allow: RegExp, capFor: (type: string) => number, accept: string, selfHost: string): Promise<Fetched> {
  let current = target;
  for (let hop = 0; hop <= LINK_LIMITS.redirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LINK_LIMITS.timeoutMs);
    try {
      let response: Response;
      try {
        response = await fetch(current, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: accept } });
      } catch {
        throw new LinkError(controller.signal.aborted ? 'timeout' : 'network');
      }
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        const location = response.headers.get('location');
        if (!location) throw new LinkError('redirect');
        let next: string;
        try {
          next = new URL(location, current).href;
        } catch {
          throw new LinkError('redirect');
        }
        if (!isPublicHttpUrl(next) || sameHost(next, selfHost)) throw new LinkError('redirect');
        current = next;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new LinkError('status');
      }
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!allow.test(contentType)) {
        await response.body?.cancel().catch(() => undefined);
        throw new LinkError('type');
      }
      const maxBytes = capFor(contentType);
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > maxBytes) {
        await response.body?.cancel().catch(() => undefined);
        throw new LinkError('too_large');
      }
      if (!response.body) throw new LinkError('body');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new LinkError('too_large');
          }
          chunks.push(value);
        }
      } catch (error) {
        if (error instanceof LinkError) throw error;
        throw new LinkError(controller.signal.aborted ? 'timeout' : 'network');
      }
      return { url: current, type: contentType, body: concat(chunks, total) };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new LinkError('redirect');
}

/* ---------- The five-minute edge copy of an image ---------- */

interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/** caches.default on Cloudflare; absent in Node, where the Worker simply does not cache. */
function edgeCache(): CacheLike | undefined {
  return (globalThis as { caches?: { default?: CacheLike } }).caches?.default;
}

function cacheKey(target: string): Request {
  return new Request(target, { method: 'GET' });
}

async function cachedImage(target: string): Promise<Fetched | undefined> {
  const cache = edgeCache();
  if (!cache) return undefined;
  try {
    const hit = await cache.match(cacheKey(target));
    if (!hit) return undefined;
    const type = (hit.headers.get('content-type') || '').toLowerCase();
    if (!IMAGE_TYPES.test(type)) return undefined;
    return { url: target, type, body: new Uint8Array(await hit.arrayBuffer()) };
  } catch {
    return undefined;
  }
}

/** Stored as public for the edge only; the answer to the browser says private. CORS headers are never stored. */
function storeImage(target: string, image: Fetched, ctx: Context | undefined): void {
  const cache = edgeCache();
  if (!cache) return;
  const copy = new Response(image.body, {
    headers: { 'content-type': image.type, 'content-length': String(image.body.byteLength), 'cache-control': `public, max-age=${IMAGE_CACHE_SECONDS}` },
  });
  const stored = cache.put(cacheKey(target), copy).catch(() => undefined);
  if (ctx) ctx.waitUntil(stored);
}

function proxyUrl(self: string, image: string): string {
  return `${self}/api/link-image?url=${encodeURIComponent(image)}`;
}

/* ---------- The handler ---------- */

export default {
  async fetch(request: Request, env: Env = {}, ctx?: Context): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/health' && request.method === 'GET') return json(200, { ok: true, worker: 'mw-link-preview' }, cors);
    if (url.pathname !== '/api/link-preview' && url.pathname !== '/api/link-image') return json(404, { error: 'Not found.' }, cors);
    if (request.method !== 'GET') return json(405, { error: 'Use GET.' }, cors, { allow: 'GET, OPTIONS' });
    // Browsers send Origin on every cross-site fetch; a request without an allowed one is not the site's.
    if (!cors.has('access-control-allow-origin')) return json(403, { error: 'This link could not be read from that address.' }, cors);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (rateLimited(ip, env)) return json(429, { error: 'Too many links from this network just now.' }, cors, { 'retry-after': '600' });

    const target = url.searchParams.get('url') || '';
    if (!isPublicHttpUrl(target) || sameHost(target, url.hostname)) return json(400, { error: 'Only a public web address can be read.' }, cors);

    try {
      if (url.pathname === '/api/link-preview') {
        const page = await fetchLimited(target, PAGE_OR_IMAGE_TYPES, (type) => (type.startsWith('image/') ? LINK_LIMITS.imageBytes : LINK_LIMITS.pageBytes), 'text/html,application/xhtml+xml', url.hostname);
        // A link straight to a picture is the picture.
        if (page.type.startsWith('image/')) {
          return json(200, { ok: true, url: page.url, title: new URL(page.url).hostname, image: page.url, imageProxy: proxyUrl(url.origin, page.url) }, cors);
        }
        const preview = parseProductPage(new TextDecoder('utf-8').decode(page.body), page.url);
        if (!preview.image) return json(422, { error: 'No product image was found on that page.' }, cors);
        return json(200, { ok: true, ...preview, imageProxy: proxyUrl(url.origin, preview.image) }, cors);
      }

      let image = await cachedImage(target);
      if (!image) {
        image = await fetchLimited(target, IMAGE_TYPES, () => LINK_LIMITS.imageBytes, 'image/*', url.hostname);
        storeImage(target, image, ctx);
      }
      const headers = new Headers(cors);
      headers.set('content-type', image.type);
      headers.set('content-length', String(image.body.byteLength));
      headers.set('cache-control', `private, max-age=${IMAGE_CACHE_SECONDS}`);
      headers.set('x-content-type-options', 'nosniff');
      return new Response(image.body, { status: 200, headers });
    } catch (error) {
      const reason: Failure | 'failed' = error instanceof LinkError ? error.reason : 'failed';
      if (reason === 'too_large') return json(413, { error: 'That page or image is too large to read.', reason }, cors);
      if (reason === 'type') return json(415, { error: 'That address is not a web page or an image.', reason }, cors);
      return json(502, { error: 'That page could not be read.', reason }, cors);
    }
  },
};
