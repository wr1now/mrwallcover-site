import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPrivateAddress, isPublicHttpUrl, linkPreviewFromText, matchFromText, parseProductPage } from '../src/lib/link-preview.ts';

/** The room preview reads a wallpaper link: the product image and any stated sizes, from public sites only. */

test('width, repeat and match are read from a product description in any order and unit', () => {
  assert.deepEqual(linkPreviewFromText('Roll width: 52cm. Pattern repeat 64 cm, half drop. Length 10 m.'), { widthCm: 52, repeatCm: 64, match: 'half' });
  assert.deepEqual(linkPreviewFromText('Repeat 25.6" · Width 27 in · straight match'), { widthCm: 68.6, repeatCm: 65, match: 'straight' });
  assert.deepEqual(linkPreviewFromText('Width 700mm, repeat 1000mm, free match'), { widthCm: 70, repeatCm: 100, match: 'free' });
  assert.deepEqual(linkPreviewFromText('A lovely paper for a hallway.'), { widthCm: undefined, repeatCm: undefined, match: undefined });
  assert.equal(matchFromText('Offset match'), 'half');
});

test('the forms real maker pages use on 19 Oct 2026 are read', () => {
  // Timorous Beasties: unit in brackets after the label, millimetres.
  assert.deepEqual(linkPreviewFromText('Width (mm): 520 Vertical Pattern Repeat (mm): 1674 Pattern Match: Half Drop Composition: Non-Woven Paper Roll Length: 10 Metres'), { widthCm: 52, repeatCm: 167.4, match: 'half' });
  // Morris & Co: a specification table flattened to text, "Match Straight".
  assert.deepEqual(linkPreviewFromText('Width 52 cm Vertical Pattern Repeat 64 cm Match Straight Roll length 10.05 metres Product Type Paper'), { widthCm: 52, repeatCm: 64, match: 'straight' });
  // Zoffany: "Usable Width" and "Straight Match".
  assert.deepEqual(linkPreviewFromText('Item Type WW Non Woven Wallpaper 68.6cm Usable Width 68.6 cm Standard Length 10.05 m Vertical Pattern Repeat 101.8 cm Pattern Match Straight Match'), { widthCm: 68.6, repeatCm: 101.8, match: 'straight' });
  // Cole & Son: metres for the width.
  assert.deepEqual(linkPreviewFromText('Roll Length: 10.05 m Roll Width: 0.52 m Pattern Repeat: 64 cm Match: Half drop'), { widthCm: 52, repeatCm: 64, match: 'half' });
  // Designers Guild: a definition list, half drop.
  assert.deepEqual(linkPreviewFromText('Composition NON-WOVEN WALLPAPER Width 69 cm Weight 150 gsm Pattern Match Half drop Roll Length 10 m Vertical Pattern Repeat 68.5 cm'), { widthCm: 69, repeatCm: 68.5, match: 'half' });
  // House of Hackney: a four-panel set given as one size; the set is the tile, the match is unstated.
  assert.deepEqual(linkPreviewFromText("3m (9'10'') Wallpaper Roll dimensions: W 180cm x H 300cm (W 5'9'' x H 9'10'') A single roll is comprised of 4 x 3m lengths, each 45cm wide."), { widthCm: 180, repeatCm: 300, match: undefined });
  // A width given only as "… wide".
  assert.deepEqual(linkPreviewFromText('Printed on a 68.5 cm wide non-woven ground.'), { widthCm: 68.5, repeatCm: undefined, match: undefined });
  // A roll length is never taken for a width or a repeat.
  assert.deepEqual(linkPreviewFromText('Roll Length: 10 Metres. Minimum Order: 1 Roll.'), { widthCm: undefined, repeatCm: undefined, match: undefined });
});

