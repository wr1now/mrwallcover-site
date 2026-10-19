# mw-link-preview: the room preview's link route on a Cloudflare Worker

The "Mr Wallcover Atelier" page (`/atelier/`) lets a visitor paste a link to a
wallpaper and see it on their wall. A browser cannot read another website, and the
live site is static on GitHub Pages, so the link is read by a small server. The
private enquiry API (`server/index.ts`) has that server, but it is not deployed and
GitHub Pages cannot host it. This Worker is the same two routes on Cloudflare's free
Workers plan, with nothing else from the API.

| Route | Answer |
| --- | --- |
| `GET /api/link-preview?url=` | JSON: the product's JSON-LD or Open Graph image, its title, the roll width, repeat and match where the page states them, and `imageProxy`, the image through the route below. A link straight to a picture is answered as that picture. |
| `GET /api/link-image?url=` | The picture, with CORS headers so the page's canvas can use it. |
| `GET /health` | `{ "ok": true }`, for checking a deployment. |
| `OPTIONS` | The CORS preflight answer. |

## What it does, and refuses

Behaviour follows `server/index.ts` so the page cannot tell which one answered.

- **Addresses.** Only public `http(s)` hosts on ports 80 and 443 pass
  `isPublicHttpUrl` (`src/lib/link-preview.ts`): no local names, no loopback,
  link-local, private or reserved addresses, no credentials in the URL. The Worker
  also refuses to fetch its own hostname. The API additionally resolves the hostname
  and refuses names that point at a private address; a Worker has no DNS lookup and
  Cloudflare's network does not route to private addresses, so that step is absent.
- **Redirects** are followed by hand, three at most, each destination checked again.
  A redirect to a refused address fails the whole read (502).
- **Time and size.** 10 s per request. A page may be 2 MB and an image 15 MB,
  counted while the body streams in, and a declared `Content-Length` over the cap is
  refused before the body is read. Over the cap: 413.
- **Content type.** HTML, XHTML or a JPEG, PNG, WebP, AVIF or GIF image. Anything
  else: 415. A page with no product image: 422.
- **CORS.** Only the origins in `ALLOWED_ORIGINS` (comma-separated; default
  `https://www.mrwallcover.com`) receive `Access-Control-Allow-Origin`. A request
  from any other origin, or with no `Origin` header at all, is answered 403, because a
  browser sends `Origin` on every cross-site fetch and nothing else should be using
  the Worker. Every answer carries `Vary: Origin`.
- **Identification.** Requests to makers' sites carry the same User-Agent as the
  API, `Mozilla/5.0 (compatible; MrWallcoverRoomPreview/1.0; +https://www.mrwallcover.com/atelier/)`.
- **Caching.** The image answer says `Cache-Control: private, max-age=300`, so the
  visitor's browser may keep it for five minutes. The Worker also keeps a copy for
  five minutes in the edge cache of the data centre that served it, keyed by the
  image's own URL and stored without CORS headers, so a repeated read does not fetch
  from the maker twice. Preview JSON is `no-store`. Nothing else is stored.
