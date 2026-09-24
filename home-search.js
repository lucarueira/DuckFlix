/* Search lifecycle shared by typing, submitting, pagination and safety refresh. */
(() => {
  function create({ input, button, more, status, list, fetchPage, render, open, close, schedule = setTimeout, cancel = clearTimeout }) {
    let timer, controller, revision = 0, page = 0, total = 0, query = '', busy = false;
    const seen = new Set();
    function invalidate() {
      cancel(timer);
      controller?.abort();
      revision++;
      busy = false;
      list.setAttribute('aria-busy', 'false');
    }
    function reset() {
      invalidate();
      query = ''; page = total = 0; seen.clear();
      list.replaceChildren(); status.textContent = ''; more.hidden = true;
      close();
    }
    async function search(append = false) {
      const value = input.value.trim();
      if (!value) { reset(); return; }
      if (append && (busy || value !== query || page >= total)) return;
      invalidate();
      const current = revision;
      controller = new AbortController();
      const activeController = controller;
      const timeout = schedule(() => activeController.abort(), 20000);
      if (!append) { query = value; page = 0; seen.clear(); list.replaceChildren(); }
      const next = page + 1;
      busy = true; more.hidden = true;
      open(); list.setAttribute('aria-busy', 'true'); status.textContent = 'Pesquisando…';
      try {
        const data = await fetchPage(value, next, controller.signal);
        if (revision !== current) return;
        for (const item of data.results || []) {
          if (!['movie', 'tv'].includes(item.media_type) || !item.poster_path) continue;
          const key = `${item.media_type}:${item.id}`;
          if (seen.has(key)) continue;
          seen.add(key); render(item);
        }
        page = next; total = Math.min(Number(data.total_pages) || 1, 500);
        status.textContent = list.childElementCount ? `${list.childElementCount} títulos encontrados.` : 'Nenhum título encontrado nesta página. Tente outro nome ou carregue mais resultados.';
        more.textContent = 'Carregar mais'; more.hidden = page >= total;
      } catch (error) {
        if (revision !== current) return;
        status.textContent = 'Não foi possível pesquisar. Tente novamente.';
        more.textContent = 'Tentar novamente'; more.hidden = false;
        total = Math.max(total, next);
      } finally {
        cancel(timeout);
        if (revision === current) { busy = false; list.setAttribute('aria-busy', 'false'); }
      }
    }
    input.addEventListener('input', () => {
      invalidate();
      if (!input.value.trim()) { reset(); return; }
      list.replaceChildren(); more.hidden = true; open(); status.textContent = 'Pesquisando…';
      timer = schedule(() => search(), 350);
    });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
    button.onclick = () => search();
    more.onclick = () => search(true);
    return { search, reset };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
  else window.DuckFlixSearch = { create };
})();
