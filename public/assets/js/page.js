import { getPage } from './api.js';
import { supabase, configured } from './supabase.js';
import * as D from './data.js';
import { esc, qs, setMeta, sanitizeHTML, sanitizeCSS, empty } from './ui.js';
import { CONFIG } from './config.js';

if (document.body.dataset.mode === 'list') {
  let rows = D.pages;
  if (configured) { const { data } = await supabase.from('pages').select('slug,title,meta_description').eq('published', true).order('title'); if (data) rows = data; }
  document.getElementById('pagesList').innerHTML = rows.map((p) => `<a class="feature" href="page.html?slug=${esc(p.slug)}"><h3>${esc(p.title)}</h3><p>${esc(p.meta_description || '')}</p></a>`).join('') || empty('No pages yet', 'Pages created in the admin panel appear here.');
} else {
  const root = document.getElementById('pageRoot'); const slug = qs('slug') || '';
  const p = await getPage(slug);
  if (!p) root.innerHTML = `<section class="section"><div class="container"><div class="empty"><h3>Page not found</h3><a class="btn btn-lime" href="index.html">Go home</a></div></div></section>`;
  else {
    setMeta({ title: p.meta_title || p.title, description: p.meta_description || '', url: `${CONFIG.SITE_URL}/page.html?slug=${p.slug}`, image: p.image_url || undefined });
    // Rendered inside a Shadow DOM so custom CSS cannot restyle the site header/footer, and sanitised HTML cannot run code.
    root.innerHTML = `<section class="page-hero"><div class="container"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span>${esc(p.title)}</span></nav><h1>${esc(p.title)}</h1></div></section><div class="container section-tight"><div id="pageBody"></div></div>`;
    const shadow = document.getElementById('pageBody').attachShadow({ mode: 'open' });
    shadow.innerHTML = `<link rel="stylesheet" href="assets/css/style.css"><style>:host{display:block;font-family:var(--font,system-ui)}.prose{max-width:none}${sanitizeCSS(p.css)}</style>${p.image_url ? `<img src="${esc(p.image_url)}" alt="" style="border-radius:28px;max-height:420px;width:100%;object-fit:cover;margin-bottom:32px">` : ''}<div class="prose" style="max-width:none">${sanitizeHTML(p.html)}</div>`;
  }
}
