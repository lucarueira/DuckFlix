(() => {
  'use strict';
  const entry = document.getElementById('adultEntry');
  if (!entry) return;
  const safeModeEnabled = () => {
    if (window.DuckFlixSafety) return window.DuckFlixSafety.enabled();
    try { return localStorage.getItem('duckflix.modoLivre') === 'true' || localStorage.getItem('kidsMode') === 'true'; }
    catch { return true; }
  };
  function sync() {
    const blocked = safeModeEnabled();
    entry.hidden = blocked;
    if (blocked) entry.open = false;
  }
  sync();
  window.addEventListener('duckflix:modechange', sync);
  window.addEventListener('storage', event => {
    if (!event.key || ['duckflix.modoLivre', 'kidsMode'].includes(event.key)) sync();
  });
})();
