// Zero-dependency static server for local preview: node wischermann-detailing/serve.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 3020;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
};

// Stand-in for the /api/slots function on Vercel, so booking can be tested locally.
const store = path.join(root, '.dev-bookings.json');
const readStore = () => {
  try { return JSON.parse(fs.readFileSync(store, 'utf8')); } catch { return []; }
};

const handleSlots = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method === 'GET') return json(200, { booked: readStore(), storage: true });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try {
      const { slot, minutes } = JSON.parse(body || '{}');
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot || '')) return json(400, { ok: false });
      const list = readStore();
      if (!list.some((entry) => entry.slot === slot)) list.push({ slot, minutes: Number(minutes) || 180, at: new Date().toISOString() });
      fs.writeFileSync(store, JSON.stringify(list, null, 2));
      json(200, { ok: true, storage: true, booked: list });
    } catch {
      json(400, { ok: false });
    }
  });
};

http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/api/slots') return handleSlots(req, res);

  let urlPath = '/';
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); } catch {}
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const file = path.join(root, urlPath);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, () => console.log(`Wischermann Detailing preview: http://localhost:${port}`));
