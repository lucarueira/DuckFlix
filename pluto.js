(() => {
  'use strict';
  const button = document.getElementById('pluto-embed');
  const close = document.getElementById('pluto-close');
  const viewer = document.getElementById('pluto-viewer');
  const status = document.getElementById('pluto-status');
  if (!button || !close || !viewer || !status) return;
  button.hidden = false;
  const initialMessage = status.textContent;
  function stop() {
    // Removing the frame stops its media/network session, rather than just hiding it.
    viewer.replaceChildren();
    viewer.hidden = true;
    close.hidden = true;
    button.disabled = false;
    button.setAttribute('aria-expanded', 'false');
    status.textContent = initialMessage;
  }
  button.addEventListener('click', () => {
    if (viewer.children.length) return;
    const frame = document.createElement('iframe');
    frame.src = 'https://pluto.tv/br/home/';
    frame.title = 'Página oficial da Pluto TV Brasil';
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    viewer.append(frame);
    viewer.hidden = false;
    close.hidden = false;
    button.disabled = true;
    button.setAttribute('aria-expanded', 'true');
    // Cross-origin load events cannot establish that playback succeeded.
    status.textContent = 'Tentativa de abrir a página oficial abaixo. Se o vídeo não aparecer ou não iniciar, clique em “Abrir Pluto TV em nova aba”.';
  });
  close.addEventListener('click', () => { stop(); button.focus(); });
  window.addEventListener('pagehide', stop);
})();
