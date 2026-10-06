import { getCourses } from './api.js';
import { courseCard, empty, esc } from './ui.js';
import { refresh } from './fx.js';

const grid = document.getElementById('courseGrid'), filters = document.getElementById('courseFilters');
const courses = await getCourses();
let cat = 'All';
const cats = ['All', ...new Set(courses.map((c) => c.category).filter(Boolean))];
filters.innerHTML = cats.map((c) => `<button class="pill" type="button" aria-pressed="${c === cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join('') +
  `<div class="search"><svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg><input class="input" id="courseSearch" type="search" placeholder="Search courses" aria-label="Search courses"></div>`;
const search = document.getElementById('courseSearch');
function render() {
  const q = search.value.trim().toLowerCase();
  const list = courses.filter((c) => (cat === 'All' || c.category === cat) && (!q || `${c.title} ${c.short_description} ${c.category}`.toLowerCase().includes(q)));
  grid.innerHTML = list.map(courseCard).join('') || empty('No courses match', 'Try a different category or search term.');
  refresh(grid);
}
filters.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; filters.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-pressed', p === b)); render(); });
search.addEventListener('input', render);
render();

// Course finder: transparent keyword matching against course titles, categories and topics (no external AI service).
const KEYWORDS = { website: 'development', web: 'development', code: 'development', coding: 'development', program: 'development', app: 'development', developer: 'development', design: 'design', logo: 'design', brand: 'design', creative: 'design', ui: 'ux', ux: 'ux', product: 'ux',
  data: 'data', analyst: 'data', excel: 'data', sql: 'data', security: 'security', hack: 'security', cyber: 'security', safe: 'security', remote: 'business', assistant: 'business', manage: 'business', project: 'business', business: 'business', freelance: 'business',
  mental: 'wellbeing', wellness: 'wellbeing', child: 'wellbeing', parent: 'wellbeing', teacher: 'wellbeing', care: 'wellbeing', ai: 'development' };
document.getElementById('finderForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const words = document.getElementById('finderInput').value.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const wanted = new Set(words.map((w) => KEYWORDS[w]).filter(Boolean));
  const scored = courses.map((c) => ({ c, s: words.reduce((n, w) => n + (`${c.title} ${c.short_description}`.toLowerCase().includes(w) ? 2 : 0), 0) + (wanted.has((c.category || '').toLowerCase()) ? 3 : 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4);
  const out = document.getElementById('finderOut');
  out.innerHTML = scored.length ? scored.map(({ c }) => `<a href="course.html?id=${esc(c.slug)}">${esc(c.title)}</a>`).join('') : '<span style="color:#a9aea0">No match yet. Try words like website, design, data, security or remote work, or browse all courses below.</span>';
});
