'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { position } = require('./together-sync');
const token = () => crypto.randomBytes(24).toString('base64url');
const fail = (status, message) => Object.assign(new Error(message), { status });
const name = value => String(value || 'Visitante').replace(/[\x00-\x1f]/g, '').trim().slice(0, 30) || 'Visitante';
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16384) throw fail(413, 'Pedido muito grande.'); }
  try { return JSON.parse(raw || '{}'); } catch { throw fail(400, 'Pedido inválido.'); }
}
function mediaInput(data) {
  let url;
  try { url = new URL(data?.url); } catch { throw fail(400, 'Vídeo inválido.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 8000) throw fail(400, 'Use um vídeo HTTPS sem credenciais no endereço.');
  if (!['movie', 'series'].includes(data.type) || !Number.isInteger(data.tmdbId) || data.tmdbId <= 0) throw fail(400, 'Título inválido.');
  return { id: token(), url: url.href, mode: ['native', 'hls', 'auto'].includes(data.mode) ? data.mode : 'auto',
    type: data.type, tmdbId: data.tmdbId, name: String(data.name || 'Vídeo da sala').replace(/[\x00-\x1f]/g, '').trim().slice(0, 120), episode: String(data.episode || '').slice(0, 100) };
}
function createServer({ now = Date.now, allowedOrigins = [], root = __dirname, actionDelay = 600 } = {}) {
  const rooms = new Map(), limits = new Map();
  function snapshot(room) {
    return { serverTime: now(), state: room.state, hostOnline: !!room.members.get(room.host)?.stream,
      members: [...room.members.values()].filter(member => member.stream).map(member => ({ id: member.id, name: member.name, host: member.host, status: member.status })) };
  }
  function broadcast(room) {
    const payload = `data: ${JSON.stringify(snapshot(room))}\n\n`;
    for (const member of room.members.values()) if (member.stream && !member.stream.writableEnded) {
      if (!member.stream.write(payload)) member.stream.destroy();
    }
  }
  function pause(room) {
    const time = now();
    room.state = { ...room.state, position: position(room.state, time), paused: true, effectiveAt: time, revision: room.state.revision + 1 };
  }
  function throttle(req) {
    const key = req.socket.remoteAddress;
    let entry = limits.get(key);
    if (!entry || entry.until < now()) { entry = { count: 0, until: now() + 600000 }; limits.set(key, entry); }
    if (++entry.count > 40) throw fail(429, 'Muitas tentativas. Aguarde alguns minutos.');
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    const origin = req.headers.origin;
    if (origin) {
      let host;
      try { host = new URL(origin).host; } catch {}
      if (host !== req.headers.host && !allowedOrigins.includes(origin)) return json(res, 403, { error: 'Origem não autorizada.' });
      res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/together/clock' && req.method === 'GET') return json(res, 200, { serverTime: now(), service: 'duck-together' });
      if (url.pathname === '/api/together/rooms' && req.method === 'POST') {
        throttle(req);
        if (rooms.size >= 500) throw fail(503, 'Salas ocupadas. Tente novamente mais tarde.');
        const data = await body(req), id = crypto.randomBytes(12).toString('base64url'), host = token(), invite = token();
        const room = { id, host, invite, touched: now(), members: new Map(), state: { media: null, position: 0, paused: true, rate: 1, effectiveAt: now(), revision: 0 } };
        room.members.set(host, { id: token(), name: name(data.name), host: true, status: 'ready', stream: null, touched: now() }); rooms.set(id, room);
        return json(res, 201, { roomId: id, credential: host, invite, role: 'host' });
      }
      const match = url.pathname.match(/^\/api\/together\/rooms\/([A-Za-z0-9_-]{16})\/(join|events|state|command|presence|leave)$/);
      if (match) {
        const room = rooms.get(match[1]), action = match[2];
        if (!room) throw fail(404, 'Sala encerrada ou expirada. Crie uma nova sala.');
        if (action === 'join' && req.method === 'POST') {
          throttle(req); const data = await body(req);
          if (data.invite !== room.invite) throw fail(403, 'Convite inválido.');
          if (room.members.size >= 12) throw fail(409, 'A sala está cheia (até 12 pessoas).');
          const credential = token(); room.members.set(credential, { id: token(), name: name(data.name), host: false, status: 'loading', stream: null, touched: now() });
          return json(res, 201, { roomId: room.id, credential, role: 'guest' });
        }
        const credential = req.headers.authorization?.replace(/^Bearer /, ''), member = room.members.get(credential);
        if (!member) throw fail(403, 'Sua sessão expirou. Entre novamente pelo convite.');
        room.touched = now(); member.touched = now();
        if (action === 'events' && req.method === 'GET') {
          const previous = member.stream; member.stream = res; previous?.end();
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.flushHeaders(); broadcast(room);
          res.on('close', () => {
            if (member.stream !== res) return;
            member.stream = null; member.touched = now();
            if (member.host) pause(room);
            broadcast(room);
          });
          return;
        }
        if (action === 'state' && req.method === 'GET') return json(res, 200, { ...snapshot(room), role: member.host ? 'host' : 'guest', ...(member.host ? { invite: room.invite } : {}) });
        if (req.method !== 'POST') throw fail(405, 'Método inválido.');
        const data = await body(req);
        if (action === 'leave') { member.stream?.end(); if (!member.host) room.members.delete(credential); else pause(room); broadcast(room); return json(res, 200, { ok: true }); }
        if (action === 'presence') {
          if (!['ready', 'loading', 'blocked', 'error'].includes(data.status)) throw fail(400, 'Estado inválido.');
          if (member.status !== data.status) { member.status = data.status; broadcast(room); }
          return json(res, 200, { ok: true });
        }
        if (action === 'command') {
          if (!member.host) throw fail(403, 'Somente o líder pode comandar o player.');
          if (!member.stream) throw fail(409, 'Reconecte à sala antes de comandar.');
          if (member.lastCommand && now() - member.lastCommand < 80) throw fail(429, 'Aguarde o comando anterior.');
          const time = now(), effectiveAt = time + actionDelay;
          let next;
          if (data.action === 'media') next = { media: mediaInput(data.media), paused: true, position: 0, rate: 1, effectiveAt: time };
          else {
            if (!room.state.media || data.mediaId !== room.state.media.id) throw fail(409, 'O título mudou. Aguarde a atualização da sala.');
            if (!['play', 'pause', 'seek', 'rate'].includes(data.action)) throw fail(400, 'Comando inválido.');
            const supplied = Number(data.position);
            if (!Number.isFinite(supplied) || supplied < 0 || supplied > 86400) throw fail(400, 'Posição inválida.');
            const observed = Math.max(time - 2000, Math.min(time, Number(data.observedAt) || time));
            next = { ...room.state, effectiveAt };
            if (data.action === 'seek') next.position = supplied;
            else if (data.action === 'play') { next.position = supplied; next.paused = false; }
            else if (data.action === 'pause') { next.position = supplied + (data.buffering || room.state.paused ? 0 : (effectiveAt - observed) / 1000 * room.state.rate); next.paused = true; }
            else {
              if (![0.75, 1, 1.25, 1.5, 2].includes(data.rate)) throw fail(400, 'Velocidade inválida.');
              next.position = position(room.state, effectiveAt); next.rate = data.rate;
            }
          }
          room.state = { ...next, revision: room.state.revision + 1 }; member.lastCommand = time;
          broadcast(room); return json(res, 200, snapshot(room));
        }
        throw fail(404, 'Rota inexistente.');
      }
      if (url.pathname.startsWith('/api/')) throw fail(404, 'Rota inexistente.');
      if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, 'Método inválido.');
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      // Only public assets. Never serve server code, tests, dotfiles, packages or local configuration.
      const publicFile = /^\/[a-z0-9-]+\.(html|css|js)$/.test(pathname) && !pathname.endsWith('-server.js') || /^\/img\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|svg|webp|ico)$/.test(pathname) || /^\/downloads\/duckflix-http-[\d.]+\.zip$/.test(pathname);
      const target = path.resolve(root, '.' + pathname);
      if (!publicFile || !target.startsWith(path.resolve(root) + path.sep)) throw fail(404, 'Arquivo não encontrado.');
      const data = await fs.promises.readFile(target).catch(() => { throw fail(404, 'Arquivo não encontrado.'); });
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/zip', 'Cache-Control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) { if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Falha temporária no servidor.' }); else res.end(); }
  });
  const heartbeat = setInterval(() => {
    for (const [id, room] of rooms) {
      for (const [credential, member] of room.members) {
        if (member.stream) { room.touched = now(); if (!member.stream.write(`: heartbeat ${now()}\n\n`)) member.stream.destroy(); }
        else if (!member.host && now() - member.touched > 120000) room.members.delete(credential);
      }
      if (now() - room.touched > 21600000) rooms.delete(id);
    }
    for (const [key, entry] of limits) if (entry.until < now()) limits.delete(key);
  }, 5000);
  heartbeat.unref(); server.on('close', () => clearInterval(heartbeat));
  server.shutdown = () => { for (const room of rooms.values()) for (const member of room.members.values()) member.stream?.end(); server.close(); server.closeAllConnections(); };
  return server;
}
if (require.main === module) {
  const server = createServer({ allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean) });
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Duck Together: http://localhost:${port}/together.html`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.shutdown());
}
module.exports = { createServer, mediaInput };
