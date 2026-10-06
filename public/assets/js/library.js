import { getLibrary } from './api.js';
import { esc, icon, empty } from './ui.js';
import { getSession, configured } from './supabase.js';
import { refresh } from './fx.js';

const grid = document.getElementById('libGrid'), filters = document.getElementById('libFilters');
const items = await getLibrary(); const loggedIn = configured ? !!(await getSession()) : true;
const ICON = { book: 'book', pdf: 'file', material: 'stack', video: 'video', document: 'file' };
const types = ['All', ...new Set(items.map((i) => i.type))]; let type = 'All';
filters.innerHTML = types.map((t) => `<button class="pill" type="button" data-t="${esc(t)}" aria-pressed="${t === type}" style="text-transform:capitalize">${esc(t)}</button>`).join('') + `<div class="search">${icon('search', '', 18)}<input class="input" id="libSearch" type="search" placeholder="Search resources" aria-label="Search resources"></div>`;
const search = document.getElementById('libSearch');
function render() {
  const q = search.value.trim().toLowerCase();
  const list = items.filter((i) => (type === 'All' || i.type === type) && (!q || `${i.title} ${i.description}`.toLowerCase().includes(q)));
  grid.innerHTML = list.map((i) => {
    const locked = i.access === 'members' && !loggedIn;
    return `<article class="card" data-reveal><div class="card-body" style="padding:22px 14px 14px"><span class="f-icon" style="width:52px;height:52px;border-radius:16px;background:var(--lime);display:grid;place-items:center">${icon(ICON[i.type] || 'file', '', 24)}</span>
      <span class="chip" style="text-transform:capitalize">${esc(i.type)}${i.access === 'members' ? ' · members' : ''}</span><h3 class="card-title">${esc(i.title)}</h3><p class="card-text">${esc(i.description)}</p>
      <div class="card-foot">${locked ? '<a class="btn btn-dark btn-sm" href="login.html?next=library.html">Log in to open</a>' : `<a class="btn btn-dark btn-sm" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">Open resource ${icon('external', '', 16)}</a>`}</div></div></article>`;
  }).join('') || empty('No resources found', 'Try another type or search term.');
  refresh(grid);
}
filters.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; type = b.dataset.t; filters.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-pressed', p === b)); render(); });
search.addEventListener('input', render); render();
