#!/usr/bin/env node
// Minimal static file server for local development: node tools/serve.mjs [port]
// Serves ./site with the MIME types and the response headers from site/_headers,
// so the page behaves locally like it does on Cloudflare.

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = join(dirname(fileURLToPath(import.meta.url)), '../site');
const port = Number(process.argv[2] ?? 4321);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Parses the Cloudflare _headers format (path pattern line, then indented "Name: value" lines).
async function loadHeaderRules() {
  const rules = [];
  const text = await readFile(join(siteDir, '_headers'), 'utf8').catch(() => '');
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: new RegExp(`^${line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`), headers: {} });
    } else if (rules.length) {
      const [name, ...value] = line.trim().split(':');
      rules.at(-1).headers[name.trim()] = value.join(':').trim();
    }
  }
  return rules;
}

createServer(async (req, res) => {
  const urlPath = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(siteDir, urlPath);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    await stat(file);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  const headers = { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' };
  for (const rule of await loadHeaderRules()) if (rule.pattern.test(urlPath)) Object.assign(headers, rule.headers);
  headers['Cache-Control'] = 'no-store';
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}`));
