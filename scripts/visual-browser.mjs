/** Isolated test browser and static server; never attaches to a person's browser. */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer-core';

export async function serve(directory) {
  const root = resolve(directory);
  const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.webp':'image/webp', '.avif':'image/avif', '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2', '.json':'application/json' };
  const server = createServer(async (req, res) => {
    try {
      let file = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) file += '/index.html';
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { origin:`http://127.0.0.1:${server.address().port}`, close:() => new Promise((ok) => server.close(ok)) };
}

export async function launchBrowser() {
  const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
  if (!chrome) throw new Error('Set CHROME_PATH to the test Chrome/Chromium executable.');
  return puppeteer.launch({ executablePath:chrome, headless:true, args:['--no-sandbox'] });
}
