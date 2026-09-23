/* A saved movie list and a finite playback session. No automatic looping. */
(function () {
  'use strict';
  const storageKey = 'duckflix.extensoes.movieQueue';
  const key = item => String(item.tmdbId ? `tmdb:${item.tmdbId}` : item.id);
  function create({ storage, allowed = async () => true, play, onChange = () => {} }) {
    let items = [], active = false, current = null, token = 0, message = '', visited = new Set();
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) || '[]');
      const seen = new Set();
      if (Array.isArray(saved)) items = saved.filter(item => {
        if (!item || item.type !== 'movie' || !/^(?:tmdb:|tt)?\d+$/.test(String(item.id)) || typeof item.name !== 'string' || seen.has(key(item))) return false;
        seen.add(key(item)); return true;
      }).slice(0, 200);
    } catch {}
    const snapshot = () => ({ items: items.map(item => ({ ...item })), active, current, token, message });
    const changed = () => onChange(snapshot());
    function persist() { try { storage?.setItem(storageKey, JSON.stringify(items)); } catch {} changed(); }
    function stop(text = 'Sequência pausada. Sua lista foi mantida.') { active = false; current = null; token++; message = text; changed(); }
    async function next(reason) {
      if (!active) return;
      const generation = ++token;
      current = null;
      message = reason === 'failed' ? 'Filme indisponível. Passando para o próximo…' : 'Preparando o próximo filme…';
      changed();
      while (active && generation === token) {
        const item = items.find(entry => !visited.has(key(entry)));
        if (!item) { stop('Lista concluída. Escolha novos filmes ou reproduza novamente.'); return; }
        const id = key(item); visited.add(id);
        let permitted = false;
        try { permitted = await allowed(item); } catch {}
        if (!active || generation !== token) return;
        if (!permitted || !items.some(entry => key(entry) === id)) continue;
        current = id; message = 'Reprodução automática ativa.'; changed();
        try { await play(item, generation); }
        catch { if (active && generation === token) { current = null; continue; } }
        return;
      }
    }
    return {
      snapshot,
      has: item => items.some(entry => key(entry) === key(item)),
      add(item) {
        if (item.type !== 'movie' || !/^(?:tmdb:|tt)?\d+$/.test(String(item.id)) || items.some(entry => key(entry) === key(item))) return false;
        if (items.length >= 200) { message = 'Sua lista já tem 200 filmes.'; changed(); return false; }
        items.push({ ...item }); message = 'Filme adicionado à lista.'; persist(); return true;
      },
      remove(id) { if (active && current === id) return; items = items.filter(item => key(item) !== id); persist(); },
      move(id, direction) {
        const index = items.findIndex(item => key(item) === id), target = index + direction;
        if (index < 0 || target < 0 || target >= items.length) return;
        [items[index], items[target]] = [items[target], items[index]]; persist();
      },
      clear() { stop('Lista limpa. Adicione filmes pelo catálogo.'); items = []; persist(); },
      start() { active = true; visited = new Set(); return next(); },
      advance(event) { if (!active || event.token !== token) return; return next(event.reason); },
      stop
    };
  }
  const api = { create, key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.DuckFlixQueue = api;
})();
