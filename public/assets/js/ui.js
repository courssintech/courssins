import { icon, hasIcon } from './icons.js';
export { icon };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeLink = (value) => /^(https?:\/\/|\/(?!\/)|[a-z0-9_.-]+\.html(?:[?#]|$))/i.test(String(value || '')) ? esc(value) : '#';
export const money = (n, cur = 'NGN') => (Number(n) === 0 ? 'Free' : new Intl.NumberFormat('en-NG', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n));
export const fmtDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => (d ? new Date(d).toLocaleDateString('en-GB', opts) : '');
export const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const qs = (k) => new URLSearchParams(location.search).get(k);
export const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'C';
export const arr = (v) => (Array.isArray(v) ? v : []);
export const socialIcon = (k) => { const n = k === 'x' ? 'twitter' : k; return hasIcon(n) ? n : 'website'; };

/** Removes anything executable from admin-authored HTML before it is shown. */
export function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,link,meta,base,style,form,svg script,noscript,template').forEach((n) => n.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
      if (n.startsWith('on') || n === 'srcdoc' || n === 'formaction') el.removeAttribute(a.name);
      else if (['href', 'src', 'xlink:href', 'action'].includes(n) && (/^(javascript|vbscript):/.test(v) || (/^data:/.test(v) && !(el.tagName === 'IMG' && /^data:image\/(png|jpe?g|gif|webp);/.test(v))))) el.removeAttribute(a.name);
    });
    if (el.tagName === 'A' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
  });
  return doc.body.innerHTML;
}
/** Strips the few CSS constructs that can load remote code or leak data. */
export const sanitizeCSS = (css) => String(css || '').replace(/@import[^;]*;?/gi, '').replace(/expression\s*\(/gi, '').replace(/javascript:/gi, '').replace(/behavior\s*:/gi, '').replace(/-moz-binding\s*:/gi, '');

export function img(src, alt, { w = 800, h = 600, lazy = true, cls = '' } = {}) {
  return `<img class="${cls}" src="${esc(src || 'assets/images/hero.svg')}" alt="${esc(alt)}" width="${w}" height="${h}" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`;
}

export function courseCard(c) {
  const tutors = c.tutors?.map((t) => t.full_name).filter(Boolean) || (c.tutor?.full_name ? [c.tutor.full_name] : []);
  const tutor = tutors.join(', ');
  return `<article class="card course-card" data-reveal>
    <a class="card-media" href="course.html?id=${esc(c.slug)}" tabindex="-1" aria-hidden="true">${img(c.image_url, c.title, { w: 800, h: 600 })}<span class="chip chip-float">${esc(c.category || 'Course')}</span></a>
    <div class="card-body">
      <h3 class="card-title"><a href="course.html?id=${esc(c.slug)}">${esc(c.title)}</a></h3>
      <p class="card-text">${esc(c.short_description)}</p>
      <ul class="meta-row"><li>${icon('clock', '', 16)}${esc(c.duration)}</li>${tutor ? `<li>${icon('user', '', 16)}${esc(tutor)}</li>` : ''}</ul>
      <div class="card-foot"><strong class="price">${money(c.price, c.currency)}</strong>
        <div class="btn-row"><a class="btn btn-outline btn-sm" href="course.html?id=${esc(c.slug)}">View course</a><a class="btn btn-lime btn-sm" href="course.html?id=${esc(c.slug)}&enroll=1">Enrol</a></div></div>
    </div></article>`;
}
export function socialLinks(s = {}) {
  const items = Object.entries(s).filter(([, u]) => /^https?:\/\//.test(u || ''));
  return items.length ? `<ul class="socials">${items.map(([k, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(k)}">${icon(socialIcon(k), '', 18)}</a></li>`).join('')}</ul>` : '';
}
export function tutorCard(t) {
  return `<article class="card tutor-card" data-reveal>
    <a class="tutor-photo" href="tutor.html?id=${esc(t.slug)}" tabindex="-1" aria-hidden="true">${img(t.image_url, t.full_name, { w: 480, h: 560 })}</a>
    <div class="card-body"><h3 class="card-title"><a href="tutor.html?id=${esc(t.slug)}">${esc(t.full_name)}</a></h3>
      <p class="tutor-role">${esc(t.specialization)}</p><p class="card-text">${esc((t.bio || '').slice(0, 110))}${(t.bio || '').length > 110 ? '…' : ''}</p>
      <div class="card-foot">${socialLinks(t.socials)}<a class="btn btn-dark btn-sm" href="tutor.html?id=${esc(t.slug)}">View profile</a></div></div></article>`;
}
export function postCard(p) {
  return `<article class="card post-card" data-reveal>
    <a class="card-media" href="article.html?id=${esc(p.slug)}" tabindex="-1" aria-hidden="true">${img(p.image_url, p.title, { w: 800, h: 500 })}</a>
    <div class="card-body"><span class="chip">${esc(p.category)}</span><h3 class="card-title"><a href="article.html?id=${esc(p.slug)}">${esc(p.title)}</a></h3>
      <p class="card-text">${esc(p.excerpt)}</p><a class="link-arrow" href="article.html?id=${esc(p.slug)}">Read article ${icon('arrow-right', '', 18)}</a></div></article>`;
}
export const empty = (title, text, action = '') => `<div class="empty"><div class="empty-icon">${icon('sparkle', '', 28)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
export const skeletons = (n = 3) => Array.from({ length: n }, () => '<div class="card skeleton" aria-hidden="true"></div>').join('');

let toastBox;
export function toast(msg, type = 'info') {
  if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); }
  const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg; toastBox.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 4200);
}
export function setMeta({ title, description, image, url, type = 'website', jsonld } = {}) {
  const full = title ? `${title} | Courssins Technology Institute` : document.title;
  document.title = full;
  const set = (sel, attr, val, mk) => { if (val == null) return; let el = document.head.querySelector(sel); if (!el) { el = document.createElement(mk.tag); Object.entries(mk.attrs).forEach(([k, v]) => el.setAttribute(k, v)); document.head.appendChild(el); } el.setAttribute(attr, val); };
  set('meta[name="description"]', 'content', description, { tag: 'meta', attrs: { name: 'description' } });
  set('meta[property="og:title"]', 'content', full, { tag: 'meta', attrs: { property: 'og:title' } });
  set('meta[property="og:description"]', 'content', description, { tag: 'meta', attrs: { property: 'og:description' } });
  set('meta[property="og:type"]', 'content', type, { tag: 'meta', attrs: { property: 'og:type' } });
  if (image) set('meta[property="og:image"]', 'content', image, { tag: 'meta', attrs: { property: 'og:image' } });
  if (url) { set('link[rel="canonical"]', 'href', url, { tag: 'link', attrs: { rel: 'canonical' } }); set('meta[property="og:url"]', 'content', url, { tag: 'meta', attrs: { property: 'og:url' } }); }
  if (jsonld) { let s = document.getElementById('jsonld-dyn'); if (!s) { s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'jsonld-dyn'; document.head.appendChild(s); } s.textContent = JSON.stringify(jsonld); }
}
export function modal({ title, body, actions = '', wide = false }) {
  const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', title);
  m.innerHTML = `<div class="modal-backdrop" data-close></div><div class="modal-card ${wide ? 'wide' : ''}"><header class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header><div class="modal-body">${body}</div>${actions ? `<footer class="modal-foot">${actions}</footer>` : ''}</div>`;
  document.body.appendChild(m); document.body.classList.add('no-scroll');
  const prev = document.activeElement;
  const close = () => { m.classList.remove('in'); document.body.classList.remove('no-scroll'); setTimeout(() => { m.remove(); prev?.focus?.(); }, 220); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  m.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  requestAnimationFrame(() => { m.classList.add('in'); (m.querySelector('input,select,textarea,button:not([data-close])') || m.querySelector('[data-close]')).focus(); });
  return { el: m, close };
}
export const setBusy = (btn, busy, text) => { if (!btn) return; if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>${esc(text || 'Please wait')}`; } else { btn.disabled = false; btn.innerHTML = btn.dataset.label || btn.innerHTML; } };
