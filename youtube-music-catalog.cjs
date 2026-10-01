'use strict';

let clientPromise;
const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;

function error(status, message) {
  return Object.assign(new Error(message), { status });
}

async function client() {
  if (!clientPromise) {
    clientPromise = import('youtubei.js')
      .then(({ Innertube }) => Innertube.create({ lang: 'pt', location: 'BR' }))
      .catch(cause => { clientPromise = null; throw cause; });
  }
  return clientPromise;
}

function readTracks(search, kind = 'song') {
  const seen = new Set();
  const tracks = [];
  for (const section of search.contents || []) {
    for (const item of section.contents || []) {
      const id = String(item.id || '');
      if (!/^[A-Za-z0-9_-]{11}$/.test(id) || seen.has(id)) continue;
      const seconds = Number(item.duration?.seconds);
      if (kind === 'video' && (!Number.isFinite(seconds) || seconds < 90 || seconds > 600)) continue;
      const title = typeof item.title === 'string' ? item.title : item.title?.toString();
      if (!title) continue;
      const credits = item.artists || item.authors || [];
      const artist = Array.isArray(credits) ? credits.map(value => value.name).filter(Boolean).join(', ') : '';
      seen.add(id);
      tracks.push({ id, title: title.slice(0, 160), artist: artist.slice(0, 180) || 'Artista desconhecido', kind });
      if (tracks.length >= 30) return tracks;
    }
  }
  return tracks;
}

async function searchMusic(query) {
  const term = String(query || '').trim();
  if (term.length < 2 || term.length > 100) throw error(400, 'Digite de 2 a 100 caracteres para buscar.');
  const key = term.toLocaleLowerCase('pt-BR');
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return { tracks: cached.tracks };
  try {
    const youtube = await client();
    let tracks = readTracks(await youtube.music.search(term, { type: 'song' }));
    try {
      const seen = new Set(tracks.map(track => track.id));
      const videos = readTracks(await youtube.music.search(term, { type: 'video' }), 'video');
      tracks = [...tracks, ...videos.filter(track => !seen.has(track.id)).slice(0, 10)].slice(0, 30);
    } catch (cause) { if (!tracks.length) throw cause; }
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key, { until: Date.now() + CACHE_MS, tracks });
    return { tracks };
  } catch (cause) {
    if (cause.status) throw cause;
    throw error(502, 'A busca de músicas está temporariamente indisponível.');
  }
}

module.exports = { searchMusic };
