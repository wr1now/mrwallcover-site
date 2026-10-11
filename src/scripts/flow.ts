/**
 * Scroll flow: sections, headings, photographs and cards rise into place as they enter the viewport.
 *
 * Progressive: nothing is hidden until this script has run and confirmed motion is allowed, so the page is
 * complete without JavaScript, with prefers-reduced-motion, with the footer's "Reduce visual effects"
 * (html[data-effects="reduced"]) and for crawlers that do not run scripts. The hero is never animated, so the
 * largest paint is not delayed. Styles are in src/styles/flow.css.
 */
const TARGETS = [
  // Section heads and copy
  'main .atelier-section-head',
  'main .intro-head',
  'main .intro-copy',
  'main .intro-facts > div',
  'main .home-showcase-head',
  'main .atelier-hotel-band > .atelier-kicker',
  'main .home-more > :is(.atelier-kicker, h3, p)',
  'main .home-process > :is(.atelier-kicker, h2)',
  'main .home-needs > :is(.atelier-kicker, h2)',
  'main .home-calico > :is(.atelier-kicker, h2, p)',
  'main .atelier-service > div',
  'main .atelier-questions > div:first-child',
  'main .atelier-craft-copy > *',
  'main .atelier-materials-copy > *',
  'main .home-aftercare-inner > *',
  'main .atelier-contact > *',
  // Repeated items
  'main .hotel-band-item',
  'main .home-showcase-item',
  'main .atelier-project',
  'main .home-card',
  'main .home-proof-strip > figure',
  'main .atelier-service ol > li',
  'main .home-process ol > li',
  'main .home-needs-grid > a',
  'main .home-calico li',
  'main .faq > details',
  // Inner pages
  'main .page-head > :not(nav)',
  'main .case-study > *',
  'main .case-study-hero',
  'main section[aria-labelledby="gallery-heading"] figure',
  'main section[aria-labelledby="method-heading"] :is(h2, .lede, li)',
  'main .prose > :is(p, h2, h3, ul, ol, figure)',
  'main .container-page > section > .container-page > *',
].join(', ');

function motionAllowed(): boolean {
  const root = document.documentElement;
  if (root.dataset.effects === 'reduced') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return 'IntersectionObserver' in window;
}

function start(): void {
  if (!motionAllowed()) return;
  const root = document.documentElement;
  const nodes = [...document.querySelectorAll<HTMLElement>(TARGETS)].filter(
    (el) => !el.closest('.atelier-hero, .site-header, .site-footer, .dock, dialog, [hidden]'),
  );
  if (!nodes.length) return;

  // Stagger siblings that arrive together: the nth target inside the same parent waits n x 90ms (capped).
  const order = new Map<Element, number>();
  for (const el of nodes) {
    const parent = el.parentElement ?? document.body;
    const n = order.get(parent) ?? 0;
    el.style.setProperty('--flow-i', String(Math.min(n, 5)));
    order.set(parent, n + 1);
    el.setAttribute('data-flow', '');
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  // Turn the hidden state on only now, in the same frame as observing, so nothing flashes or stays hidden.
  root.classList.add('flow-on');
  for (const el of nodes) io.observe(el);

  // Anything the observer has not reached after a jump (anchor link, find-in-page, restored scroll) is shown.
  const revealAbove = () => {
    for (const el of nodes) if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
  };
  window.addEventListener('hashchange', revealAbove);
  window.addEventListener('pageshow', revealAbove);
  window.addEventListener('beforeprint', () => nodes.forEach((el) => el.classList.add('is-in')));
  // If the visitor switches effects off from the footer, stop hiding immediately.
  new MutationObserver(() => {
    if (root.dataset.effects === 'reduced') nodes.forEach((el) => el.classList.add('is-in'));
  }).observe(root, { attributes: true, attributeFilter: ['data-effects'] });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
