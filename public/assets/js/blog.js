import { getPosts, getPost } from './api.js';
import { postCard, esc, fmtDate, qs, img, setMeta, sanitizeHTML, empty } from './ui.js';
import { CONFIG } from './config.js';
import { refresh } from './fx.js';

const grid = document.getElementById('blogGrid'), root = document.getElementById('articleRoot');
if (grid) {
  const posts = await getPosts(); const cats = ['All', ...new Set(posts.map((p) => p.category).filter(Boolean))]; let cat = 'All';
  const f = document.getElementById('blogFilters');
  f.innerHTML = cats.map((c) => `<button class="pill" type="button" data-c="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}</button>`).join('');
  const render = () => { grid.innerHTML = posts.filter((p) => cat === 'All' || p.category === cat).map(postCard).join('') || empty('No articles yet', 'Check back soon.'); refresh(grid); };
  f.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; f.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-pressed', p === b)); render(); }); render();
}
if (root) {
  const p = await getPost(qs('id') || '');
  if (!p) root.innerHTML = `<div class="empty"><h3>Article not found</h3><a class="btn btn-lime" href="blog.html">Back to blog</a></div>`;
  else {
    const url = `${CONFIG.SITE_URL}/article.html?id=${p.slug}`;
    setMeta({ title: p.title, description: p.excerpt, image: `${CONFIG.SITE_URL}/${p.image_url}`, url, type: 'article', jsonld: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, datePublished: p.published_at, author: { '@type': 'Person', name: p.author || 'Courssins Editorial' }, publisher: { '@type': 'Organization', name: 'Courssins Technology Institute' }, image: `${CONFIG.SITE_URL}/${p.image_url}` } });
    const more = (await getPosts(4)).filter((x) => x.slug !== p.slug).slice(0, 3);
    root.innerHTML = `<article class="article"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="blog.html">Blog</a></nav>
      <span class="chip" style="margin-top:22px">${esc(p.category)}</span><h1 style="font-size:clamp(2.1rem,5vw,3.4rem);margin:14px 0 14px">${esc(p.title)}</h1>
      <p class="muted" style="margin-bottom:32px">${esc(p.author || '')} · <time datetime="${esc(p.published_at)}">${fmtDate(p.published_at)}</time></p>
      <div class="article-cover">${img(p.image_url, p.title, { w: 800, h: 450, lazy: false })}</div><div class="prose">${sanitizeHTML(p.content)}</div></article>
      ${more.length ? `<section class="block"><h2>Keep reading</h2><div class="grid grid-3">${more.map(postCard).join('')}</div></section>` : ''}`;
    refresh(root);
  }
}
