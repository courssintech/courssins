import { getSettings, getCourses, getTutors, getPosts, getTestimonials, getActiveAdvertisement } from './api.js';
import { courseCard, tutorCard, postCard, esc, icon, empty, arr, modal } from './ui.js';
import { refresh } from './fx.js';
import { carousel } from './fx.js';

const $ = (id) => document.getElementById(id);
const S = await getSettings();

const h = S.hero || {};
if (h.label) $('heroLabel').textContent = h.label;
if (h.title) $('heroTitle').textContent = h.title;
if (h.text) $('heroText').textContent = h.text;
if (h.primary_text) $('heroPrimary').firstElementChild.textContent = h.primary_text;
if (h.secondary_text) $('heroSecondary').textContent = h.secondary_text;
const heroImage = document.querySelector('.hero-photo img');
const slides = [...new Set([...(Array.isArray(h.images) ? h.images : []), h.image_url].filter((url) => typeof url === 'string' && url.trim()))];
if (heroImage && slides.length) {
  let slideIndex = 0;
  heroImage.src = slides[0];
  if (slides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(() => {
    slideIndex = (slideIndex + 1) % slides.length;
    heroImage.src = slides[slideIndex];
  }, 6000);
}

const stats = arr(S.stats);
if (stats.length) {
  $('statsGrid').innerHTML = stats.map((s) => `<div class="stat" role="listitem"><div class="stat-num"><span data-count="${Number(s.value) || 0}">0</span><span class="suffix">${esc(s.suffix || '')}</span></div><div class="stat-label">${esc(s.label)}</div></div>`).join('');
  const learners = stats.find((s) => /learner/i.test(s.label));
  if (learners) $('heroProof').textContent = `${learners.value}${learners.suffix || ''} learners reached`;
}
const t = S.talent || {};
if (t.title) $('talentTitle').textContent = t.title;
if (t.text) $('talentText').textContent = t.text;
$('talentCards').innerHTML = arr(t.cards).map((c) => `<div class="feature ${c.highlight ? 'is-highlight' : ''}" data-reveal><div class="f-icon">${icon(c.icon, '', 24)}</div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`).join('');

const w = S.why || {};
if (w.title) $('whyTitle').textContent = w.title;
if (w.text) $('whyText').textContent = w.text;
$('whyGrid').innerHTML = arr(w.cards).map((c) => `<article class="why-card ${c.active ? 'is-active' : ''}" data-reveal tabindex="-1"><div class="w-icon">${icon(c.icon, '', 26)}</div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p><a class="link-arrow" href="${esc(c.href || '#')}">${esc(c.cta || 'Learn more')} ${icon('arrow-right', '', 18)}</a></article>`).join('');
// selected card follows hover/focus: only one lime card at a time
const cards = [...document.querySelectorAll('.why-card')];
cards.forEach((c) => { const on = () => { cards.forEach((x) => x.classList.toggle('is-active', x === c)); }; c.addEventListener('mouseenter', on); c.addEventListener('focusin', on); });
const m = S.membership || {};
if (m.title) $('memberTitle').textContent = m.title;
if (m.text) $('memberText').textContent = m.text;
refresh();

const [courses, tutors, posts, testimonials, advertisement] = await Promise.all([getCourses(), getTutors(), getPosts(3), getTestimonials(), getActiveAdvertisement()]);
const featured = courses.filter((c) => c.featured).slice(0, 6);
$('homeCourses').innerHTML = (featured.length ? featured : courses.slice(0, 6)).map(courseCard).join('') || empty('Courses coming soon', 'New programmes are being added.');
$('homeTutors').innerHTML = tutors.map(tutorCard).join('') || empty('Tutors coming soon', 'Tutor profiles will appear here.');
$('homePosts').innerHTML = posts.map(postCard).join('') || empty('No articles yet', 'Check back soon for new articles.');
const testimonialSection = $('homeTestimonials');
if (testimonials.length) {
  testimonialSection.hidden = false;
  $('testimonialGrid').innerHTML = testimonials.map((item) => `<article class="review" data-reveal>${item.image_url ? `<img src="${esc(item.image_url)}" alt="" width="56" height="56" style="width:56px;height:56px;object-fit:cover;border-radius:50%">` : ''}<blockquote style="margin-top:12px">${esc(item.quote)}</blockquote><p class="muted" style="margin-top:12px;font-size:.9rem"><strong>${esc(item.name)}</strong>${item.programme ? ` · ${esc(item.programme)}` : ''}</p></article>`).join('');
}
if (advertisement) {
  const target = /^https?:\/\//i.test(advertisement.target_url || '') || /^[a-z0-9][a-z0-9\-_/?.=&%]*$/i.test(advertisement.target_url || '') ? advertisement.target_url : '';
  modal({
    title: advertisement.title || 'Advertisement',
    body: `${advertisement.image_url ? `<img src="${esc(advertisement.image_url)}" alt="" style="display:block;width:100%;max-height:360px;object-fit:cover;border-radius:6px;margin-bottom:16px">` : ''}<p>${esc(advertisement.description || '')}</p>`,
    actions: `${target ? `<a class="btn btn-lime" href="${esc(target)}">${esc(advertisement.button_text || 'Learn more')} ${icon('arrow-right', '', 16)}</a>` : ''}<button class="btn btn-ghost" type="button" data-close>Close</button>`,
  });
}
const defaultSections = ['stats', 'talent', 'why', 'courses', 'tutors', 'testimonials', 'blog', 'membership'];
const sectionSettings = new Map((Array.isArray(S.home_sections) ? S.home_sections : []).map((section) => [section.key, section]));
const sectionNodes = [...document.querySelectorAll('[data-home-section]')];
sectionNodes.forEach((node) => {
  const setting = sectionSettings.get(node.dataset.homeSection);
  if (setting) node.hidden = setting.visible === false || (node.dataset.homeSection === 'testimonials' && !testimonials.length);
});
sectionNodes.sort((a, b) => {
  const index = (node) => sectionSettings.get(node.dataset.homeSection)?.order ?? defaultSections.indexOf(node.dataset.homeSection);
  return index(a) - index(b);
});
document.querySelector('.hero')?.after(...sectionNodes);
refresh(); carousel(document.querySelector('[data-carousel]'));
