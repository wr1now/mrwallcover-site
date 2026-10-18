/** CSS paper forms share the existing preferences; there is no animation loop or renderer. */
export function mountAtelierAtmosphere() {
  const layer = document.querySelector<HTMLElement>('[data-atelier-motion="active"]');
  if (!layer) return;
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let loaded = document.readyState === 'complete';
  const sync = () => layer.toggleAttribute('data-running', loaded && !document.hidden && !motion.matches && root.dataset.effects !== 'reduced' && root.dataset.objectMotionState !== 'paused');
  const preferences = new MutationObserver(sync);
  const observe = () => preferences.observe(root, { attributes: true, attributeFilter: ['data-effects', 'data-object-motion-state'] });
  observe();
  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('load', () => { loaded = true; sync(); }, { once: true });
  window.addEventListener('pagehide', () => { preferences.disconnect(); layer.removeAttribute('data-running'); });
  window.addEventListener('pageshow', () => { observe(); sync(); });
  sync();
}
