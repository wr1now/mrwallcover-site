import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import worker, { LINK_LIMITS, type Context, type Env } from '../workers/link-preview/src/index.ts';

/**
 * The Cloudflare Worker that reads a wallpaper link for the room preview, exercised
 * through its fetch handler with the outside world stubbed: no network is touched.
 */

const WORKER = 'https://mw-link-preview.example.workers.dev';
const SITE = 'https://www.mrwallcover.com';
const LOCAL = 'http://127.0.0.1:4321';
const env: Env = { ALLOWED_ORIGINS: `${SITE},${LOCAL}`, RATE_LIMIT: '1000' };

const realFetch = globalThis.fetch;
const routes = new Map<string, () => Response>();
const calls: { url: string; init: RequestInit }[] = [];
let pending: Promise<unknown>[] = [];
const ctx: Context = { waitUntil: (promise) => { pending.push(promise); } };

before(() => {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    const route = routes.get(url);
    if (!route) throw new TypeError(`unexpected fetch of ${url}`);
    return route();
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});
afterEach(() => {
  routes.clear();
  calls.length = 0;
  pending = [];
});

function call(path: string, { origin = SITE, headers = {}, method = 'GET', vars = env }: { origin?: string | null; headers?: Record<string, string>; method?: string; vars?: Env } = {}) {
  const all: Record<string, string> = { ...headers };
  if (origin) all.origin = origin;
  return worker.fetch(new Request(`${WORKER}${path}`, { method, headers: all }), vars, ctx);
}
const preview = (target: string, options?: Parameters<typeof call>[1]) => call(`/api/link-preview?url=${encodeURIComponent(target)}`, options);
const image = (target: string, options?: Parameters<typeof call>[1]) => call(`/api/link-image?url=${encodeURIComponent(target)}`, options);

const html = (body: string) => () => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
const redirect = (location: string, status = 302) => () => new Response(null, { status, headers: { location } });
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
const jpeg = (bytes: Uint8Array = jpegBytes, headers: Record<string, string> = {}) => () => new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg', ...headers } });

/** A body that keeps coming: `chunks` pieces of `chunkBytes`, and a note of whether the reader gave up. */
function stream(chunkBytes: number, chunks: number, type: string, counters: { pulled: number; cancelled: boolean }) {
  return () =>
    new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (counters.pulled >= chunks) {
            controller.close();
            return;
          }
          counters.pulled += 1;
          controller.enqueue(new Uint8Array(chunkBytes));
        },
        cancel() {
          counters.cancelled = true;
        },
      }),
      { status: 200, headers: { 'content-type': type } },
    );
}

const PRODUCT_PAGE = `<html><head><title>Fallback title</title>
  <meta property="og:title" content="OG title"><meta property="og:image" content="/images/og.jpg">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Glasshouse Navy","image":["https://cdn.example.com/p/119884.jpg"]}</script>
  </head><body><h1>Glasshouse Navy Wallpaper</h1><dl><dt>Roll Width</dt><dd>52 cm</dd><dt>Pattern Repeat</dt><dd>64cm</dd><dt>Match</dt><dd>Half Drop</dd></dl></body></html>`;

