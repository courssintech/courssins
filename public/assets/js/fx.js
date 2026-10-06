const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let io, cio;

function countUp(el) {
  const end = parseFloat(el.dataset.count), suffix = el.dataset.suffix || '';
  if (reduce || isNaN(end)) { el.textContent = end + suffix; return; }
  const t0 = performance.now(), dur = 1400;
  const tick = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(end * e) + suffix; if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
/** Call after rendering new DOM: wires scroll reveal and number counters for anything not yet observed. */
export function refresh(root = document) {
  io ||= new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  cio ||= new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } }), { threshold: 0.6 });
  root.querySelectorAll('[data-reveal]:not(.in)').forEach((el, i) => { if (reduce) return el.classList.add('in'); if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${(el.dataset.revealDelay ?? (i % 4) * 70)}ms`); io.observe(el); });
  root.querySelectorAll('[data-count]:not([data-counted])').forEach((el) => { el.dataset.counted = '1'; cio.observe(el); });
}
let ticking = false;
function parallax() {
  const els = document.querySelectorAll('[data-parallax]');
  if (!els.length || reduce) return;
  const run = () => { const vh = innerHeight; els.forEach((el) => { const r = el.getBoundingClientRect(); if (r.bottom < -100 || r.top > vh + 100) return; const k = parseFloat(el.dataset.parallax) || .06; el.style.setProperty('--py', `${((r.top + r.height / 2 - vh / 2) * -k).toFixed(1)}px`); }); ticking = false; };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true }); run();
}
/** Scroll-snap carousel with prev/next buttons. */
export function carousel(root) {
  const track = root.querySelector('[data-track]'); if (!track) return;
  const step = () => Math.max(260, track.querySelector(':scope > *')?.getBoundingClientRect().width + 24 || 300);
  root.querySelector('[data-prev]')?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
  root.querySelector('[data-next]')?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
  const upd = () => { const p = root.querySelector('[data-prev]'), n = root.querySelector('[data-next]'); if (p) p.disabled = track.scrollLeft < 8; if (n) n.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8; };
  track.addEventListener('scroll', upd, { passive: true }); upd(); setTimeout(upd, 400);
}
export function initFx() { refresh(); parallax(); }
