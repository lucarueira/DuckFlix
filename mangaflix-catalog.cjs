'use strict';
// Fonte MangaFlix (português) para o DuckMangás. Portado da extensão Keiyoushi "MangaFlix" (API JSON pública).
// Conteúdo adulto é sempre filtrado, em linha com o Modo Livre do DuckFlix.

const API = 'https://api.mangaflix.net/v1';
const IMAGE_HOST = 'static.mangaflix.net';
const PREFIX = 'mf-';
const OBJECT_ID = /^[0-9a-f]{24}$/i;
const IMAGE_PATH = /^\/[A-Za-z0-9/_.-]{1,300}\.(?:jpg|jpeg|png|webp|gif)$/i;
const cache = new Map();
const fail = (status, message) => Object.assign(new Error(message), { status });

async function request(path, ttl = 0) {
  const cached = cache.get(path);
  if (cached && cached.until > Date.now()) return cached.data;
  let response;
  try { response = await fetch(API + path, { headers: { 'User-Agent': 'DuckFlix/0.2.0 (DuckMangas reader)', Accept: 'application/json' }, signal: AbortSignal.timeout(12000) }); }
  catch { throw fail(502, 'O MangaFlix não respondeu. Tente novamente.'); }
  if (response.status === 429) throw fail(429, 'O MangaFlix limitou as consultas. Aguarde um pouco.');
  if (!response.ok) throw fail(response.status === 404 ? 404 : 502, 'Não foi possível consultar o MangaFlix.');
  let data;
  try { data = await response.json(); } catch { throw fail(502, 'Resposta inválida do MangaFlix.'); }
  if (ttl) { if (cache.size > 150) cache.clear(); cache.set(path, { data, until: Date.now() + ttl }); }
  return data;
}

function rawId(value) {
  const text = String(value || '');
  if (!text.startsWith(PREFIX) || !OBJECT_ID.test(text.slice(PREFIX.length))) throw fail(400, 'Identificador de mangá inválido.');
  return text.slice(PREFIX.length);
}

function imagePath(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === IMAGE_HOST && IMAGE_PATH.test(parsed.pathname) ? parsed.pathname : null;
  } catch { return null; }
}

async function adultGenres() {
  const data = await request('/genres?include_adult=true&selected_language=pt-br', 3600000);
  return new Set((data.data || []).filter(genre => genre.adult).map(genre => String(genre._id)));
}

function manga(item, tags = []) {
  const path = imagePath(item.poster?.default_url);
  return {
    id: PREFIX + item._id, source: 'mangaflix', title: item.name || 'Sem título', originalTitle: '',
    description: item.description || '', status: '', year: null,
    cover: path ? { id: PREFIX + item._id, path } : null, tags: tags.slice(0, 6),
    url: `https://mangaflix.net/br/manga/${item._id}`
  };
}

async function catalog(action, query = {}) {
  if (action === 'search') {
    const text = String(query.q || '').trim().slice(0, 100);
    const offset = Math.max(0, Number.parseInt(query.offset, 10) || 0);
    let works;
    if (text) {
      const data = await request(`/search/mangas?query=${encodeURIComponent(text)}&selected_language=pt-br`, 60000);
      const blocked = await adultGenres();
      works = (data.data?.works || []).filter(work => !work.is_adult && !(work.genres || []).some(genre => blocked.has(String(genre))));
    } else {
      const data = await request('/browse', 60000);
      works = (data.data || []).find(section => section.key === 'most-read')?.items || [];
      works = works.filter(work => !work.is_adult && !(work.genres || []).some(genre => genre.adult));
    }
    const items = works.slice(offset, offset + 24).map(work => manga(work, (work.genres || []).map(genre => genre.name).filter(Boolean)));
    return { items, total: works.length, offset };
  }
  if (action === 'detail') {
    const id = rawId(query.id);
    const data = (await request(`/mangas/${id}`, 300000)).data;
    if (!data) throw fail(404, 'Mangá não encontrado.');
    if (data.is_adult || (data.genres || []).some(genre => genre.adult)) throw fail(403, 'Conteúdo indisponível no Modo Livre.');
    return manga(data, (data.genres || []).map(genre => genre.name).filter(Boolean));
  }
  if (action === 'chapters') {
    const id = rawId(query.id);
    const language = query.language || 'pt-br';
    if (language !== 'pt-br' && language !== 'all') return { total: 0, offset: 0, limit: 0, hiddenCount: 0, items: [] };
    const data = (await request(`/mangas/${id}`, 300000)).data || {};
    const all = (data.chapters || []).slice().sort((a, b) => (Number.parseFloat(a.number) || 0) - (Number.parseFloat(b.number) || 0));
    const offset = Math.max(0, Number.parseInt(query.offset, 10) || 0);
    const slice = all.slice(offset, offset + 100);
    const items = slice.filter(chapter => OBJECT_ID.test(chapter._id)).map(chapter => ({
      id: PREFIX + chapter._id, number: String(chapter.number ?? ''), volume: '', title: '', pages: chapter.number_of_pages || 0, language: 'pt-br',
      group: (chapter.owners || []).map(owner => owner.name).filter(Boolean).join(', ') || 'Grupo não informado', groupId: null, externalUrl: null, externalLabel: null
    }));
    return { total: all.length, offset, limit: slice.length, hiddenCount: slice.length - items.length, items };
  }
  if (action === 'pages') {
    const id = rawId(query.id);
    const data = (await request(`/chapters/${id}?selected_language=pt-br`, 600000)).data;
    const files = (data?.images || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(item => imagePath(item.default_url)).filter(Boolean);
    return { pages: files.length, chapterId: PREFIX + id, source: 'mangaflix', files };
  }
  throw fail(400, 'Consulta inválida.');
}

async function image(query = {}) {
  const path = String(query.path || '');
  if (!IMAGE_PATH.test(path)) throw fail(400, 'Imagem inválida.');
  let response;
  try { response = await fetch(`https://${IMAGE_HOST}${path}`, { headers: { 'User-Agent': 'DuckFlix/0.2.0 (DuckMangas reader)' }, signal: AbortSignal.timeout(20000) }); }
  catch { throw fail(502, 'Imagem indisponível no momento.'); }
  if (!response.ok) throw fail(response.status === 404 ? 404 : 502, 'Imagem indisponível no momento.');
  const type = response.headers.get('content-type')?.split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(type)) throw fail(502, 'Formato de imagem inválido.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 4000000) throw fail(502, 'Imagem muito grande para esta conexão.');
  return { bytes, type };
}

module.exports = { catalog, image, PREFIX };
