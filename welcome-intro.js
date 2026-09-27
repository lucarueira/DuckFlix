(() => {
  const section = document.querySelector('.welcome-intro');
  const video = document.getElementById('welcome-intro-video');
  const skip = document.getElementById('skip-intro');
  if (!section || !video || !skip) return;
  const close = () => { video.pause(); section.hidden = true; };
  skip.addEventListener('click', close);
  video.addEventListener('ended', close, { once: true });
  video.addEventListener('error', close, { once: true });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) close();
})();