test('a product page gives its JSON-LD image and name before Open Graph, with the sizes from its text', () => {
  const html = `<html><head><title>Fallback title</title>
    <meta property="og:title" content="OG title"><meta property="og:image" content="/images/og.jpg">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Glasshouse Navy","image":["https://cdn.example.com/p/119884.jpg"]}</script>
    </head><body><h1>Glasshouse Navy Wallpaper</h1><dl><dt>Roll Width</dt><dd>52 cm</dd><dt>Pattern Repeat</dt><dd>64cm</dd><dt>Match</dt><dd>Half Drop</dd></dl></body></html>`;
  const preview = parseProductPage(html, 'https://shop.example.com/uk/product/glasshouse/');
  assert.equal(preview.title, 'Glasshouse Navy');
  assert.equal(preview.image, 'https://cdn.example.com/p/119884.jpg');
  assert.equal(preview.widthCm, 52);
  assert.equal(preview.repeatCm, 64);
  assert.equal(preview.match, 'half');
  assert.equal(preview.source, 'page');
});

test('without JSON-LD the Open Graph image is resolved against the page and the title falls back', () => {
  const html = `<html><head><title> Linen Beige | Shop </title><meta name="twitter:image" content="../media/linen.webp?w=1200"></head><body>No sizes here.</body></html>`;
  const preview = parseProductPage(html, 'https://shop.example.com/products/linen/');
  assert.equal(preview.image, 'https://shop.example.com/products/media/linen.webp?w=1200');
  assert.equal(preview.title, 'Linen Beige | Shop');
  assert.equal(preview.source, undefined);
});

test('a hostile page costs linear time: unclosed scripts, comments and bare brackets at the size cap parse in well under a second', () => {
  for (const chunk of ['<script', '<!--', '<', '<style', '<title']) {
    const html = chunk.repeat(Math.ceil((2 * 1024 * 1024) / chunk.length));
    const started = performance.now();
    parseProductPage(html, 'https://shop.example.com/p/1');
    const ms = performance.now() - started;
    assert.ok(ms < 1000, `${JSON.stringify(chunk)} × 2 MB took ${Math.round(ms)} ms`);
  }
});

test('a page with a code point that lengthens under lower-casing still parses by index', () => {
  const html = `<html><head><title>İstanbul paper</title><meta property="og:image" content="/i.jpg"></head><body>İ Roll width 52 cm İ Pattern repeat 64 cm</body></html>`;
  const preview = parseProductPage(html, 'https://shop.example.com/p/1');
  assert.equal(preview.title, 'İstanbul paper');
  assert.equal(preview.image, 'https://shop.example.com/i.jpg');
  assert.equal(preview.widthCm, 52);
  assert.equal(preview.repeatCm, 64);
});

test('only http(s) product images are returned, resolved against the page', () => {
  const html = `<script type="application/ld+json">{"@type":"Product","name":"X","image":"javascript:alert(1)"}</script><meta property="og:image" content="data:image/png;base64,AAAA"><meta name="twitter:image" content="//cdn.example.com/x.jpg">`;
  assert.equal(parseProductPage(html, 'https://shop.example.com/p/1').image, 'https://cdn.example.com/x.jpg');
});

test('only public http(s) addresses may be read', () => {
  assert.equal(isPublicHttpUrl('http://localhost./'), false, 'a trailing dot does not hide a local name');
  assert.equal(isPublicHttpUrl('http://./'), false);
  for (const ok of ['https://www.example.com/product/1', 'http://example.co.uk/x?y=1', 'https://93.184.216.34/']) assert.ok(isPublicHttpUrl(ok), ok);
  for (const bad of ['ftp://example.com/', 'file:///etc/passwd', 'http://localhost/', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://192.168.0.5/', 'http://169.254.169.254/latest/', 'http://[::1]/', 'http://[fd00::1]/', 'http://[::ffff:10.0.0.1]/', 'http://intranet/', 'http://user:pw@example.com/', 'http://example.com:8080/', 'http://100.64.0.1/', 'http://0.0.0.0/']) assert.equal(isPublicHttpUrl(bad), false, bad);
  assert.equal(isPrivateAddress('172.31.255.255'), true);
  assert.equal(isPrivateAddress('172.32.0.1'), false);
  assert.equal(isPrivateAddress('2606:4700::1111'), false);
  for (const bad of ['http://[fe90::1]/', 'http://[febf::1]/', 'http://[fe80::1]/', 'http://[fec0::1]/', 'http://[fd12::1]/', 'http://[ff02::1]/']) assert.equal(isPublicHttpUrl(bad), false, bad);
  assert.equal(isPublicHttpUrl('http://[2001:db8::1]/'), true);
});
