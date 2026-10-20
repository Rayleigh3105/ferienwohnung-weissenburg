#!/usr/bin/env node
// Minimal static file server for local development: node tools/serve.mjs [port]
// Serves ./site like Cloudflare does: the same MIME types, the response headers from
// site/_headers (values of a header set by several rules are joined) and pages without
// the .html extension (/impressum -> impressum.html).

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

async function resolveFile(path) {
  for (const candidate of [path, join(path, 'index.html'), `${path}.html`]) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile()) return candidate;
  }
  return null;
}

createServer(async (req, res) => {
  const urlPath = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = await resolveFile(join(siteDir, urlPath));
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  const headers = { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' };
  for (const rule of await loadHeaderRules()) {
    if (!rule.pattern.test(urlPath)) continue;
    for (const [name, value] of Object.entries(rule.headers)) {
      if (headers[name]) console.warn(`${urlPath}: "${name}" is set by several _headers rules, Cloudflare sends "${headers[name]}, ${value}"`);
      headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
    }
  }
  // Always fresh files while developing (the real caching rules are checked above).
  headers['Cache-Control'] = 'no-store';
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}`));
