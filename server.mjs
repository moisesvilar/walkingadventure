// Servidor de desarrollo: estáticos + proxy de Overpass con caché en disco.
//   node server.mjs   →  http://localhost:8137
//
// POST /api/overpass con body `data=<consulta>` (igual que Overpass). Cada
// consulta se cachea por hash en .cache/overpass/ y no vuelve a pedirse nunca.

import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = process.env.PORT || 8137;
const ROOT = new URL('.', import.meta.url).pathname;
const CACHE_DIR = join(ROOT, '.cache', 'overpass');

const UPSTREAMS = [
  'http://localhost:12345/api/interpreter', // Overpass local (docker-compose.yml); si no está, cae a los públicos
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};

await mkdir(CACHE_DIR, { recursive: true });

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function fetchUpstream(ql) {
  let lastErr;
  for (let round = 0; round < 2; round++) {
    if (round > 0) await new Promise((r) => setTimeout(r, 3000));
    for (const url of UPSTREAMS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(ql),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // etiqueta OSM: identificarse; sin User-Agent válido algunos mirrors rechazan (406)
            'User-Agent': 'walking-adventure-prototype/0.1 (dev local)',
          },
          signal: AbortSignal.timeout(40000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).host}`);
        const text = await res.text();
        JSON.parse(text); // valida que es JSON completo antes de cachear
        return text;
      } catch (e) {
        lastErr = e;
        console.log(`  upstream falló: ${e.message}`);
      }
    }
  }
  throw lastErr;
}

async function handleOverpass(req, res) {
  const body = await readBody(req);
  const ql = body.startsWith('data=') ? decodeURIComponent(body.slice(5).replace(/\+/g, '%20')) : body;
  const hash = createHash('sha256').update(ql).digest('hex').slice(0, 24);
  const file = join(CACHE_DIR, `${hash}.json`);

  try {
    const cached = await readFile(file, 'utf8');
    console.log(`overpass ${hash} → HIT`);
    res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
    res.end(cached);
    return;
  } catch { /* miss */ }

  console.log(`overpass ${hash} → MISS, consultando upstream…`);
  try {
    const text = await fetchUpstream(ql);
    await writeFile(file, text);
    console.log(`overpass ${hash} → cacheado (${(text.length / 1024).toFixed(0)} KB)`);
    res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
    res.end(text);
  } catch (e) {
    console.log(`overpass ${hash} → upstream agotado: ${e.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Overpass upstream: ${e.message}` }));
  }
}

async function handleStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === '/') pathname = '/index.html';
  const file = normalize(join(ROOT, pathname));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
}

http
  .createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/api/overpass') return await handleOverpass(req, res);
      if (req.method === 'GET') return await handleStatic(req, res);
      res.writeHead(405);
      res.end();
    } catch (e) {
      console.error(e);
      res.writeHead(500);
      res.end();
    }
  })
  .listen(PORT, () => console.log(`Walking Adventure dev server → http://localhost:${PORT} (caché Overpass en .cache/overpass/)`));
