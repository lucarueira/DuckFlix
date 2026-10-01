'use strict';

const API = 'https://api.mangadex.org';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE = /^[a-zA-Z0-9-]+\.(?:jpg|jpeg|png|webp|gif)$/;
const atHomeCache = new Map();
const metadataCache = new Map();
const fail = (status, message) => Object.assign(new Error(message), { status });

async function request(path, params, ttl = 0) {
  const url = new URL(path, API);
  if (params) for (const [key, value] of params) url.searchParams.append(key, value);
  const key = url.href;
  const cached = metadataCache.get(key);
  if (cached && cached.until > Date.now()) return cached.data;
  let response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': 'DuckFlix/0.2.0 (DuckMangas reader)', Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  } catch { throw fail(502, 'O MangaDex não respondeu. Tente novamente.'); }
  if (response.status === 429) throw fail(429, 'O MangaDex limitou as consultas. Aguarde um pouco.');
  if (!response.ok) throw fail(response.status === 404 ? 404 : 502, 'Não foi possível consultar o MangaDex.');
  const data = await response.json();
  if (ttl) {
    if (metadataCache.size > 150) metadataCache.clear();
    metadataCache.set(key, { data, until: Date.now() + ttl });
  }
  return data;
}

function id(value) {
  if (!UUID.test(String(value || ''))) throw fail(400, 'Identificador de mangá inválido.');
  return String(value);
}

function manga(item) {
  const attr = item.attributes || {};
  const cover = item.relationships?.find(value => value.type === 'cover_art')?.attributes?.fileName;
  const alternate = attr.altTitles?.find(value => value['pt-br'])?.['pt-br'];
  return {
    id: item.id,
    title: alternate || attr.title?.['pt-br'] || attr.title?.en || Object.values(attr.title || {})[0] || 'Sem título',
    originalTitle: Object.values(attr.title || {})[0] || '',
    description: attr.description?.['pt-br'] || attr.description?.en || Object.values(attr.description || {})[0] || '',
    status: attr.status || '', year: attr.year || null,
    cover: cover && FILE.test(cover) ? { id: item.id, file: cover } : null,
    tags: (attr.tags || []).slice(0, 6).map(tag => tag.attributes?.name?.['pt-br'] || tag.attributes?.name?.en).filter(Boolean),
    url: `https://mangadex.org/title/${item.id}`
  };
}

async function catalog(action, query = {}) {
  if (action === 'search') {
    const title = String(query.q || '').trim().slice(0, 100);
    const offset = Math.max(0, Math.min(9500, Number.parseInt(query.offset, 10) || 0));
    const params = new URLSearchParams({ limit: '24', offset: String(offset) });
    if (title) params.set('title', title);
    params.append('availableTranslatedLanguage[]', 'pt-br');
    params.append('includes[]', 'cover_art');
    params.append('contentRating[]', 'safe');
    params.append(title ? 'order[relevance]' : 'order[followedCount]', 'desc');
    const data = await request('/manga', params, 60000);
    return { items: (data.data || []).map(manga), total: data.total || 0, offset };
  }
  if (action === 'detail') {
    const mangaId = id(query.id);
    const params = new URLSearchParams(); params.append('includes[]', 'cover_art');
    const data = await request(`/manga/${mangaId}`, params, 300000);
    if (!data.data) throw fail(404, 'Mangá não encontrado.');
    return manga(data.data);
  }
  if (action === 'chapters') {
    const mangaId = id(query.id);
    const offset = Math.max(0, Math.min(9500, Number.parseInt(query.offset, 10) || 0));
    const params = new URLSearchParams({ limit: '100', offset: String(offset), 'order[chapter]': 'asc' });
    params.append('translatedLanguage[]', 'pt-br');
    params.append('includes[]', 'scanlation_group');
    const data = await request(`/manga/${mangaId}/feed`, params, 60000);
    return { total: data.total || 0, offset, items: (data.data || []).filter(item => !item.attributes?.externalUrl && !item.attributes?.isUnavailable && item.attributes?.pages > 0).map(item => ({
      id: item.id, number: item.attributes.chapter || '', volume: item.attributes.volume || '', title: item.attributes.title || '', pages: item.attributes.pages,
      group: item.relationships?.find(value => value.type === 'scanlation_group')?.attributes?.name || 'Grupo não informado',
      groupId: item.relationships?.find(value => value.type === 'scanlation_group')?.id || null
    })) };
  }
  if (action === 'pages') {
    const chapterId = id(query.id);
    const data = await atHome(chapterId);
    const compact = data.chapter.dataSaver.length > 0;
    const files = compact ? data.chapter.dataSaver : data.chapter.data;
    return { pages: files.length, chapterId, baseUrl: data.baseUrl, hash: data.chapter.hash, quality: compact ? 'data-saver' : 'data', files };
  }
  throw fail(400, 'Consulta inválida.');
}

async function atHome(chapterId) {
  const cached = atHomeCache.get(chapterId);
  if (cached && cached.until > Date.now()) return cached.data;
  const data = await request(`/at-home/server/${chapterId}`);
  const base = new URL(data.baseUrl);
  if (base.protocol !== 'https:' || !/(^|\.)mangadex\.(network|org)$/.test(base.hostname) || !/^[a-f0-9]+$/.test(data.chapter?.hash) || !Array.isArray(data.chapter?.dataSaver)) throw fail(502, 'Servidor de páginas inválido.');
  if (atHomeCache.size > 100) atHomeCache.clear();
  atHomeCache.set(chapterId, { data, until: Date.now() + 600000 });
  return data;
}

async function image(query = {}) {
  let url;
  if (query.kind === 'cover') {
    const mangaId = id(query.id), file = String(query.file || '');
    if (!FILE.test(file)) throw fail(400, 'Capa inválida.');
    url = `https://uploads.mangadex.org/covers/${mangaId}/${file}.256.jpg`;
  } else if (query.kind === 'page') {
    let base;
    try { base = new URL(String(query.base || '')); } catch { throw fail(400, 'Página inválida.'); }
    const hash = String(query.hash || ''), file = String(query.file || ''), quality = String(query.quality || '');
    if (base.protocol !== 'https:' || !/(^|\.)mangadex\.(network|org)$/.test(base.hostname) || base.pathname !== '/' || base.search || base.hash || base.port || base.username || base.password || !/^[a-f0-9]{32}$/.test(hash) || !FILE.test(file) || !['data', 'data-saver'].includes(quality)) throw fail(400, 'Página inválida.');
    url = `${base.origin}/${quality}/${hash}/${file}`;
  } else throw fail(400, 'Imagem inválida.');
  let response;
  try { response = await fetch(url, { headers: { 'User-Agent': 'DuckFlix/0.2.0 (DuckMangas reader)' }, signal: AbortSignal.timeout(20000) }); }
  catch { throw fail(502, 'Imagem indisponível no momento.'); }
  if (!response.ok) throw fail(response.status === 404 ? 404 : 502, 'Imagem indisponível no momento.');
  const type = response.headers.get('content-type')?.split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(type)) throw fail(502, 'Formato de imagem inválido.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 4000000) throw fail(502, 'Imagem muito grande para esta conexão.');
  return { bytes, type };
}

module.exports = { catalog, image };