test('a product page with JSON-LD gives the preview JSON, with the image through the Worker', async () => {
  const target = 'https://shop.example.com/uk/product/glasshouse/';
  routes.set(target, html(PRODUCT_PAGE));
  const response = await preview(target);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), SITE);
  assert.equal(response.headers.get('vary'), 'Origin');
  assert.match(response.headers.get('content-type') || '', /^application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.deepEqual(body, {
    ok: true,
    url: target,
    title: 'Glasshouse Navy',
    image: 'https://cdn.example.com/p/119884.jpg',
    widthCm: 52,
    repeatCm: 64,
    match: 'half',
    source: 'page',
    imageProxy: `${WORKER}/api/link-image?url=${encodeURIComponent('https://cdn.example.com/p/119884.jpg')}`,
  });
  // The maker's site is asked the way the API asks it: by hand on redirects, with the same name, within a time limit.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.redirect, 'manual');
  const sent = new Headers(calls[0].init.headers);
  assert.match(sent.get('user-agent') || '', /MrWallcoverRoomPreview\/1\.0/);
  assert.match(sent.get('accept') || '', /text\/html/);
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test('a link straight to a picture is the picture: preview JSON names it, and the image route passes it through with CORS', async () => {
  const target = 'https://cdn.example.com/p/roll.jpg';
  routes.set(target, jpeg());
  const asPreview = await preview(target);
  assert.equal(asPreview.status, 200);
  const body = await asPreview.json();
  assert.equal(body.image, target);
  assert.equal(body.title, 'cdn.example.com');
  assert.equal(body.imageProxy, `${WORKER}/api/link-image?url=${encodeURIComponent(target)}`);

  const asImage = await image(target, { origin: LOCAL });
  assert.equal(asImage.status, 200);
  assert.equal(asImage.headers.get('content-type'), 'image/jpeg');
  assert.equal(asImage.headers.get('content-length'), String(jpegBytes.byteLength));
  assert.equal(asImage.headers.get('cache-control'), 'private, max-age=300');
  assert.equal(asImage.headers.get('access-control-allow-origin'), LOCAL);
  assert.equal(asImage.headers.get('vary'), 'Origin');
  assert.equal(asImage.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(new Uint8Array(await asImage.arrayBuffer()), jpegBytes);
  assert.match(new Headers(calls[1].init.headers).get('accept') || '', /image\/\*/);
});

test('a public redirect is followed by hand and the final address is reported; a fourth redirect is not followed', async () => {
  routes.set('https://shop.example.com/old', redirect('/new', 301));
  routes.set('https://shop.example.com/new', html('<html><head><meta property="og:image" content="../media/linen.webp"></head><body>Width 70 cm</body></html>'));
  const response = await preview('https://shop.example.com/old');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.url, 'https://shop.example.com/new');
  assert.equal(body.image, 'https://shop.example.com/media/linen.webp');
  assert.equal(body.widthCm, 70);

  for (let i = 0; i <= LINK_LIMITS.redirects + 1; i += 1) routes.set(`https://loop.example.com/${i}`, redirect(`https://loop.example.com/${i + 1}`));
  calls.length = 0;
  const loop = await preview('https://loop.example.com/0');
  assert.equal(loop.status, 502);
  assert.equal((await loop.json()).reason, 'redirect');
  assert.equal(calls.length, LINK_LIMITS.redirects + 1);
});

test('a private or odd address is refused with 400 before anything is fetched', async () => {
  for (const bad of ['http://10.0.0.1/', 'http://localhost/', 'http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data/', 'http://192.168.0.5/x.jpg', 'http://example.com:8080/', 'ftp://example.com/', 'http://intranet/', 'http://user:pw@example.com/', `${WORKER}/api/link-image?url=https%3A%2F%2Fexample.com%2F`]) {
    const response = await preview(bad);
    assert.equal(response.status, 400, bad);
    assert.equal((await response.json()).error, 'Only a public web address can be read.');
  }
  assert.equal((await call('/api/link-preview')).status, 400);
  assert.equal((await call('/api/link-image?url=')).status, 400);
  assert.equal(calls.length, 0);
});

test('a redirect to a private address, or back to the Worker, fails without that address being fetched', async () => {
  routes.set('https://shop.example.com/bounce', redirect('http://192.168.0.1/admin'));
  routes.set('https://shop.example.com/self', redirect(`${WORKER}/api/link-image?url=https%3A%2F%2Fcdn.example.com%2Fp%2Froll.jpg`));
  for (const target of ['https://shop.example.com/bounce', 'https://shop.example.com/self']) {
    calls.length = 0;
    const response = await image(target);
    assert.equal(response.status, 502, target);
    assert.equal((await response.json()).reason, 'redirect');
    assert.deepEqual(calls.map((entry) => entry.url), [target]);
  }
});

test('an oversize body is cut off at the cap while it streams, and a declared length over the cap is never read', async () => {
  const chunk = 256 * 1024;
  const page = { pulled: 0, cancelled: false };
  routes.set('https://big.example.com/page', stream(chunk, 64, 'text/html', page));
  const tooBigPage = await preview('https://big.example.com/page');
  assert.equal(tooBigPage.status, 413);
  assert.equal((await tooBigPage.json()).reason, 'too_large');
  assert.ok(page.cancelled, 'the reader gave the stream up');
  // The chunk that crosses the cap plus the one the stream reads ahead: nothing like the whole 16 MB.
  assert.ok(page.pulled <= LINK_LIMITS.pageBytes / chunk + 2, `read ${page.pulled} chunks, not the whole 16 MB`);

  const picture = { pulled: 0, cancelled: false };
  routes.set('https://big.example.com/huge.png', stream(1024 * 1024, 20, 'image/png', picture));
  const tooBigImage = await image('https://big.example.com/huge.png');
  assert.equal(tooBigImage.status, 413);
  assert.ok(picture.cancelled && picture.pulled <= LINK_LIMITS.imageBytes / (1024 * 1024) + 2, `read ${picture.pulled} MB, not 20`);

  const declared = { pulled: 0, cancelled: false };
  routes.set('https://big.example.com/declared.jpg', () => new Response(stream(1024, 1, 'image/jpeg', declared)().body, { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': String(LINK_LIMITS.imageBytes + 1) } }));
  assert.equal((await image('https://big.example.com/declared.jpg')).status, 413);
  // The stream itself reads one chunk ahead when it is made; the Worker read none and gave the body up.
  assert.ok(declared.cancelled && declared.pulled <= 1, `cancelled ${declared.cancelled}, pulled ${declared.pulled}`);

  // The cap follows the type: a 3 MB picture at a "page" link is over the page cap but within the image cap.
  const three = { pulled: 0, cancelled: false };
  routes.set('https://big.example.com/three.jpg', stream(1024 * 1024, 3, 'image/jpeg', three));
  const pictureAsPage = await preview('https://big.example.com/three.jpg');
  assert.equal(pictureAsPage.status, 200);
  assert.equal((await pictureAsPage.json()).image, 'https://big.example.com/three.jpg');
});

test('what is neither a page nor an image, an upstream error, and a page without an image are told apart', async () => {
  routes.set('https://shop.example.com/sheet.pdf', () => new Response('%PDF-1.4', { headers: { 'content-type': 'application/pdf' } }));
  routes.set('https://shop.example.com/gone', () => new Response('no', { status: 404, headers: { 'content-type': 'text/html' } }));
  routes.set('https://shop.example.com/plain', html('<html><head><title>Plain</title></head><body>Roll width 52 cm</body></html>'));
  routes.set('https://shop.example.com/text.jpg', () => new Response('hello', { headers: { 'content-type': 'text/plain' } }));
  assert.equal((await preview('https://shop.example.com/sheet.pdf')).status, 415);
  assert.equal((await preview('https://shop.example.com/gone')).status, 502);
  assert.equal((await preview('https://shop.example.com/plain')).status, 422);
  assert.equal((await image('https://shop.example.com/text.jpg')).status, 415);
  assert.equal((await image('https://shop.example.com/plain')).status, 415, 'the image route takes pictures only');
});

test('only an allowed origin may call the Worker; the preflight is answered; the health route needs none', async () => {
  routes.set('https://cdn.example.com/p/roll.jpg', jpeg());
  const stranger = await image('https://cdn.example.com/p/roll.jpg', { origin: 'https://other.example' });
  assert.equal(stranger.status, 403);
  assert.equal(stranger.headers.get('access-control-allow-origin'), null);
  assert.equal(stranger.headers.get('vary'), 'Origin');
  const anonymous = await image('https://cdn.example.com/p/roll.jpg', { origin: null });
  assert.equal(anonymous.status, 403);
  assert.equal(calls.length, 0, 'nothing is fetched for a refused caller');

  const preflight = await call('/api/link-preview?url=https%3A%2F%2Fshop.example.com%2F', { method: 'OPTIONS', headers: { 'access-control-request-method': 'GET' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), SITE);
  assert.match(preflight.headers.get('access-control-allow-methods') || '', /GET/);
  const refusedPreflight = await call('/api/link-preview', { method: 'OPTIONS', origin: 'https://other.example' });
  assert.equal(refusedPreflight.status, 204);
  assert.equal(refusedPreflight.headers.get('access-control-allow-origin'), null);

  const health = await call('/health', { origin: null });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, worker: 'mw-link-preview' });

  // Without ALLOWED_ORIGINS the live site alone is allowed.
  assert.equal((await image('https://cdn.example.com/p/roll.jpg', { vars: {} })).status, 200);
  assert.equal((await image('https://cdn.example.com/p/roll.jpg', { vars: {}, origin: LOCAL })).status, 403);
});

test('unknown paths are 404 and other methods 405', async () => {
  assert.equal((await call('/api/leads')).status, 404);
  assert.equal((await call('/')).status, 404);
  const post = await call('/api/link-preview?url=https%3A%2F%2Fshop.example.com%2F', { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, OPTIONS');
  assert.equal(calls.length, 0);
});

test('the edge cache serves a repeat image without a second fetch, with the caller\'s own CORS headers each time', async () => {
  const store = new Map<string, Response>();
  (globalThis as { caches?: unknown }).caches = {
    default: {
      match: async (request: Request) => store.get(request.url)?.clone(),
      put: async (request: Request, response: Response) => { store.set(request.url, response); },
    },
  };
  try {
    const target = 'https://cdn.example.com/p/cached.jpg';
    routes.set(target, jpeg());
    const first = await image(target);
    assert.equal(first.status, 200);
    await Promise.all(pending);
    assert.equal(calls.length, 1);
    const stored = store.get(target);
    assert.ok(stored, 'stored under the image\'s own address');
    assert.equal(stored.headers.get('cache-control'), 'public, max-age=300');
    assert.equal(stored.headers.get('access-control-allow-origin'), null, 'no caller\'s headers in the shared copy');

    const second = await image(target, { origin: LOCAL });
    assert.equal(second.status, 200);
    assert.equal(calls.length, 1, 'served from the cache');
    assert.equal(second.headers.get('access-control-allow-origin'), LOCAL);
    assert.equal(second.headers.get('cache-control'), 'private, max-age=300');
    assert.deepEqual(new Uint8Array(await second.arrayBuffer()), jpegBytes);
  } finally {
    delete (globalThis as { caches?: unknown }).caches;
  }
});

test('the in-memory rate limit answers 429 once an address has used its share', async () => {
  const target = 'https://cdn.example.com/p/roll.jpg';
  routes.set(target, jpeg());
  const options = { vars: { ...env, RATE_LIMIT: '2' }, headers: { 'cf-connecting-ip': '203.0.113.9' } };
  assert.equal((await image(target, options)).status, 200);
  assert.equal((await image(target, options)).status, 200);
  const limited = await image(target, options);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '600');
  assert.equal(calls.length, 2);
  // Another address is not affected, and "0" switches the limit off.
  assert.equal((await image(target, { ...options, headers: { 'cf-connecting-ip': '203.0.113.10' } })).status, 200);
  assert.equal((await image(target, { ...options, vars: { ...env, RATE_LIMIT: '0' } })).status, 200);
});
