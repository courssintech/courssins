import { getCourse, getReviews } from './api.js';
import { supabase, configured, getSession, getProfile } from './supabase.js';
import { CONFIG } from './config.js';
import { esc, money, icon, arr, qs, img, setMeta, socialLinks, modal, toast, setBusy, fmtDate } from './ui.js';
import { refresh } from './fx.js';

const root = document.getElementById('courseRoot');
const c = await getCourse(qs('id') || '');
if (!c) { root.innerHTML = `<div class="empty"><h3>Course not found</h3><p>This course may have been renamed or unpublished.</p><a class="btn btn-lime" href="courses.html">Browse courses</a></div>`; }
else {
  const reviews = await getReviews(c.id);
  const url = `${CONFIG.SITE_URL}/course.html?id=${c.slug}`;
  setMeta({ title: `${c.title} Course in Nigeria`, description: c.short_description, image: `${CONFIG.SITE_URL}/${c.image_url}`, url, jsonld: { '@context': 'https://schema.org', '@type': 'Course', name: c.title, description: c.short_description, provider: { '@type': 'Organization', name: 'Courssins Technology Institute', sameAs: CONFIG.SITE_URL }, offers: { '@type': 'Offer', price: c.price, priceCurrency: c.currency, category: 'Paid' } } });
  const t = c.tutor;
  const mods = arr(c.modules);
  const avg = reviews.length ? (reviews.reduce((n, r) => n + r.rating, 0) / reviews.length).toFixed(1) : null;
  const stars = (n) => `<span class="stars" aria-label="${n} out of 5">${Array.from({ length: 5 }, (_, i) => icon('star', '', 16).replace('fill="none"', i < n ? 'fill="currentColor"' : 'fill="none"')).join('')}</span>`;
  root.innerHTML = `
  <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="courses.html">Courses</a><span>/</span><span>${esc(c.title)}</span></nav>
  <div class="detail-grid" style="margin-top:24px"><div>
    <span class="chip">${esc(c.category)}</span><h1 style="font-size:clamp(2.2rem,5vw,3.6rem);margin:14px 0 16px">${esc(c.title)}</h1>
    <p class="lead">${esc(c.short_description)}</p>
    <div class="cover" style="margin-top:28px">${img(c.image_url, `${c.title} course cover`, { lazy: false })}</div>
    <section class="block"><h2>About this course</h2><p class="lead" style="max-width:none">${esc(c.description)}</p></section>
    <section class="block"><h2>What you will learn</h2><ul class="ticks">${arr(c.outcomes).map((o) => `<li><span class="tick">${icon('check', '', 14)}</span><span>${esc(o)}</span></li>`).join('')}</ul></section>
    <section class="block"><h2>Course modules</h2><div class="grid grid-2">${mods.map((m) => `<div class="feature"><div class="f-icon" style="font-weight:800">${m.position}</div><h3>${esc(m.title)}</h3><p>${esc(m.summary)}</p></div>`).join('')}</div></section>
    <section class="block"><h2>Curriculum</h2>${mods.map((m, i) => `<details class="acc" ${i === 0 ? 'open' : ''}><summary>Module ${m.position}: ${esc(m.title)}</summary><div class="acc-body"><ul>${arr(m.topics).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></details>`).join('')}</section>
    <section class="block"><h2>Requirements</h2><ul class="ticks">${arr(c.requirements).map((o) => `<li><span class="tick">${icon('check', '', 14)}</span><span>${esc(o)}</span></li>`).join('')}</ul></section>
    <section class="block grid grid-2"><div class="feature"><div class="f-icon">${icon('file', '', 24)}</div><h3>Assignments and assessment</h3><p>${esc(c.assessment_info)}</p></div><div class="feature is-highlight"><div class="f-icon">${icon('award', '', 24)}</div><h3>Certificate</h3><p>${esc(c.certificate_info)}</p></div></section>
    <section class="block"><h2>Frequently asked questions</h2>${arr(c.faqs).map((f) => `<details class="acc"><summary>${esc(f.q)}</summary><div class="acc-body">${esc(f.a)}</div></details>`).join('')}</section>
    <section class="block" id="reviews"><h2>Student reviews ${avg ? `<span class="muted" style="font-size:1rem;font-weight:600">${avg} average from ${reviews.length}</span>` : ''}</h2>
      ${reviews.length ? reviews.map((r) => `<div class="review">${stars(r.rating)}<p style="margin-top:8px">${esc(r.comment)}</p><p class="muted" style="margin-top:8px;font-size:.9rem">${esc(r.name)} · ${fmtDate(r.created_at)}</p></div>`).join('') : '<div class="empty" style="padding:32px"><p>Reviews from graduates will appear here after the first cohort completes.</p></div>'}
      <div id="reviewBox"></div></section>
  </div>
  <aside class="aside-card"><strong class="price">${money(c.price, c.currency)}</strong>
    <button class="btn btn-lime btn-lg btn-block" id="enrollBtn" type="button">Enrol now</button>
    <ul class="facts"><li>${icon('clock')}<span>${esc(c.duration)}</span></li><li>${icon('laptop')}<span>Online, on any device</span></li><li>${icon('book')}<span>${mods.length} modules</span></li><li>${icon('award')}<span>Verified certificate</span></li></ul>
    ${t ? `<a class="tutor-mini" href="tutor.html?id=${esc(t.slug)}">${img(t.image_url, t.full_name, { w: 56, h: 56 })}<div><strong>${esc(t.full_name)}</strong><br><span class="muted" style="font-size:.9rem">${esc(t.specialization || 'Tutor')}</span></div></a>` : ''}
  </aside></div>`;
  refresh(root);

  const btn = document.getElementById('enrollBtn');
  async function enrol() {
    if (!configured) return modal({ title: 'Enrolment is not live yet', body: '<p>This site is still running on sample content. Connect Supabase (see README) to switch on accounts and enrolment.</p>', actions: '<a class="btn btn-dark" href="contact.html">Contact us</a>' });
    if (!(await getSession())) { location.href = `login.html?next=${encodeURIComponent(`course.html?id=${c.slug}&enroll=1`)}`; return; }
    setBusy(btn, true, 'Starting enrolment');
    const { data, error } = await supabase.rpc('start_enrollment', { p_course: c.id });
    setBusy(btn, false);
    if (error) return toast(error.message, 'err');
    if (data.status === 'active') { toast('You are enrolled', 'ok'); return void setTimeout(() => (location.href = 'dashboard.html#courses'), 700); }
    const paymentBox = (msg) => modal({ title: 'Complete your payment', body: `<p>${msg}</p><ul class="facts"><li><strong>Course</strong><span>${esc(c.title)}</span></li><li><strong>Amount</strong><span>${money(data.amount, data.currency)}</span></li><li><strong>Payment reference</strong><span style="user-select:all">${esc(data.reference)}</span></li></ul><p class="hint" style="margin-top:14px">Your course unlocks only after the payment is verified. You can track it under Payment history in your dashboard.</p>`, actions: '<a class="btn btn-dark" href="dashboard.html#payments">Go to dashboard</a>' });
    if (!CONFIG.PAYMENT_INIT_URL) return paymentBox('Your enrolment is saved as pending. Online card payment is not switched on yet, so please contact us with the reference below to pay by another method.');
    setBusy(btn, true, 'Opening payment');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const r = await fetch(CONFIG.PAYMENT_INIT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.session.access_token}` }, body: JSON.stringify({ reference: data.reference, callback_url: `${location.origin}/dashboard.html#payments` }) });
      const j = await r.json();
      if (!r.ok || !j.authorization_url) throw new Error(j.error || 'Payment could not be started');
      location.href = j.authorization_url;
    } catch (e) { setBusy(btn, false); paymentBox(`We could not open the payment page (${e.message}). Your enrolment is pending; try again from your dashboard or contact us.`); }
  }
  btn.addEventListener('click', enrol);
  if (qs('enroll') === '1') enrol();

  // review form for active students only
  if (configured && await getSession()) {
    const { data: en } = await supabase.from('enrollments').select('id').eq('course_id', c.id).eq('status', 'active').maybeSingle();
    if (en) {
      const box = document.getElementById('reviewBox');
      box.innerHTML = `<form class="panel" id="revForm" style="margin-top:20px"><h3 style="margin-bottom:12px">Leave a review</h3><div class="row-2"><div class="field"><label for="rvRate">Rating</label><select class="input" id="rvRate"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></div></div><div class="field"><label for="rvText">Your review</label><textarea class="input" id="rvText" maxlength="1500" required></textarea></div><button class="btn btn-dark" type="submit">Submit review</button><p class="hint" style="margin-top:10px">Reviews are published after approval.</p></form>`;
      document.getElementById('revForm').addEventListener('submit', async (e) => {
        e.preventDefault(); const p = await getProfile();
        const { error } = await supabase.from('course_reviews').insert({ course_id: c.id, user_id: p.id, name: p.full_name || 'Student', rating: Number(document.getElementById('rvRate').value), comment: document.getElementById('rvText').value.trim() });
        if (error) return toast(error.code === '23505' ? 'You have already reviewed this course.' : 'Could not submit review.', 'err');
        toast('Thank you. Your review will appear after approval.', 'ok'); box.innerHTML = '';
      });
    }
  }
}
