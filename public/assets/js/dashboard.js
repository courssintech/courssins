import { supabase, configured, requireAuth, signOut, getProfile } from './supabase.js';
import { getSetting } from './api.js';
import { esc, money, fmtDate, icon, modal, toast, setBusy, empty, arr } from './ui.js';
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const TABS = [['overview', 'Overview', 'home'], ['courses', 'My courses', 'book'], ['lessons', 'Lessons', 'play'], ['assignments', 'Assignments', 'file'], ['exams', 'Examinations', 'quiz'], ['results', 'Results', 'chart'], ['certificates', 'Certificates', 'award'], ['library', 'Library', 'stack'], ['events', 'Events', 'calendar'], ['payments', 'Payment history', 'card'], ['notifications', 'Notifications', 'bell'], ['settings', 'Account settings', 'settings']];
$('sideNav').innerHTML = TABS.map(([k, l, i]) => `<button class="side-link" type="button" data-tab="${k}">${icon(i, '', 18)}<span>${l}</span><span class="badge" data-badge="${k}" hidden style="margin-left:auto"></span></button>`).join('');
$('signOutBtn').addEventListener('click', signOut);
const side = $('sidebar'), scrim = $('scrim');
const toggleSide = (o) => { side.classList.toggle('open', o); scrim.classList.toggle('open', o); };
$('menuBtn').addEventListener('click', () => toggleSide(true)); scrim.addEventListener('click', () => toggleSide(false));

const bar = (p) => `<div class="bar lime"><i style="width:${p}%"></i></div>`;
const busyPanel = () => { $('panel').innerHTML = '<div class="card skeleton" style="min-height:280px"></div>'; };