- **Rate limit.** Best effort: `RATE_LIMIT` requests (default 60) per address per
  ten minutes, counted in each Worker isolate's memory, so the count resets when an
  isolate is recycled and is not shared between data centres. It stops a runaway
  loop, not a determined abuser. A firm limit needs a Cloudflare rate-limiting rule on
  a custom route (the site's DNS would have to be on Cloudflare) or the Workers
  rate-limiting binding, neither of which is set up here. Empty or `0` switches the
  in-memory limit off.
- **Logs.** Workers Logs are off in `wrangler.toml`, because a log line would hold
  the link the visitor pasted. Switch them on only while diagnosing a problem.

Error answers are JSON `{ "error": "..." }` with status 400 (not a public address),
403 (origin), 404, 405, 413, 415, 422, 429 or 502 (the page could not be read: refused
redirect, upstream error, timeout, network); 413, 415 and 502 also carry a short
`reason`. The page parser runs in linear time, so a 2 MB page costs tens of
milliseconds; on the free plan the 10 ms CPU allowance can still cut off an unusually
large page, which fails only that one request (the page then offers the image-only
routes).

## Files

| File | Role |
| --- | --- |
| `wrangler.toml` | Name `mw-link-preview`, compatibility date 2026-10-01, the `ALLOWED_ORIGINS` and `RATE_LIMIT` vars. No bindings. |
| `src/index.ts` | The handler. Imports `parseProductPage` and `isPublicHttpUrl` from `../../../src/lib/link-preview.ts`, the module the API and the page share. |
| `package.json`, `tsconfig.json` | Wrangler, the Workers types and TypeScript for this folder only; the site's own `package.json` is untouched. |
| `../../tests/link-worker.test.ts` | Tests of the handler with a stubbed `fetch`, in the site's `npm run check`. |

## Run locally

```sh
cd workers/link-preview
npm install
npx wrangler dev --var ALLOWED_ORIGINS:"http://127.0.0.1:4321"
```

Then, from the repository root, build or run the site with the Worker's local
origin as the link API (see "Wiring the site" below):

```sh
PUBLIC_LINK_API=http://localhost:8787 npm run dev -- --host 127.0.0.1
```

A quick check without the site:

```sh
curl -sS -H 'Origin: http://127.0.0.1:4321' 'http://localhost:8787/api/link-preview?url=https://www.example.com/'
```

## Deploy (owner's steps)

Nothing here is deployed until the owner does it. In order:

1. **Sign in once.** `cd workers/link-preview && npm install && npx wrangler login`
   opens the browser for the Cloudflare account (the free plan is enough).
2. **Check the build.** `npx wrangler deploy --dry-run --outdir=.wrangler/dry-run`
   bundles the Worker without uploading it.
3. **Set the allowed origins.** In `wrangler.toml`, `ALLOWED_ORIGINS` is already
   `https://www.mrwallcover.com`. Add other origins, comma-separated, only if the site
   is served from them too. Set it here rather than in the dashboard: each
   `wrangler deploy` writes this file's values over the dashboard's.
4. **Deploy.** `npx wrangler deploy`. Wrangler prints the Worker's address, of the
   form `https://mw-link-preview.<account-subdomain>.workers.dev`. Check it with
   `curl -sS https://mw-link-preview.<account-subdomain>.workers.dev/health`.
   A custom route such as `link.mrwallcover.com` is possible only if the domain's
   DNS is on Cloudflare; the workers.dev address needs no DNS change.
5. **Point the site at it.** Build the site with `PUBLIC_LINK_API` set to that
   origin, no trailing slash. For the GitHub Pages build this means a repository
   variable (`Settings → Secrets and variables → Actions → Variables`) named
   `PUBLIC_LINK_API`, and the Build step of `.github/workflows/pages.yml` passing it
   through:

   ```yaml
   - name: Build
     env:
       SITE_PHONE: ${{ secrets.SITE_PHONE }}
       PUBLIC_LINK_API: ${{ vars.PUBLIC_LINK_API }}
     run: npm run build
   ```

   The workflow change is not made in this folder; it needs the owner's say-so like
   any change to the public repository.
6. **Rebuild and check.** After the next deployment of the site, paste a maker's
   product link on `/atelier/` and read it. The page falls back to "save the
   image and paste it" when a maker's site cannot be read (for example behind a bot
   challenge), exactly as before.

To take it down: `npx wrangler delete`, then rebuild the site without
`PUBLIC_LINK_API`.

## Wiring the site

`PUBLIC_LEAD_API` is the enquiry form's setting: when it is set, the form posts
enquiries to `<origin>/api/leads` and expects the private API's answers. The Worker
has no such route, so the site must not be pointed at the Worker through that
variable. The room preview therefore reads its own variable, `PUBLIC_LINK_API`
(`LINK_API_URL` in `src/config.ts`, the `data-link-api` attribute on
`src/pages/atelier.astro`), and falls back to `PUBLIC_LEAD_API` when the
private API is running locally with both routes. The enquiry form keeps posting
wherever it posted before.
