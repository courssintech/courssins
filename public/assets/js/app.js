import { CONFIG } from './config.js';
import { supabase, configured, getSession, getProfile, homeFor, signOut } from './supabase.js';
import { getSetting, subscribe } from './api.js';
import { toast, socialLinks, esc } from './ui.js';
import { icon } from './icons.js';
import { initFx, refresh } from './fx.js';

const here = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';

async function inject(id, url) {
  const host = document.getElementById(id); if (!host) return null;
  try { host.innerHTML = await (await fetch(url)).text(); } catch { host.innerHTML = ''; }
  return host;
}
function initHeader() {
  const header = document.getElementById('siteHeader'); if (!header) return;
  const onScroll = () => header.classList.toggle('is-stuck', scrollY > 12);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });
  const map = { index: 'index', about: 'about', courses: 'courses', course: 'courses', tutors: 'tutors', tutor: 'tutors', library: 'library', blog: 'blog', article: 'blog' };
  document.querySelectorAll('[data-nav]').forEach((a) => { if (a.dataset.nav === map[here]) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); } });
  const btn = header.querySelector('.menu-toggle'), menu = document.getElementById('mobileMenu');
  const setOpen = (o) => { header.classList.toggle('menu-open', o); btn.setAttribute('aria-expanded', o); btn.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); menu.toggleAttribute('inert', !o); document.body.classList.toggle('no-scroll', o); };
  setOpen(false);
  btn.addEventListener('click', () => setOpen(!header.classList.contains('menu-open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  addEventListener('resize', () => { if (innerWidth > 960) setOpen(false); });
  header.querySelectorAll('[data-signout]').forEach((b) => b.addEventListener('click', signOut));
}
async function authState() {
  if (!configured) return;
  const s = await getSession(); if (!s) return;
  const p = await getProfile();
  document.querySelectorAll('[data-auth="out"]').forEach((e) => (e.hidden = true));
  document.querySelectorAll('[data-auth="in"]').forEach((e) => { e.hidden = false; });
  document.querySelectorAll('[data-dash-link]').forEach((a) => { a.href = homeFor(p?.role); });
}
async function initFooter() {
  const site = await getSetting('site'); if (!site) return;
  const c = document.getElementById('footContact'); if (!c) return;
  const rows = [];
  if (site.email) rows.push(`<li>${icon('mail', '', 18)}<a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>`);
  if (site.phone) rows.push(`<li>${icon('phone', '', 18)}<a href="tel:${esc(site.phone.replace(/\s/g, ''))}">${esc(site.phone)}</a></li>`);
  if (site.address) rows.push(`<li>${icon('pin', '', 18)}<span>${esc(site.address)}</span></li>`);
  c.innerHTML = rows.join('');
  const d = document.getElementById('footDesc'); if (d && site.description) d.textContent = site.description;
  const so = document.getElementById('footSocials'); if (so) so.innerHTML = socialLinks(site.socials);
}
async function showCampaigns() {
  if (!configured || document.querySelector('[data-ad-overlay]')) return;
  const { data, error } = await supabase.from('advertisements').select('id,title,description,media_type,media_url,image_url,button_text,target_url').eq('active', true).order('created_at', { ascending: false }).limit(5);
  if (error || !data?.length) return;
  const safeLink = (value) => { try { const u = new URL(value, location.href); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const overlay = document.createElement('div'); overlay.dataset.adOverlay = '1';
  Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '9998', background: 'rgba(9,15,22,.76)', display: 'grid', placeItems: 'center', padding: '18px' });
  overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-label="Current advertisements" style="position:relative;background:var(--paper,#fff);color:var(--ink,#17212b);border-radius:16px;padding:26px;max-width:1120px;width:100%;max-height:90vh;overflow:auto"><button type="button" data-ad-close aria-label="Close advertisements" style="position:sticky;float:right;top:0;border:0;border-radius:50%;width:42px;height:42px;font-size:25px;cursor:pointer;z-index:2">×</button><h2 style="margin:0 52px 18px 0">Updates from Courssins</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px">${data.map((ad) => { const media = ad.media_url || ad.image_url; const href = safeLink(ad.target_url); const visual = media ? (ad.media_type === 'video' ? `<video src="${esc(media)}" controls muted playsinline style="display:block;width:100%;max-height:260px;object-fit:cover"></video>` : `<img src="${esc(media)}" alt="${esc(ad.title)}" style="display:block;width:100%;max-height:260px;object-fit:cover">`) : ''; return `<article style="border:1px solid var(--line,#ddd);border-radius:12px;overflow:hidden">${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">${visual}<div style="padding:14px"><h3>${esc(ad.title)}</h3><p>${esc(ad.description || '')}</p></div></a>` : `${visual}<div style="padding:14px"><h3>${esc(ad.title)}</h3><p>${esc(ad.description || '')}</p></div>`}</article>`; }).join('')}</div></section>`;
  document.body.append(overlay);
  const close = () => overlay.remove(); overlay.querySelector('[data-ad-close]').addEventListener('click', close); overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); }); addEventListener('keydown', function escAd(event) { if (event.key === 'Escape' && overlay.isConnected) { close(); removeEventListener('keydown', escAd); } });
}
export function bindNewsletter(root = document) {
  root.querySelectorAll('form[data-newsletter]').forEach((f) => {
    if (f.dataset.bound) return; f.dataset.bound = '1';
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = f.querySelector('input[type=email]'), msg = f.parentElement.querySelector('.form-msg') || f.querySelector('.form-msg'), btn = f.querySelector('button');
      const email = input.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (msg) { msg.textContent = 'Enter a valid email address.'; msg.className = 'form-msg err'; } input.focus(); return; }
      btn.disabled = true;
      const r = await subscribe(email);
      btn.disabled = false;
      if (r.offline) { msg.textContent = 'Subscriptions switch on once Supabase is connected (see README).'; msg.className = 'form-msg err'; return; }
      if (!r.ok) { msg.textContent = r.message; msg.className = 'form-msg err'; return; }
      if (!r.existing && r.id) {
        const { data, error } = await supabase.functions.invoke('resend-notifications', { body: { type: 'newsletter', source_id: r.id } });
        if (error || data?.error) { msg.textContent = 'You are subscribed, but we could not notify the team. Please use the contact page if you need a reply.'; msg.className = 'form-msg err'; input.value = ''; return; }
      }
      msg.textContent = r.existing ? 'You are already on the list. Thank you!' : 'You are in. Watch your inbox for updates.'; msg.className = 'form-msg ok'; input.value = ''; toast('Subscribed', 'ok');
    });
  });
}
function pageTransitions() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href); if (u.origin !== location.origin || (u.pathname === location.pathname && u.hash) || u.pathname === location.pathname && u.search === location.search) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault(); document.body.classList.add('is-leaving'); setTimeout(() => { location.href = a.href; }, 200);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) document.body.classList.remove('is-leaving'); });
}
async function boot() {
  await Promise.all([inject('site-header', 'components/header.html'), inject('site-footer', 'components/footer.html')]);
  initHeader(); authState(); initFooter(); bindNewsletter(); initFx(); pageTransitions();
  document.querySelectorAll('[data-year]').forEach((e) => (e.textContent = new Date().getFullYear()));
  requestAnimationFrame(() => document.body.classList.add('is-ready'));
  showCampaigns();
  if (!configured) console.info('[courssins] Supabase is not configured yet: showing sample content. Add your keys in assets/js/config.js.');
}
boot();
export { refresh };