if (!configured) {
  $('panel').innerHTML = `<div class="panel"><h2>Connect Supabase to use the dashboard</h2><p class="muted">Add your project URL and anon key in <code>assets/js/config.js</code>, then reload. See the README for the 5-minute setup.</p><a class="btn btn-lime" style="margin-top:16px" href="index.html">Back to website</a></div>`;
} else {
  const me = await requireAuth();
  $('whoami').textContent = me.full_name || me.email;
  const cfg = (await getSetting('certificate')) || {};
  const S = { enrolls: null, prog: {}, lessons: {}, done: null };
  const loadEnrolls = async () => {
    if (S.enrolls) return S.enrolls;
    const { data } = await supabase.from('enrollments').select('*, course:courses(id,slug,title,image_url,duration,price,currency)').eq('user_id', me.id).order('enrolled_at', { ascending: false });
    S.enrolls = data || [];
    await Promise.all(S.enrolls.filter((e) => e.status === 'active').map(async (e) => { const { data: p } = await supabase.rpc('course_progress_summary', { p_course: e.course_id }); S.prog[e.course_id] = p; }));
    return S.enrolls;
  };
  const active = async () => (await loadEnrolls()).filter((e) => e.status === 'active');
  const refreshAll = () => { S.enrolls = null; S.done = null; };
  const ring = (p) => `<div class="ring-progress" style="--p:${p}"><b>${p}%</b></div>`;
  const cpStats = (p) => p ? `<div class="cp-stats"><span>Lessons ${p.lessons_done}/${p.lessons_total}</span><span>Assignments ${p.assignments_done}/${p.assignments_total}</span><span>Exams passed ${p.exams_passed}/${p.exams_total}</span><span>${p.eligible ? '<strong style="color:var(--ok)">Eligible for certificate</strong>' : 'Not yet eligible for certificate'}</span></div>` : '';
  const needCourse = (t) => empty('No active courses yet', t || 'Enrol in a course and complete payment to unlock this section.', '<a class="btn btn-lime" href="courses.html">Browse courses</a>');
  const lessonVideo = (value, title) => {
    if (!/^https?:\/\//i.test(value || '')) return '';
    try {
      const url = new URL(value);
      if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) return `<video controls preload="metadata" style="display:block;width:100%;max-height:480px;border-radius:8px;margin:16px 0"><source src="${esc(url.href)}"></video>`;
      const youtubeId = url.hostname.endsWith('youtu.be') ? url.pathname.slice(1) : ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) ? url.searchParams.get('v') : null;
      if (youtubeId && /^[A-Za-z0-9_-]{11}$/.test(youtubeId)) return `<div style="aspect-ratio:16/9;margin:16px 0"><iframe src="https://www.youtube-nocookie.com/embed/${youtubeId}" title="${esc(title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" style="width:100%;height:100%;border:0;border-radius:8px"></iframe></div>`;
      const vimeoId = url.hostname === 'vimeo.com' || url.hostname === 'www.vimeo.com' ? url.pathname.split('/').filter(Boolean)[0] : url.hostname === 'player.vimeo.com' ? url.pathname.split('/').filter(Boolean)[1] : null;
      if (vimeoId && /^\d+$/.test(vimeoId)) return `<div style="aspect-ratio:16/9;margin:16px 0"><iframe src="https://player.vimeo.com/video/${vimeoId}" title="${esc(title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" style="width:100%;height:100%;border:0;border-radius:8px"></iframe></div>`;
      return `<p style="margin:14px 0"><a class="btn btn-outline btn-sm" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${icon('video', '', 16)} Watch video</a></p>`;
    } catch { return ''; }
  };

  const V = {
    async overview() {
      const en = await loadEnrolls(); const act = en.filter((e) => e.status === 'active');
      const { count: certs } = await supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('user_id', me.id);
      const { count: unread } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('read', false);
      const avg = act.length ? Math.round(act.reduce((n, e) => n + (S.prog[e.course_id]?.percent || 0), 0) / act.length) : 0;
      return `<div class="kpis"><div class="kpi lime"><b>${act.length}</b><span>Active courses</span></div><div class="kpi"><b>${avg}%</b><span>Average progress</span></div><div class="kpi"><b>${certs || 0}</b><span>Certificates</span></div><div class="kpi"><b>${unread || 0}</b><span>Unread notifications</span></div></div>
      <div class="panel"><h2>Continue learning</h2>${act.length ? act.map((e) => `<div class="course-progress">${ring(S.prog[e.course_id]?.percent || 0)}<div><h3>${esc(e.course.title)}</h3>${bar(S.prog[e.course_id]?.percent || 0)}${cpStats(S.prog[e.course_id])}<button class="btn btn-dark btn-sm" style="margin-top:12px" data-go="lessons" data-course="${e.course_id}">Open lessons</button></div></div>`).join('') : needCourse()}</div>
      <div class="panel"><h2>Your profile</h2><ul class="facts" style="margin:0"><li>${icon('user')}<span>${esc(me.full_name || 'Add your name in settings')}</span></li><li>${icon('mail')}<span>${esc(me.email)}</span></li><li>${icon('phone')}<span>${esc(me.phone || 'No phone number')}</span></li><li>${icon('globe')}<span>${esc(me.country || 'No country set')}</span></li></ul></div>`;
    },
    async courses() {
      const en = await loadEnrolls(); if (!en.length) return needCourse('You have not enrolled in a course yet.');
      return `<div class="list">${en.map((e) => `<div class="list-item"><div class="grow"><h3>${esc(e.course.title)}</h3><p class="muted" style="font-size:.9rem">${esc(e.course.duration)} · enrolled ${fmtDate(e.enrolled_at)}</p>${e.status === 'active' ? `${bar(S.prog[e.course_id]?.percent || 0)}${cpStats(S.prog[e.course_id])}` : ''}</div>
      <span class="badge ${e.status === 'active' ? 'ok' : 'warn'}">${e.status === 'active' ? 'Unlocked' : e.status === 'pending' ? 'Awaiting payment' : 'Cancelled'}</span>
      ${e.status === 'active' ? `<button class="btn btn-dark btn-sm" data-go="lessons" data-course="${e.course_id}">Open</button>` : e.status === 'pending' ? `<a class="btn btn-lime btn-sm" href="course.html?id=${esc(e.course.slug)}&enroll=1">Complete payment</a>` : ''}</div>`).join('')}</div>`;
    },
    async lessons(courseId) {
      const act = await active(); if (!act.length) return needCourse();
      courseId = courseId || S.lessonCourse || act[0].course_id; S.lessonCourse = courseId;
      const [{ data: ls }, { data: pr }, { data: mods }, { data: resources }] = await Promise.all([supabase.from('lessons').select('*').eq('course_id', courseId).order('position'), supabase.from('course_progress').select('lesson_id').eq('course_id', courseId).eq('user_id', me.id), supabase.from('course_modules').select('id,title,position').eq('course_id', courseId).order('position'), supabase.from('course_resources').select('*').eq('course_id', courseId).eq('published', true).order('created_at')]);
      const resourceLinks = await Promise.all((resources || []).map(async (resource) => {
        if (resource.object_path) {
          const { data } = await supabase.storage.from('course-materials').createSignedUrl(resource.object_path, 3600);
          return { ...resource, href: data?.signedUrl || '' };
        }
        return { ...resource, href: /^https?:\/\//i.test(resource.external_url || '') ? resource.external_url : '' };
      }));
      const done = new Set((pr || []).map((r) => r.lesson_id)); S.lessonList = ls || []; S.doneSet = done;
      const group = (mods || []).map((m) => `<h3 style="margin:22px 0 10px">Module ${m.position}: ${esc(m.title)}</h3>` + (ls || []).filter((l) => l.module_id === m.id).map((l) => `<div class="lesson ${done.has(l.id) ? 'done' : ''}" tabindex="0" role="button" data-lesson="${l.id}"><span class="dot">${done.has(l.id) ? icon('check', '', 14) : ''}</span><div style="flex:1"><strong>${esc(l.title)}</strong>${l.duration_min ? `<div class="muted" style="font-size:.85rem">${l.duration_min} min</div>` : ''}</div>${icon('arrow-right', '', 18)}</div>`).join('')).join('');
      const resourceList = resourceLinks.length ? `<section class="block"><h3>Course resources</h3><div class="list">${resourceLinks.map((resource) => `<div class="list-item"><div class="grow"><h4>${esc(resource.title)}</h4><p class="muted">${esc(resource.description || resource.resource_type)}</p></div>${resource.href ? `<a class="btn btn-dark btn-sm" href="${esc(resource.href)}" target="_blank" rel="noopener noreferrer">Open ${icon('external', '', 16)}</a>` : '<span class="muted">File unavailable</span>'}</div>`).join('')}</div></section>` : '';
      return `<div class="tools"><label for="lsCourse" class="label">Course</label><select class="input" id="lsCourse" style="max-width:420px">${act.map((e) => `<option value="${e.course_id}" ${e.course_id === courseId ? 'selected' : ''}>${esc(e.course.title)}</option>`).join('')}</select></div><div class="panel">${bar(S.prog[courseId]?.percent || 0)}${group || empty('No lessons yet', 'Your tutor has not published lessons for this course.')}${resourceList}</div>`;
    },
    async assignments() {
      const act = await active(); if (!act.length) return needCourse();
      const ids = act.map((e) => e.course_id);
      const [{ data: as }, { data: subs }] = await Promise.all([supabase.from('assignments').select('*').in('course_id', ids).order('position'), supabase.from('assignment_submissions').select('*').eq('user_id', me.id)]);
      S.assign = as || []; S.subs = Object.fromEntries((subs || []).map((s) => [s.assignment_id, s]));
      if (!S.assign.length) return empty('No assignments yet', 'Assignments appear here when your tutor publishes them.');
      return `<div class="list">${S.assign.map((a) => { const s = S.subs[a.id]; return `<div class="list-item"><div class="grow"><h3>${esc(a.title)}</h3><p class="muted" style="font-size:.9rem">${esc(act.find((e) => e.course_id === a.course_id)?.course.title)} · max ${a.max_score} points</p>${s?.status === 'graded' ? `<p style="margin-top:6px"><strong>Score ${s.score}/${a.max_score}</strong>${s.feedback ? ` · ${esc(s.feedback)}` : ''}</p>` : ''}</div><span class="badge ${s ? (s.status === 'graded' ? 'ok' : 'warn') : ''}">${s ? (s.status === 'graded' ? 'Graded' : 'Submitted') : 'Not submitted'}</span><button class="btn btn-dark btn-sm" data-assign="${a.id}">${s ? (s.status === 'graded' ? 'View' : 'Edit submission') : 'Submit'}</button></div>`; }).join('')}</div>`;
    },
    async exams() {
      const act = await active(); if (!act.length) return needCourse();
      const ids = act.map((e) => e.course_id);
      const [{ data: ex }, { data: rs }] = await Promise.all([supabase.from('exams').select('*, module:course_modules(title,position)').in('course_id', ids).eq('published', true).order('is_final').order('module_id'), supabase.from('exam_results').select('*').eq('user_id', me.id).order('taken_at', { ascending: false })]);
      S.exams = ex || [];
      if (!S.exams.length) return empty('No examinations yet', 'Examinations appear here when they are published for your course.');
      return `<div class="list">${S.exams.map((x) => { const r = (rs || []).filter((y) => y.exam_id === x.id); const best = r.length ? Math.max(...r.map((y) => Number(y.score))) : null; const passed = r.some((y) => y.passed);
        const kind = x.is_final ? 'Final assessment' : x.module?.title ? `Module ${x.module.position}: ${x.module.title}` : 'Course assessment';
        return `<div class="list-item"><div class="grow"><h3>${esc(x.title)}</h3><p class="muted" style="font-size:.9rem">${esc(kind)} · ${x.duration_min} min · pass mark ${x.pass_mark}%${best !== null ? ` · best score ${best}%` : ''}</p></div><span class="badge ${passed ? 'ok' : r.length ? 'warn' : ''}">${passed ? 'Passed' : r.length ? 'Not passed yet' : 'Not taken'}</span><button class="btn btn-dark btn-sm" data-exam="${x.id}">${r.length ? 'Retake' : 'Start assessment'}</button></div>`; }).join('')}</div>`;
    },
    async results() {
      const [{ data: rs }, { data: subs }] = await Promise.all([supabase.from('exam_results').select('*, exam:exams(title)').eq('user_id', me.id).order('taken_at', { ascending: false }), supabase.from('assignment_submissions').select('*, a:assignments(title,max_score)').eq('user_id', me.id).eq('status', 'graded')]);
      const rows = [...(rs || []).map((r) => [r.exam?.title, 'Examination', `${r.score}%`, r.passed ? 'Passed' : 'Not passed', r.taken_at]), ...(subs || []).map((s) => [s.a?.title, 'Assignment', `${s.score}/${s.a?.max_score}`, 'Graded', s.graded_at || s.submitted_at])];
      return rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Item</th><th>Type</th><th>Score</th><th>Outcome</th><th>Date</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${esc(r[2])}</td><td>${r[3]}</td><td>${fmtDate(r[4])}</td></tr>`).join('')}</tbody></table></div>` : empty('No results yet', 'Your exam scores and graded assignments will be listed here.');
    },
    async certificates() {
      await loadEnrolls();
      const { data: certs } = await supabase.from('certificates').select('*').eq('user_id', me.id); S.certs = certs || [];
      const eligible = S.enrolls.filter((e) => e.status === 'active' && S.prog[e.course_id]?.eligible && !S.certs.find((c) => c.course_id === e.course_id));
      return `${eligible.map((e) => `<div class="alert ok" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">You completed ${esc(e.course.title)}.<button class="btn btn-dark btn-sm" data-claim="${e.course_id}">Get certificate</button></div>`).join('')}
      ${S.certs.length ? `<div class="list">${S.certs.map((c) => `<div class="list-item"><div class="grow"><h3>${esc(c.course_title)}</h3><p class="muted" style="font-size:.9rem">No. ${esc(c.certificate_number)} · completed ${fmtDate(c.completed_at)}</p></div><span class="badge ${c.status === 'valid' ? 'ok' : 'err'}">${c.status}</span><button class="btn btn-dark btn-sm" data-cert="${c.id}">View</button></div>`).join('')}</div>` : eligible.length ? '' : empty('No certificates yet', 'Complete every lesson, assignment and examination in a course to earn its certificate.')}`;
    },
    async library() {
      const { data } = await supabase.from('library').select('*').eq('published', true).order('created_at', { ascending: false });
      return data?.length ? `<div class="list">${data.map((l) => `<div class="list-item"><div class="grow"><h3>${esc(l.title)}</h3><p class="muted" style="font-size:.9rem">${esc(l.description)}</p></div><span class="chip" style="text-transform:capitalize">${esc(l.type)}</span><a class="btn btn-dark btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Open ${icon('external', '', 16)}</a></div>`).join('')}</div>` : empty('Library is empty', 'Resources will appear here.');
    },
    async events() {
      const { data } = await supabase.from('events').select('*').eq('published', true).order('starts_at');
      return data?.length ? `<div class="list">${data.map((e) => `<div class="list-item"><div class="grow"><h3>${esc(e.title)}</h3><p class="muted" style="font-size:.9rem">${fmtDate(e.starts_at, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}${e.location ? ` · ${esc(e.location)}` : ''}</p><p>${esc(e.description)}</p></div>${e.url ? `<a class="btn btn-outline btn-sm" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Details</a>` : ''}</div>`).join('')}</div>` : empty('No upcoming events', 'Workshops and open days will be listed here.');
    },
    async payments() {
      const { data } = await supabase.from('payments').select('*, course:courses(title)').eq('user_id', me.id).order('created_at', { ascending: false });
      const pend = (data || []).some((p) => p.status === 'pending');
      return data?.length ? `${pend ? `<div class="alert info">A pending payment unlocks your course only after it is verified. If you have just paid, wait a minute and <button class="btn btn-ghost btn-sm" data-go="payments">Refresh</button></div>` : ''}<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Course</th><th>Amount</th><th>Reference</th><th>Status</th></tr></thead><tbody>${data.map((p) => `<tr><td>${fmtDate(p.created_at)}</td><td>${esc(p.course?.title)}</td><td>${money(p.amount, p.currency)}</td><td>${esc(p.reference)}</td><td><span class="badge ${p.status === 'success' ? 'ok' : p.status === 'pending' ? 'warn' : 'err'}">${p.status}</span></td></tr>`).join('')}</tbody></table></div>` : empty('No payments yet', 'Payments for your enrolments will be listed here.');
    },
    async notifications() {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(50);
      return data?.length ? `<div class="tools"><span class="grow"></span><button class="btn btn-ghost btn-sm" data-readall>Mark all as read</button></div><div class="list">${data.map((n) => `<div class="list-item" style="${n.read ? '' : 'border-color:var(--ink);background:#fbfff0'}"><div class="grow"><h3>${esc(n.title)}</h3><p class="muted" style="font-size:.95rem">${esc(n.body)}</p><p class="muted" style="font-size:.8rem;margin-top:4px">${fmtDate(n.created_at)}</p></div>${n.link ? `<a class="btn btn-outline btn-sm" href="${esc(n.link)}">Open</a>` : ''}</div>`).join('')}</div>` : empty('No notifications', 'Updates about payments, grades and certificates show up here.');
    },
    async settings() {
      return `<div class="panel" style="max-width:640px"><h2>Profile</h2><form id="profForm" novalidate><div class="field"><label for="pName">Full name</label><input class="input" id="pName" value="${esc(me.full_name)}" required maxlength="120"></div><div class="field"><label for="pMail">Email</label><input class="input" id="pMail" value="${esc(me.email)}" disabled><span class="hint">Email changes are handled by support.</span></div><div class="row-2"><div class="field"><label for="pPhone">Phone</label><input class="input" id="pPhone" value="${esc(me.phone || '')}" maxlength="40"></div><div class="field"><label for="pCountry">Country</label><input class="input" id="pCountry" value="${esc(me.country || '')}" maxlength="80"></div></div><button class="btn btn-dark" type="submit">Save changes</button></form></div>
      <div class="panel" style="max-width:640px"><h2>Change password</h2><form id="pwForm" novalidate><div class="field"><label for="pw1">New password</label><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="8"></div><button class="btn btn-dark" type="submit">Update password</button></form></div>`;
    },
  };

  async function show(tab, arg) {
    if (!V[tab]) tab = 'overview';
    $('sideNav').querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab));
    $('panelTitle').textContent = TABS.find((t) => t[0] === tab)[1]; toggleSide(false); busyPanel();
    try { $('panel').innerHTML = await V[tab](arg); } catch (e) { console.error(e); $('panel').innerHTML = empty('Something went wrong', 'We could not load this section. Please refresh and try again.'); }
    $('panel').querySelector('.bar i, .ring-progress') && requestAnimationFrame(() => $('panel').querySelectorAll('.bar i').forEach((i) => { const w = i.style.width; i.style.width = '0'; requestAnimationFrame(() => (i.style.width = w)); }));
    if (location.hash.slice(1).split('?')[0] !== tab) history.replaceState(null, '', `#${tab}`);
  }
  const route = () => show(location.hash.slice(1).split('?')[0] || 'overview');
  addEventListener('hashchange', route);

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab],[data-go],[data-lesson],[data-assign],[data-exam],[data-claim],[data-cert],[data-readall]'); if (!t) return;
    if (t.dataset.tab) return void show(t.dataset.tab);
    if (t.dataset.go) return void show(t.dataset.go, t.dataset.course);
    if (t.dataset.lesson) return openLesson(t.dataset.lesson);
    if (t.dataset.assign) return openAssignment(t.dataset.assign);
    if (t.dataset.exam) return openExam(t.dataset.exam);
    if (t.dataset.claim) { setBusy(t, true, 'Issuing'); const { error } = await supabase.rpc('claim_certificate', { p_course: t.dataset.claim }); if (error) { setBusy(t, false); return toast(error.message, 'err'); } toast('Certificate issued', 'ok'); return void show('certificates'); }
    if (t.dataset.cert) return openCert(t.dataset.cert);
    if (t.dataset.readall) { await supabase.from('notifications').update({ read: true }).eq('user_id', me.id).eq('read', false); return void show('notifications'); }
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'lsCourse') show('lessons', e.target.value); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-lesson]')) { e.preventDefault(); openLesson(e.target.dataset.lesson); } });

  async function openLesson(id) {
    const l = S.lessonList.find((x) => x.id === id); const done = S.doneSet.has(id);
    const lessonIndex = S.lessonList.findIndex((lesson) => lesson.id === id);
    const nextLesson = S.lessonList[lessonIndex + 1];
    const vid = lessonVideo(l.video_url, l.title);
    const { data: comments, error: discussionError } = await supabase.from('course_discussions').select('*').eq('lesson_id', id).order('created_at');
    if (discussionError) return toast('Could not load this section discussion.', 'err');
    const rows = comments || [];
    const thread = rows.filter((comment) => !comment.parent_id).map((comment) => `<article class="review"><p><strong>${esc(comment.author_name || 'Student')}</strong><span class="muted" style="margin-left:8px;font-size:.85rem">${fmtDate(comment.created_at)}</span></p><p style="margin-top:8px;white-space:pre-wrap">${esc(comment.body)}</p><button class="btn btn-ghost btn-sm" type="button" data-reply="${comment.id}">Reply</button>${rows.filter((reply) => reply.parent_id === comment.id).map((reply) => `<div class="panel" style="margin:12px 0 0 20px"><p><strong>${esc(reply.author_name || 'Student')}</strong><span class="muted" style="margin-left:8px;font-size:.85rem">${fmtDate(reply.created_at)}</span></p><p style="margin-top:8px;white-space:pre-wrap">${esc(reply.body)}</p></div>`).join('')}</article>`).join('');
    const actions = `<button class="btn ${done ? 'btn-outline' : 'btn-lime'}" id="markBtn">${done ? 'Mark as not done' : 'Mark as complete'}</button>${nextLesson ? `<button class="btn btn-dark" id="nextSection" ${done ? '' : 'disabled'}>Next section ${icon('arrow-right', '', 16)}</button>` : `<button class="btn btn-dark" id="openAssessment" ${done ? '' : 'disabled'}>Open assessments</button>`}`;
    const m = modal({ title: l.title, wide: true, body: `<div class="prose">${(l.content || '').split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('')}</div>${vid}<section class="block"><h3>Section discussion</h3>${thread || '<p class="muted">No discussion yet. Start the conversation with a question or note.</p>'}<form id="lessonDiscussionForm" style="margin-top:16px"><input type="hidden" id="discussionParent"><div class="field"><label for="discussionBody">Your message</label><textarea class="input" id="discussionBody" maxlength="4000" required></textarea></div><button class="btn btn-outline btn-sm" id="cancelReply" type="button" hidden>Cancel reply</button><button class="btn btn-dark btn-sm" type="submit">Post message</button></form></section>`, actions });
    m.el.querySelector('#nextSection')?.addEventListener('click', () => { m.close(); openLesson(nextLesson.id); });
    m.el.querySelector('#openAssessment')?.addEventListener('click', () => { m.close(); show('exams'); });
    m.el.querySelectorAll('[data-reply]').forEach((button) => button.addEventListener('click', () => {
      m.el.querySelector('#discussionParent').value = button.dataset.reply;
      m.el.querySelector('#cancelReply').hidden = false;
      m.el.querySelector('#discussionBody').focus();
    }));
    m.el.querySelector('#cancelReply').addEventListener('click', () => {
      m.el.querySelector('#discussionParent').value = '';
      m.el.querySelector('#cancelReply').hidden = true;
    });
    m.el.querySelector('#lessonDiscussionForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = m.el.querySelector('#discussionBody').value.trim();
      if (!body) return;
      const { error } = await supabase.from('course_discussions').insert({ course_id: l.course_id, module_id: l.module_id, lesson_id: l.id, user_id: me.id, parent_id: m.el.querySelector('#discussionParent').value || null, body });
      if (error) return toast('Could not post your message. Please try again.', 'err');
      m.close();
      toast('Message posted', 'ok');
      openLesson(id);
    });
    m.el.querySelector('#markBtn').addEventListener('click', async (ev) => {
      setBusy(ev.currentTarget, true, 'Saving');
      const r = done ? await supabase.from('course_progress').delete().eq('lesson_id', id).eq('user_id', me.id) : await supabase.from('course_progress').insert({ user_id: me.id, course_id: l.course_id, lesson_id: id });
      if (r.error) { toast('Could not save progress', 'err'); return setBusy(ev.currentTarget, false); }
      m.close(); refreshAll(); await loadEnrolls(); show('lessons', l.course_id);
    });
  }
  function openAssignment(id) {
    const a = S.assign.find((x) => x.id === id), s = S.subs[id]; const locked = s?.status === 'graded';
    const m = modal({ title: a.title, body: `<p class="muted" style="margin-bottom:16px">${esc(a.instructions)}</p><form id="asForm"><div class="field"><label for="asText">Your answer</label><textarea class="input" id="asText" ${locked ? 'disabled' : ''} maxlength="8000">${esc(s?.content || '')}</textarea></div><div class="field"><label for="asLink">Link to your work (optional)</label><input class="input" id="asLink" type="url" placeholder="https://" value="${esc(s?.link_url || '')}" ${locked ? 'disabled' : ''}></div><div class="field"><label for="asFile">Upload answer file (optional, up to 50 MB)</label><input class="input" id="asFile" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*,video/*" ${locked ? 'disabled' : ''}>${s?.file_path ? `<span class="hint">A file is already submitted. Selecting a replacement will replace it after save.</span>` : ''}</div></form>${locked ? `<div class="alert ok">Graded: ${s.score}/${a.max_score}. ${esc(s.feedback || '')}</div>` : ''}`, actions: locked ? '' : '<button class="btn btn-lime" id="asSave">Submit assignment</button>' });
    const existingFilePath = s?.file_path;
    if (existingFilePath) {
      supabase.storage.from('course-materials').createSignedUrl(existingFilePath, 3600).then(({ data }) => {
        if (data?.signedUrl) m.el.querySelector('#asForm').insertAdjacentHTML('beforeend', `<p class="hint"><a href="${esc(data.signedUrl)}" target="_blank" rel="noopener noreferrer">Open submitted file</a></p>`);
      });
    }
    m.el.querySelector('#asSave')?.addEventListener('click', async (ev) => {
      const content = m.el.querySelector('#asText').value.trim(), link = m.el.querySelector('#asLink').value.trim();
      const file = m.el.querySelector('#asFile').files[0];
      if (!content && !link && !file && !existingFilePath) return toast('Add an answer, link, or file first.', 'err');
      if (link && !/^https?:\/\//.test(link)) return toast('Links must start with http:// or https://', 'err');
      if (file && file.size > 50 * 1024 * 1024) return toast('Assignment file must be 50 MB or smaller.', 'err');
      setBusy(ev.currentTarget, true, 'Submitting');
      let filePath = existingFilePath || null;
      if (file) {
        filePath = `submissions/${me.id}/${id}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
        const { error: uploadError } = await supabase.storage.from('course-materials').upload(filePath, file, { upsert: false, contentType: file.type });
        if (uploadError) { setBusy(ev.currentTarget, false); return toast(`Upload failed: ${uploadError.message}`, 'err'); }
      }
      const row = { content: content || null, link_url: link || null, file_path: filePath };
      const r = s ? await supabase.from('assignment_submissions').update({ ...row, submitted_at: new Date().toISOString() }).eq('id', s.id) : await supabase.from('assignment_submissions').insert({ ...row, assignment_id: id, user_id: me.id });
      if (r.error) {
        if (file) await supabase.storage.from('course-materials').remove([filePath]);
        setBusy(ev.currentTarget, false); return toast('Could not submit. Please try again.', 'err');
      }
      if (file && existingFilePath) await supabase.storage.from('course-materials').remove([existingFilePath]);
      toast('Assignment submitted', 'ok'); m.close(); refreshAll(); show('assignments');
    });
  }
  async function openExam(id) {
    const x = S.exams.find((y) => y.id === id);
    const { data: attempt, error } = await supabase.rpc('begin_exam', { p_exam: id });
    if (error || !attempt?.questions?.length) return toast(error?.message || 'This assessment has no questions yet.', 'err');
    const qs = attempt.questions;
    const expiresAt = new Date(attempt.expires_at).getTime();
    const m = modal({ title: x.title, wide: true, body: `<p class="muted" style="margin-bottom:8px">${esc(x.instructions || '')} Pass mark ${x.pass_mark}%.</p><p class="badge warn" id="examTimer" aria-live="polite"></p><form id="exForm">${qs.map((q, i) => `<fieldset class="q" style="border:1px solid var(--line)"><legend style="font-weight:700;padding:0 6px">${i + 1}. ${esc(q.question)}</legend>${arr(q.options).map((o, k) => `<label class="opt"><input type="radio" name="q_${q.id}" value="${k}"><span>${esc(o)}</span></label>`).join('')}</fieldset>`).join('')}</form><div id="exOut"></div>`, actions: '<button class="btn btn-lime" id="exSubmit">Submit assessment</button>' });
    const submitButton = m.el.querySelector('#exSubmit');
    let finished = false;
    const submitAttempt = async (automatic = false) => {
      if (finished) return;
      const answers = {};
      qs.forEach((q) => { const checked = m.el.querySelector(`input[name="q_${q.id}"]:checked`); if (checked) answers[q.id] = Number(checked.value); });
      if (!automatic && Object.keys(answers).length < qs.length && !confirm('Some questions are unanswered. Submit anyway?')) return;
      finished = true;
      clearInterval(timer);
      setBusy(submitButton, true, 'Submitting');
      const { data, error: submitError } = await supabase.rpc('submit_exam_attempt', { p_attempt: attempt.attempt_id, p_answers: answers });
      setBusy(submitButton, false);
      if (submitError) { finished = false; return toast(submitError.message, 'err'); }
      m.el.querySelector('#exForm').hidden = true;
      submitButton.hidden = true;
      const detail = data.expired ? 'Time expired; unanswered questions were marked incorrect.' : data.passed ? 'Well done.' : `You need ${data.pass_mark}% to pass. You can retake this assessment.`;
      m.el.querySelector('#exOut').innerHTML = `<div class="alert ${data.passed ? 'ok' : 'err'}"><strong>${data.passed ? 'Passed' : 'Not passed'}: ${data.score}%</strong><br>${detail}</div>`;
      refreshAll(); await loadEnrolls();
    };
    const updateTimer = () => {
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0');
      const secondsText = String(seconds % 60).padStart(2, '0');
      m.el.querySelector('#examTimer').textContent = `${minutesText}:${secondsText} remaining`;
      if (seconds === 0) submitAttempt(true);
    };
    const timer = setInterval(updateTimer, 1000);
    updateTimer();
    submitButton.addEventListener('click', () => submitAttempt(false));
  }
  function openCert(id) {
    const c = S.certs.find((x) => x.id === id);
    const url = `${location.origin}/certificate-verify.html?n=${encodeURIComponent(c.certificate_number)}`;
    const signature = /^https?:\/\//i.test(cfg.signature_url || '') ? `<img class="cert-signature" src="${esc(cfg.signature_url)}" alt="Signature of ${esc(cfg.signatory_name || 'authorised signatory')}">` : '';
    modal({ title: 'Certificate', wide: true, body: `<div class="cert"><div class="cert-in"><div><img src="assets/images/logo-mark.svg" width="54" height="54" alt="" style="margin:0 auto 8px"><h3>${esc(cfg.organisation || 'Courssins Technology Institute')}</h3><small>Certificate of Completion</small></div><div><small>This certifies that</small><div class="who">${esc(c.student_name)}</div><p style="margin-top:12px"><small>has successfully completed</small></p><h3>${esc(c.course_title)}</h3><small>Completed on ${fmtDate(c.completed_at, { day: 'numeric', month: 'long', year: 'numeric' })}</small></div><div style="width:100%"><div class="cert-sign"><div style="border:0;padding:0">${signature}<div style="border-top:1.5px solid var(--ink);padding-top:6px">${esc(cfg.signatory_name || 'Authorised signatory')}<br><small>${esc(cfg.signatory || 'Director of Studies')}</small></div></div><div>${esc(c.certificate_number)}<br><small>Certificate number</small></div></div><p style="margin-top:12px"><small>Verify at ${esc(url)}</small></p></div></div></div>`, actions: `<a class="btn btn-outline" href="${esc(url)}" target="_blank" rel="noopener">Open verification page</a><button class="btn btn-lime" onclick="window.print()">Print or save as PDF</button>` });
  }
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'profForm') {
      e.preventDefault(); const btn = e.target.querySelector('button'); setBusy(btn, true, 'Saving');
      const upd = { full_name: $('pName').value.trim(), phone: $('pPhone').value.trim(), country: $('pCountry').value.trim() };
      if (upd.full_name.length < 2) { setBusy(btn, false); return toast('Enter your full name.', 'err'); }
      const { error } = await supabase.from('profiles').update(upd).eq('id', me.id); setBusy(btn, false);
      if (error) return toast('Could not save your profile.', 'err'); Object.assign(me, upd); $('whoami').textContent = me.full_name; toast('Profile saved', 'ok');
    }
    if (e.target.id === 'pwForm') {
      e.preventDefault(); const pw = $('pw1').value; if (pw.length < 8) return toast('Use at least 8 characters.', 'err');
      const { error } = await supabase.auth.updateUser({ password: pw }); if (error) return toast(error.message, 'err'); $('pw1').value = ''; toast('Password updated', 'ok');
    }
  });
  // unread badge
  supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('read', false).then(({ count }) => { const b = document.querySelector('[data-badge="notifications"]'); if (count) { b.hidden = false; b.textContent = count; } });
  route();
}
