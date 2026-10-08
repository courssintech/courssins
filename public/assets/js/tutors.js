import { getTutors, getTutor, getCourses } from './api.js';
import { tutorCard, courseCard, esc, arr, qs, img, setMeta, socialLinks, empty, icon } from './ui.js';
import { CONFIG } from './config.js';
import { refresh } from './fx.js';

const grid = document.getElementById('tutorGrid'), root = document.getElementById('tutorRoot');
if (grid) { grid.innerHTML = (await getTutors()).map(tutorCard).join('') || empty('Tutors coming soon', 'Tutor profiles will appear here.'); refresh(grid); }
if (root) {
  const t = await getTutor(qs('id') || '');
  if (!t) root.innerHTML = `<div class="empty"><h3>Tutor not found</h3><a class="btn btn-lime" href="tutors.html">See all tutors</a></div>`;
  else {
    const taught = (await getCourses()).filter((c) => c.tutors?.some((courseTutor) => courseTutor.slug === t.slug) || c.tutor?.slug === t.slug);
    setMeta({ title: `${t.full_name}, ${t.specialization}`, description: (t.bio || '').slice(0, 155), image: `${CONFIG.SITE_URL}/${t.image_url}`, url: `${CONFIG.SITE_URL}/tutor.html?id=${t.slug}`, type: 'profile' });
    root.innerHTML = `<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="tutors.html">Tutors</a><span>/</span><span>${esc(t.full_name)}</span></nav>
    <div class="profile-grid" style="margin-top:28px"><div class="profile-photo">${img(t.image_url, `Portrait of ${t.full_name}`, { w: 480, h: 560, lazy: false })}</div>
    <div><span class="chip">${esc(t.specialization)}</span><h1 style="font-size:clamp(2.2rem,5vw,3.6rem);margin:14px 0 6px">${esc(t.full_name)}</h1><p class="lead" style="color:var(--ink);font-weight:600">${esc(t.title)}</p>
    <div style="margin-top:18px">${socialLinks(t.socials)}</div>
    <section class="block"><h2>Biography</h2><p class="lead" style="max-width:none">${esc(t.bio)}</p></section>
    <section class="block"><h2>Experience</h2><p class="lead" style="max-width:none">${esc(t.experience)}</p></section>
    <section class="block"><h2>Qualifications</h2><ul class="ticks">${arr(t.qualifications).map((q) => `<li><span class="tick">${icon('check', '', 14)}</span><span>${esc(q)}</span></li>`).join('')}</ul></section>
    <section class="block"><h2>Areas of expertise</h2><ul class="tags">${arr(t.expertise).map((q) => `<li>${esc(q)}</li>`).join('')}</ul></section>
    <div class="btn-row" style="margin-top:36px"><a class="btn btn-lime btn-lg" href="contact.html?subject=${encodeURIComponent('Consultation with ' + t.full_name)}">Book a consultation</a>${t.email ? `<a class="btn btn-outline btn-lg" href="mailto:${esc(t.email)}">Email ${esc(t.full_name.split(' ')[0])}</a>` : ''}</div></div></div>
    ${taught.length ? `<section class="block"><h2>Courses taught</h2><div class="grid grid-3">${taught.map(courseCard).join('')}</div></section>` : ''}`;
    refresh(root);
  }
}
