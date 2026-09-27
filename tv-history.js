/* Persistent, local-only history for channels that actually started playing. */
(function (root) {
  'use strict';
  const KEY = 'duckflix.tv.recent';
  function safeURL(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function create(storage, { key = KEY, limit = 8 } = {}) {
    function mediaURL(value) {
      try {
        const url = new URL(value);
        if (url.protocol === 'http:' && /\.m3u8$/i.test(url.pathname) && !url.username && !url.password) return url.href;
      } catch {}
      return safeURL(value);
    }
    function list() {
      try {
        const value = JSON.parse(storage?.getItem(key) || '[]');
        if (!Array.isArray(value)) return [];
        return value.map(entry => {
          const url = mediaURL(entry?.url);
          if (!url || typeof entry?.name !== 'string' || !entry.name.trim()) return null;
          const addonEndpoint = safeURL(entry.addonEndpoint);
          return {
            name: entry.name.trim().slice(0, 160),
            logo: safeURL(entry.logo) || '',
            categories: Array.isArray(entry.categories) ? entry.categories.filter(value => typeof value === 'string').slice(0, 8) : ['Undefined'],
            search: entry.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
            url,
            addonEndpoint,
            watchedAt: Number(entry.watchedAt) || 0
          };
        }).filter(Boolean).sort((a, b) => b.watchedAt - a.watchedAt).slice(0, limit);
      } catch { return []; }
    }
    function add(channel, watchedAt = Date.now()) {
      const addonEndpoint = safeURL(channel?.addonEndpoint);
      const url = addonEndpoint || mediaURL(channel?.url);
      if (!url || typeof channel?.name !== 'string' || !channel.name.trim()) return list();
      const entry = {
        name: channel.name.trim().slice(0, 160),
        logo: safeURL(channel.logo) || '',
        categories: Array.isArray(channel.categories) ? channel.categories.filter(value => typeof value === 'string').slice(0, 8) : ['Undefined'],
        url,
        addonEndpoint,
        watchedAt
      };
      const next = [entry, ...list().filter(item => (item.addonEndpoint || item.url) !== url)].slice(0, limit);
      try { storage?.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    }
    function clear() { try { storage?.removeItem(key); } catch {} }
    const identity = channel => channel?.addonEndpoint || channel?.url;
    function has(channel) { return list().some(item => identity(item) === identity(channel)); }
    function remove(channel) {
      try { storage?.setItem(key, JSON.stringify(list().filter(item => identity(item) !== identity(channel)))); } catch {}
    }
    return { list, add, clear, has, remove, key };
  }
  const api = { create, KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    let storage;
    try { storage = root.localStorage; } catch {}
    root.DuckTVHistory = create(storage);
    root.DuckTVFavorites = create(storage, { key: 'duckflix.tv.favorites', limit: 100 });
  }
})(typeof window !== 'undefined' ? window : globalThis);
