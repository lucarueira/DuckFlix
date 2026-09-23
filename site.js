(function () {
  'use strict';
  const notice = document.createElement('p');
  notice.className = 'safe-mode-status';
  notice.setAttribute('role', 'status');
  notice.textContent = 'Modo Livre ativo · Conteúdo +18 e títulos sem classificação brasileira confirmada ficam ocultos.';
  document.querySelector('.header')?.after(notice);
  function updateMode() { notice.hidden = !window.DuckFlixSafety?.enabled(); }
  window.addEventListener('duckflix:modechange', updateMode);
  updateMode();
  document.querySelectorAll('[data-fullscreen]').forEach(button => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.dataset.fullscreen);
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (target.requestFullscreen) await target.requestFullscreen();
        else if (target.querySelector('video')?.webkitEnterFullscreen) target.querySelector('video').webkitEnterFullscreen();
        else { button.textContent = 'Use a tela cheia do vídeo'; }
      } catch { button.textContent = 'Use a tela cheia do vídeo'; }
    });
  });
  document.addEventListener('fullscreenchange', () => {
    document.querySelectorAll('[data-fullscreen]').forEach(button => {
      button.textContent = document.fullscreenElement ? '⛶ Sair da tela cheia' : '⛶ Tela cheia';
    });
  });
})();
