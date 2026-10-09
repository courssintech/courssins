import { supabase, configured, requireAuth, signOut, getProfile } from './supabase.js';
import { getSetting } from './api.js';
import { esc, money, fmtDate, icon, modal, toast, setBusy, empty, arr } from './ui.js';
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const TABS = [['overview', 'Overview', 'home'], ['courses', 'My courses', 'book'], ['lessons', 'Lessons', 'play'], ['assignments', 'Assignments', 'file'], ['career', 'Projects and CV', 'award'], ['certificates', 'Certificates', 'award'], ['id-card', 'Course ID cards', 'user'], ['discussions', 'Course discussions', 'chat'], ['library', 'Library', 'stack'], ['events', 'Events', 'calendar'], ['tickets', 'My event tickets', 'calendar'], ['payments', 'Payment history', 'card'], ['notifications', 'Notifications', 'bell'], ['settings', 'Account settings', 'settings']];
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
  const S = { enrolls: null, prog: {}, lessons: {}, done: null, certCourses: [] };
  const loadEnrolls = async () => {
    if (S.enrolls) return S.enrolls;
    const [{ data }, { data: certificates }] = await Promise.all([supabase.from('enrollments').select('*, course:courses(id,slug,title,image_url,duration,price,currency,category,lessons_start_at)').eq('user_id', me.id).order('enrolled_at', { ascending: false }), supabase.from('certificates').select('course_id').eq('user_id', me.id).eq('status', 'valid')]);
    S.enrolls = data || [];
    S.certCourses = (certificates || []).map((c) => c.course_id);
    await Promise.all(S.enrolls.filter((e) => e.status === 'active' || S.certCourses.includes(e.course_id)).map(async (e) => { const { data: p } = await supabase.rpc('course_progress_summary', { p_course: e.course_id }); S.prog[e.course_id] = p; }));
    return S.enrolls;
  };
  const active = async () => (await loadEnrolls()).filter((e) => e.status === 'active' || S.certCourses.includes(e.course_id));
  const refreshAll = () => { S.enrolls = null; S.done = null; };
  const ring = (p) => `<div class="ring-progress" style="--p:${p}"><b>${p}%</b></div>`;
  const cpStats = (p) => p ? `<div class="cp-stats"><span>Sections ${p.lessons_done}/${p.lessons_total}</span><span>Assignments ${p.assignments_done}/${p.assignments_total}</span><span>Projects checked ${p.projects_checked || 0}/${p.projects_total || 0}</span><span>${p.eligible ? '<strong style="color:var(--ok)">Eligible for certificate</strong>' : 'Course in progress'}</span></div>` : '';
  const needCourse = (t) => empty('No active courses yet', t || 'Enrol in a course and complete payment to unlock this section.', '<a class="btn btn-lime" href="courses.html">Browse courses</a>');
  const V = {
    async overview() {
      const en = await loadEnrolls(); const act = en.filter((e) => e.status === 'active' || S.certCourses.includes(e.course_id));
      const { count: certs } = await supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('user_id', me.id);
      const { count: unread } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('read', false);
      const avg = act.length ? Math.round(act.reduce((n, e) => n + (S.prog[e.course_id]?.percent || 0), 0) / act.length) : 0;
      return `<div class="kpis"><button class="kpi lime" data-go="courses"><b>${act.length}</b><span>Active courses</span></button><button class="kpi" data-go="lessons"><b>${avg}%</b><span>Average progress</span></button><button class="kpi" data-go="certificates"><b>${certs || 0}</b><span>Certificates</span></button><button class="kpi" data-go="notifications"><b>${unread || 0}</b><span>Unread notifications</span></button></div>
      <div class="panel"><h2>Continue learning</h2>${act.length ? act.map((e) => `<div class="course-progress">${ring(S.prog[e.course_id]?.percent || 0)}<div><h3>${esc(e.course.title)}</h3>${e.course.lessons_start_at && new Date(e.course.lessons_start_at) > new Date() ? `<p class="alert info">Lessons and materials open ${fmtDate(e.course.lessons_start_at)}. Course outline is available now.</p>` : ''}${bar(S.prog[e.course_id]?.percent || 0)}${cpStats(S.prog[e.course_id])}<button class="btn btn-dark btn-sm" style="margin-top:12px" data-go="lessons" data-course="${e.course_id}">${e.course.lessons_start_at && new Date(e.course.lessons_start_at) > new Date() ? 'View course outline' : 'Open lessons'}</button></div></div>`).join('') : needCourse()}</div>
      <div class="panel"><h2>Your profile</h2><ul class="facts" style="margin:0"><li>${icon('user')}<span>${esc(me.full_name || 'Add your name in settings')}</span></li><li>${icon('mail')}<span>${esc(me.email)}</span></li><li>${icon('phone')}<span>${esc(me.phone || 'No phone number')}</span></li><li>${icon('globe')}<span>${esc(me.country || 'No country set')}</span></li></ul></div>`;
    },
    async courses() {
      const en = await loadEnrolls(); if (!en.length) return needCourse('You have not enrolled in a course yet.');
      return `<div class="tools"><span class="grow"></span><a class="btn btn-lime btn-sm" href="courses.html">${icon('plus', '', 16)} Add a course</a></div><div class="list">${en.map((e) => `<div class="list-item"><div class="grow"><h3>${esc(e.course.title)}</h3>${e.course.lessons_start_at ? `<p class="muted">Lessons and materials start ${fmtDate(e.course.lessons_start_at)}</p>` : `<p class="muted">Lesson start date has not been set yet.</p>`}<p class="muted" style="font-size:.9rem">${esc(e.course.duration)} · enrolled ${fmtDate(e.enrolled_at)}</p>${e.status === 'active' ? `${bar(S.prog[e.course_id]?.percent || 0)}${cpStats(S.prog[e.course_id])}` : ''}</div>
      <span class="badge ${e.status === 'active' || S.certCourses.includes(e.course_id) ? 'ok' : 'warn'}">${S.certCourses.includes(e.course_id) ? 'Certified · access retained' : e.status === 'active' ? 'Unlocked' : e.status === 'pending' ? 'Awaiting payment' : 'Cancelled'}</span>
      ${e.status === 'active' || S.certCourses.includes(e.course_id) ? `<button class="btn btn-dark btn-sm" data-go="lessons" data-course="${e.course_id}">Open</button>` : e.status === 'pending' ? `<button class="btn btn-outline btn-sm" data-go="lessons" data-course="${e.course_id}">View outline</button><a class="btn btn-lime btn-sm" href="course.html?id=${esc(e.course.slug)}&enroll=1">Complete payment</a>` : ''}</div>`).join('')}</div>`;
    },
    async lessons(courseId) {
      const enrolled = await loadEnrolls();
      courseId = courseId || S.lessonCourse || enrolled[0]?.course_id; S.lessonCourse = courseId;
      const selectedCourse = enrolled.find((e) => e.course_id === courseId);
      const act = enrolled.filter((e) => e.status === 'active' || S.certCourses.includes(e.course_id));
      if (!selectedCourse) return needCourse();
      if (selectedCourse.status === 'pending' || selectedCourse.course?.lessons_start_at && new Date(selectedCourse.course.lessons_start_at) > new Date()) {
        const { data: outline } = await supabase.from('course_modules').select('title,summary,topics,position').eq('course_id', courseId).order('position');
        const startNotice = selectedCourse.course?.lessons_start_at ? `Lessons and materials start ${fmtDate(selectedCourse.course.lessons_start_at)}.` : 'Lesson access is pending enrollment payment.';
        return `<div class="panel"><div class="alert info"><strong>${startNotice}</strong> Videos, notes and materials are not available yet. You can review the outline now.</div><h2>Course outline · ${esc(selectedCourse.course.title)}</h2>${(outline || []).map((m) => `<article class="list-item"><div><h3>Module ${m.position}: ${esc(m.title)}</h3>${m.summary ? `<p>${esc(m.summary)}</p>` : ''}${Array.isArray(m.topics) ? `<p class="muted">${m.topics.map(esc).join(' · ')}</p>` : ''}</div></article>`).join('') || '<p class="muted">The tutor has not added an outline yet.</p>'}</div>`;
      }
      if (selectedCourse.status !== 'active' && !S.certCourses.includes(courseId)) return needCourse();
      if (!act.some((e) => e.course_id === courseId)) return needCourse();
      const [{ data: ls }, { data: pr }, { data: mods }, { data: resources }] = await Promise.all([supabase.from('lessons').select('*').eq('course_id', courseId).order('position'), supabase.from('course_progress').select('lesson_id').eq('course_id', courseId).eq('user_id', me.id), supabase.from('course_modules').select('id,title,position').eq('course_id', courseId).order('position'), supabase.from('course_resources').select('*').eq('course_id', courseId).eq('published', true).order('created_at')]);
      const resourceLinks = await Promise.all((resources || []).map(async (resource) => {
        if (resource.object_path) {
          const { data } = await supabase.storage.from('course-materials').createSignedUrl(resource.object_path, 3600);
          return { ...resource, href: data?.signedUrl || '' };
        }
        return { ...resource, href: /^https?:\/\//i.test(resource.external_url || '') ? resource.external_url : '' };
      }));
      const done = new Set((pr || []).map((r) => r.lesson_id));
      const group = (mods || []).map((m, index) => `<details class="acc" ${index === 0 ? 'open' : ''}><summary>Module ${m.position}: ${esc(m.title)}</summary><div class="acc-body">${(ls || []).filter((l) => l.module_id === m.id).map((l) => `<a class="lesson ${done.has(l.id) ? 'done' : ''}" href="learn.html?lesson=${l.id}" style="text-decoration:none;color:inherit"><span class="dot">${done.has(l.id) ? icon('check', '', 14) : ''}</span><div style="flex:1"><strong>${esc(l.title)}</strong>${l.duration_min ? `<div class="muted" style="font-size:.85rem">${l.duration_min} min</div>` : ''}</div>${icon('arrow-right', '', 18)}</a>`).join('') || '<p class="muted">Your tutor has not published sections for this module yet.</p>'}</div></details>`).join('');
      const resourceList = resourceLinks.length ? `<section class="block"><h3>Course resources</h3><div class="list">${resourceLinks.map((resource) => `<div class="list-item"><div class="grow"><h4>${esc(resource.title)}</h4><p class="muted">${esc(resource.description || resource.resource_type)}</p></div>${resource.href ? `<a class="btn btn-dark btn-sm" href="${esc(resource.href)}" target="_blank" rel="noopener noreferrer">Open ${icon('external', '', 16)}</a>` : '<span class="muted">File unavailable</span>'}</div>`).join('')}</div></section>` : '';
      return `<div class="tools"><label for="lsCourse" class="label">Course</label><select class="input" id="lsCourse" style="max-width:420px">${act.map((e) => `<option value="${e.course_id}" ${e.course_id === courseId ? 'selected' : ''}>${esc(e.course.title)}</option>`).join('')}</select></div><div class="panel">${bar(S.prog[courseId]?.percent || 0)}${group || empty('No lessons yet', 'Your tutor has not published lessons for this course.')}${resourceList}</div>`;
    },
    async assignments() {
      const act = await active(); if (!act.length) return needCourse();
      const ids = act.map((e) => e.course_id);
      const [{ data: as }, { data: subs }] = await Promise.all([supabase.from('assignments').select('*').in('course_id', ids).order('position'), supabase.from('assignment_submissions').select('*').eq('user_id', me.id)]);
      S.assign = as || []; S.subs = Object.fromEntries((subs || []).map((s) => [s.assignment_id, s]));
      if (!S.assign.length) return empty('No assignments yet', 'Assignments appear here when your tutor publishes them.');
      return `<div class="list">${S.assign.map((a) => { const s = S.subs[a.id]; return `<div class="list-item"><div class="grow"><h3>${a.is_project ? 'Project · ' : ''}${esc(a.title)}</h3><p class="muted" style="font-size:.9rem">${esc(act.find((e) => e.course_id === a.course_id)?.course.title)} · max ${a.max_score} points${a.due_at ? ` · due ${fmtDate(a.due_at)}` : ''}</p>${a.attachment_url ? `<p><a href="${esc(a.attachment_url)}" target="_blank" rel="noopener noreferrer">Open tutor attachment</a></p>` : ''}${s?.status === 'graded' ? `<p style="margin-top:6px"><strong>Score ${s.score}/${a.max_score}</strong>${s.feedback ? ` · ${esc(s.feedback)}` : ''}</p>` : ''}</div><span class="badge ${s ? (s.status === 'graded' ? 'ok' : 'warn') : ''}">${s ? (s.status === 'graded' ? 'Tutor checked' : 'Submitted') : 'Not submitted'}</span><button class="btn btn-dark btn-sm" data-assign="${a.id}">${s ? (s.status === 'graded' ? 'View' : 'Edit submission') : 'Submit'}</button></div>`; }).join('')}</div>`;
    },
    async exams() {
      const act = await active(); if (!act.length) return needCourse();
      const ids = act.map((e) => e.course_id);
      const [{ data: ex }, { data: rs }] = await Promise.all([supabase.from('exams').select('*, module:course_modules(title,position)').in('course_id', ids).eq('published', true).order('is_final').order('module_id'), supabase.from('exam_results').select('*').eq('user_id', me.id).order('taken_at', { ascending: false })]);
      S.exams = ex || [];
      if (!S.exams.length) return empty('No quizzes yet', 'Module and final course quizzes will appear here when your tutor publishes them.');
      return `<div class="list">${S.exams.map((x) => { const r = (rs || []).filter((y) => y.exam_id === x.id); const best = r.length ? Math.max(...r.map((y) => Number(y.score))) : null; const passed = r.some((y) => y.passed);
        const kind = x.is_final ? 'Final course quiz' : x.module?.title ? `Module ${x.module.position}: ${x.module.title}` : 'Course quiz';
        return `<div class="list-item"><div class="grow"><h3>${esc(x.title)}</h3><p class="muted" style="font-size:.9rem">${esc(kind)} · ${x.duration_min} min · pass mark ${x.pass_mark}%${best !== null ? ` · best score ${best}%` : ''}</p></div><span class="badge ${passed ? 'ok' : r.length ? 'warn' : ''}">${passed ? 'Passed' : r.length ? 'Not passed yet' : 'Not taken'}</span><button class="btn btn-dark btn-sm" data-exam="${x.id}">${r.length ? 'Retake quiz' : 'Start quiz'}</button></div>`; }).join('')}</div>`;
    },
    async results() {
      const [{ data: rs }, { data: subs }] = await Promise.all([supabase.from('exam_results').select('*, exam:exams(title)').eq('user_id', me.id).order('taken_at', { ascending: false }), supabase.from('assignment_submissions').select('*, a:assignments(title,max_score)').eq('user_id', me.id).eq('status', 'graded')]);
      const rows = [...(rs || []).map((r) => [r.exam?.title, 'Quiz', `${r.score}%`, r.passed ? 'Passed' : 'Not passed', r.taken_at]), ...(subs || []).map((s) => [s.a?.title, 'Assignment', `${s.score}/${s.a?.max_score}`, 'Graded', s.graded_at || s.submitted_at])];
      return rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Item</th><th>Type</th><th>Score</th><th>Outcome</th><th>Date</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${esc(r[2])}</td><td>${r[3]}</td><td>${fmtDate(r[4])}</td></tr>`).join('')}</tbody></table></div>` : empty('No results yet', 'Your quiz scores and graded assignments will be listed here.');
    },
    async certificates() {
      await loadEnrolls();
      const { data: certs } = await supabase.from('certificates').select('*').eq('user_id', me.id); S.certs = certs || [];
      const eligible = S.enrolls.filter((e) => e.status === 'active' && S.prog[e.course_id]?.eligible && !S.certs.find((c) => c.course_id === e.course_id));
      return `${eligible.map((e) => `<div class="alert ok" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">You completed ${esc(e.course.title)}.<button class="btn btn-dark btn-sm" data-claim="${e.course_id}">Get certificate</button></div>`).join('')}
      ${S.certs.length ? `<div class="list">${S.certs.map((c) => `<div class="list-item"><div class="grow"><h3>${esc(c.course_title)}</h3><p class="muted" style="font-size:.9rem">No. ${esc(c.certificate_number)} · completed ${fmtDate(c.completed_at)}</p></div><span class="badge ${c.status === 'valid' ? 'ok' : 'err'}">${c.status}</span><button class="btn btn-dark btn-sm" data-cert="${c.id}">View</button></div>`).join('')}</div>` : eligible.length ? '' : empty('No certificates yet', 'Complete course sections and quizzes, and submit all projects for tutor review before claiming your certificate.')}`;
    },
    async 'id-card'() {
      const [{ data: card, error }, { data: student }, { data: profile }, { data: enrollment }] = await Promise.all([
        supabase.rpc('get_or_create_student_id_card'),
        supabase.from('students').select('student_no,status').eq('user_id', me.id).single(),
        supabase.from('profiles').select('full_name,email,phone,address,avatar_url').eq('id', me.id).single(),
        supabase.from('enrollments').select('course:courses(title)').eq('user_id', me.id).eq('status', 'active').order('enrolled_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (error || !card || !student || !profile) return empty('Student ID unavailable', error?.message || 'We could not load your student ID.');
      const xml = (value) => String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
      const avatar = profile.avatar_url ? `<image href="${xml(profile.avatar_url)}" x="34" y="74" width="160" height="180" preserveAspectRatio="xMidYMid slice"/>` : '<rect x="34" y="74" width="160" height="180" fill="#d9e2e8"/><text x="114" y="172" text-anchor="middle" font-size="20" fill="#304050">Courssins</text>';
      const signature = cfg.signature_url ? `<image href="${xml(cfg.signature_url)}" x="680" y="404" width="170" height="54" preserveAspectRatio="xMidYMid meet"/>` : '';
      const issued = fmtDate(card.issued_at, { day: 'numeric', month: 'short', year: 'numeric' });
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" rx="30" fill="#f9fbf5"/><rect width="900" height="96" rx="30" fill="#17212b"/><rect y="66" width="900" height="30" fill="#17212b"/><text x="34" y="60" fill="#fff" font-family="Arial" font-size="30" font-weight="700">COURSSINS TECHNOLOGY INSTITUTE</text>${avatar}<text x="230" y="145" fill="#5e6b74" font-family="Arial" font-size="18">STUDENT · ${xml(student.student_no)}</text><text x="230" y="190" fill="#17212b" font-family="Arial" font-size="34" font-weight="700">${xml(profile.full_name)}</text><text x="230" y="236" fill="#17212b" font-family="Arial" font-size="20">${xml(profile.email)}</text><text x="230" y="272" fill="#17212b" font-family="Arial" font-size="20">${xml(profile.phone || 'No phone')}</text><text x="230" y="308" fill="#17212b" font-family="Arial" font-size="20">${xml(profile.address || '')}</text><text x="34" y="350" fill="#17212b" font-family="Arial" font-size="20">Course: ${xml(enrollment?.course?.title || 'Not enrolled')}</text><path d="M34 380H866" stroke="#d7ded4"/><text x="34" y="435" fill="#17212b" font-family="Arial" font-size="22" font-weight="700">${xml(card.card_number)} · Issued ${xml(issued)} · ${xml(card.status.toUpperCase())}</text>${signature}<path d="M680 468H850" stroke="#17212b"/><text x="680" y="495" fill="#17212b" font-family="Arial" font-size="14">${xml(cfg.signatory_name || 'Abdulmannan Sulayman')}</text><text x="680" y="515" fill="#5e6b74" font-family="Arial" font-size="13">${xml(cfg.signatory || 'Director of Studies')}</text><rect x="0" y="570" width="900" height="30" rx="0" fill="${card.status === 'valid' ? '#c7f36b' : '#ef7777'}"/></svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }); const href = URL.createObjectURL(blob);
      return `<div class="panel" style="max-width:720px"><h2>Student identity card</h2><p class="muted">This card is ${esc(card.status)}. It shows your photo, contact details, role, course, issue date and Director of Studies signature.</p><img src="${href}" alt="Student identity card" style="display:block;width:100%;border-radius:14px;border:1px solid var(--line);margin:18px 0"><a class="btn btn-lime" href="${href}" download="${esc(card.card_number)}.svg">${icon('download', '', 16)} Download ID image</a></div>`;
    },
    async discussions() {
      const { data: groups, error } = await supabase.from('tutor_groups').select('id,title,course_id').order('created_at', { ascending: false });
      if (error) return empty('Discussions unavailable', error.message);
      if (!groups?.length) return empty('No course discussions', 'Your tutor will share assignments and course updates here.');
      const { data: posts } = await supabase.from('tutor_group_posts').select('*').in('group_id', groups.map((g) => g.id)).order('created_at', { ascending: false });
      const ids = (posts || []).map((p) => p.id); const { data: reactions } = ids.length ? await supabase.from('tutor_group_reactions').select('post_id,reaction,user_id').in('post_id', ids) : { data: [] };
      return groups.map((g) => `<div class="panel"><h2>${esc(g.title)}</h2>${(posts || []).filter((p) => p.group_id === g.id).map((post) => { const rs = (reactions || []).filter((r) => r.post_id === post.id); return `<article class="list-item"><div class="grow"><span class="badge">${post.post_type === 'assignment' ? 'Assignment' : 'Tutor update'}</span>${post.title ? `<h3 style="margin-top:8px">${esc(post.title)}</h3>` : ''}<p style="margin:8px 0">${esc(post.body)}</p>${post.attachment_url ? `<a href="${esc(post.attachment_url)}" target="_blank" rel="noopener noreferrer">Open attachment</a>` : ''}${post.assignment_id ? '<button class="btn btn-dark btn-sm" style="margin-top:8px" data-go="assignments">Open assignment and submit</button>' : ''}<div class="btn-row" style="margin-top:10px">${['👍','❤️','👏','✅'].map((emoji) => `<button class="btn btn-ghost btn-sm" data-react-post="${post.id}" data-reaction="${emoji}">${emoji} ${rs.filter((r) => r.reaction === emoji).length}</button>`).join('')}</div><small class="muted">${fmtDate(post.created_at)}</small></div></article>`; }).join('') || '<p class="muted">No posts yet.</p>'}</div>`).join('');
    },
    async library() {
      const { data } = await supabase.from('library').select('*').eq('published', true).order('created_at', { ascending: false });
      return data?.length ? `<div class="list">${data.map((l) => `<div class="list-item"><div class="grow"><h3>${esc(l.title)}</h3><p class="muted" style="font-size:.9rem">${esc(l.description)}</p></div><span class="chip" style="text-transform:capitalize">${esc(l.type)}</span><a class="btn btn-dark btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Open ${icon('external', '', 16)}</a></div>`).join('')}</div>` : empty('Library is empty', 'Resources will appear here.');
    },
    async events() {
      const { data } = await supabase.from('events').select('*').eq('published', true).order('starts_at');
      return data?.length ? `<div class="list">${data.map((e) => `<div class="list-item">${e.image_url ? `<img src="${esc(e.image_url)}" alt="${esc(e.title)} poster" style="width:112px;height:112px;object-fit:cover;border-radius:10px">` : ''}<div class="grow"><h3>${esc(e.title)}</h3><p class="muted" style="font-size:.9rem">${fmtDate(e.starts_at, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} · ${e.location_type === 'virtual' ? 'Virtual' : 'Physical'} · ${esc(e.location || '')}</p><p>${esc(e.description)}</p><p><strong>${Number(e.fee) > 0 ? money(e.fee, e.currency) : 'Free ticket'}</strong></p></div>${e.url ? `<a class="btn btn-outline btn-sm" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Details</a>` : ''}<button class="btn btn-lime btn-sm" data-book-event="${e.id}">Book ticket</button></div>`).join('')}<a class="btn btn-outline btn-sm" href="ticket-verify.html">Verify a ticket</a></div>` : empty('No upcoming events', 'Workshops and open days will be listed here.');
    },
    async tickets() {
      const { data, error } = await supabase.from('event_tickets').select('*, event:events(title,starts_at,location)').eq('user_id', me.id).order('created_at', { ascending: false });
      if (error) return empty('Tickets unavailable', error.message);
      return data?.length ? `<div class="list">${data.map((ticket) => `<article class="list-item"><div class="grow"><h3>${esc(ticket.event?.title || 'Event')}</h3><p>${fmtDate(ticket.event?.starts_at)} · ${esc(ticket.event?.location || '')}</p><p>Ticket code: <strong>${esc(ticket.ticket_code)}</strong></p><span class="badge ${ticket.status === 'valid' ? 'ok' : ticket.status === 'pending' ? 'warn' : 'err'}">${ticket.status}</span></div>${ticket.status === 'valid' ? `<a class="btn btn-outline btn-sm" href="ticket-verify.html?code=${encodeURIComponent(ticket.ticket_code)}">View / verify ticket</a>` : ''}</article>`).join('')}</div>` : empty('No event tickets yet', 'Book a ticket from Events to see it here.');
    },
    async payments() {
      const { data } = await supabase.from('payments').select('*, course:courses(title)').eq('user_id', me.id).order('created_at', { ascending: false });
      const pend = (data || []).some((p) => p.status === 'pending');
      return data?.length ? `${pend ? `<div class="alert info">A pending payment unlocks your course only after it is verified. If you have just paid, wait a minute and <button class="btn btn-ghost btn-sm" data-go="payments">Refresh</button></div>` : ''}<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Course</th><th>Amount</th><th>Reference</th><th>Status</th></tr></thead><tbody>${data.map((p) => `<tr><td>${fmtDate(p.created_at)}</td><td>${esc(p.course?.title)}</td><td>${money(p.amount, p.currency)}</td><td>${esc(p.reference)}</td><td><span class="badge ${p.status === 'success' ? 'ok' : p.status === 'pending' ? 'warn' : 'err'}">${p.status}</span></td></tr>`).join('')}</tbody></table></div>` : empty('No payments yet', 'Payments for your enrolments will be listed here.');
    },
    async notifications() {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(50);
      if (!data?.length) return empty('You’re all caught up', 'Updates about your courses, projects and certificates will appear here.');
      const unread = data.filter((n) => !n.read).length;
      return `<section class="notifications-page"><header class="notifications-heading"><div><span class="eyebrow">YOUR UPDATES</span><h2>Notifications</h2><p>${unread ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'You have read all your updates.'}</p></div>${unread ? '<button class="btn btn-outline btn-sm" data-readall>Mark all as read</button>' : ''}</header><div class="notification-list">${data.map((n) => `<article class="notification-card ${n.read ? '' : 'unread'}"><span class="notification-icon">${icon('bell', '', 18)}</span><div class="notification-content"><div class="notification-title-row"><h3>${esc(n.title)}</h3>${n.read ? '<span class="notification-state">Read</span>' : '<span class="notification-state new">New</span>'}</div><p>${esc(n.body)}</p><time>${fmtDate(n.created_at, { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}</time></div><div class="notification-actions">${n.link ? `<a class="btn btn-outline btn-sm" href="${esc(n.link)}">Open update</a>` : ''}${!n.read ? `<button class="btn btn-ghost btn-sm" data-notice-read="${n.id}">Mark read</button>` : ''}</div></article>`).join('')}</div></section>`;
    },
    async settings() {
      return `<div class="panel" style="max-width:640px"><h2>Profile</h2><form id="profForm" novalidate><div class="field"><label for="pName">Full name</label><input class="input" id="pName" value="${esc(me.full_name)}" required maxlength="120"></div><div class="field"><label for="pMail">Email</label><input class="input" id="pMail" value="${esc(me.email)}" disabled><span class="hint">Email changes are handled by support.</span></div><div class="row-2"><div class="field"><label for="pPhone">Phone</label><input class="input" id="pPhone" value="${esc(me.phone || '')}" maxlength="40"></div><div class="field"><label for="pCountry">Country</label><input class="input" id="pCountry" value="${esc(me.country || '')}" maxlength="80"></div></div><div class="field"><label for="pAddress">Address</label><input class="input" id="pAddress" value="${esc(me.address || '')}" maxlength="240" autocomplete="street-address"></div><button class="btn btn-dark" type="submit">Save changes</button></form></div>
      <div class="panel" style="max-width:640px"><h2>Change password</h2><form id="pwForm" novalidate><div class="field"><label for="pw1">New password</label><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="8"></div><button class="btn btn-dark" type="submit">Update password</button></form></div>`;
    },
  };

  V.career = async function career() {
    const en = await active(); if (!en.length) return needCourse();
    const courseIds = en.map((e) => e.course_id);
    const [{ data: projects }, { data: submissions }, { data: profile }] = await Promise.all([
      supabase.from('assignments').select('*').in('course_id', courseIds).eq('is_project', true).order('due_at'),
      supabase.from('assignment_submissions').select('*').eq('user_id', me.id),
      supabase.from('profiles').select('full_name,email,phone,address,interest').eq('id', me.id).single(),
    ]);
    const submitted = new Map((submissions || []).map((submission) => [submission.assignment_id, submission]));
    return en.map((enrollment) => {
      const courseProjects = (projects || []).filter((project) => project.course_id === enrollment.course_id);
      const checked = courseProjects.filter((project) => submitted.get(project.id)?.status === 'graded');
      const cv = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(profile?.full_name || me.full_name)} - ${esc(enrollment.course.category || enrollment.course.title)} CV</title><style>body{font:16px Arial,sans-serif;color:#17212b;max-width:850px;margin:40px auto;line-height:1.55;padding:0 24px}h1,h2{margin-bottom:6px}header{border-bottom:3px solid #17212b;padding-bottom:14px}.muted{color:#586571}li{margin:8px 0}@media print{button{display:none}}</style><header><h1>${esc(profile?.full_name || me.full_name || 'Student')}</h1><p>${esc(profile?.email || me.email)} · ${esc(profile?.phone || '')} · ${esc(profile?.address || '')}</p><h2>Target field: ${esc(enrollment.course.category || enrollment.course.title)}</h2></header><h2>Professional profile</h2><p>${esc(profile?.interest || `Learner specializing in ${enrollment.course.category || enrollment.course.title}, with practical project experience and structured course training.`)}</p><h2>Education and training</h2><p><strong>${esc(enrollment.course.title)}</strong> · Courssins Technology Institute</p><h2>Reviewed project experience</h2><ul>${checked.map((project) => `<li><strong>${esc(project.title)}</strong>${project.instructions ? ` — ${esc(project.instructions)}` : ''}${submitted.get(project.id)?.feedback ? `<br> Tutor review: ${esc(submitted.get(project.id).feedback)}` : ''}</li>`).join('') || '<li>Project work is in progress.</li>'}</ul><h2>Skills</h2><p>${esc(enrollment.course.category || enrollment.course.title)} · Project planning · Written communication · Digital collaboration</p><button onclick="window.print()">Print / save as PDF</button></html>`;
      const url = URL.createObjectURL(new Blob([cv], { type: 'text/html' }));
      return `<div class="panel"><div class="tools"><div class="grow"><h2>${esc(enrollment.course.title)} portfolio</h2><p class="muted">${checked.length}/${courseProjects.length} projects tutor-checked</p></div><a class="btn btn-lime btn-sm" href="${url}" target="_blank" rel="noopener">Generate / print tailored CV</a><a class="btn btn-outline btn-sm" href="${url}" download="${esc((profile?.full_name || 'student').replace(/[^a-z0-9]+/gi, '-'))}-${esc((enrollment.course.category || enrollment.course.title).replace(/[^a-z0-9]+/gi, '-'))}-CV.html">Download CV</a></div><div class="list">${courseProjects.map((project) => { const submission = submitted.get(project.id); return `<article class="list-item"><div class="grow"><h3>${esc(project.title)}</h3><p class="muted">${project.due_at ? `Due ${fmtDate(project.due_at)}` : 'No deadline set'} · ${submission?.status === 'graded' ? `Tutor checked · score ${submission.score}/${project.max_score}` : submission ? 'Submitted · awaiting tutor review' : 'Not submitted'}</p>${submission?.feedback ? `<p>${esc(submission.feedback)}</p>` : ''}</div></article>`; }).join('') || '<p class="muted">Your tutor has not assigned projects for this course yet.</p>'}</div></div>`;
    }).join('');
  };

  V['id-card'] = async function courseIdCards() {
    const en = await active(); if (!en.length) return empty('No course ID cards yet', 'Enroll in a course to receive its student ID card.');
    const [{ data: student }, { data: profile }] = await Promise.all([supabase.from('students').select('student_no').eq('user_id', me.id).single(), supabase.from('profiles').select('full_name,email,phone,address,avatar_url').eq('id', me.id).single()]);
    if (!student || !profile) return empty('Student ID unavailable', 'We could not load your student or profile information.');
    const xml = (value) => String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
    const cards = await Promise.all(en.map(async (enrollment) => { const { data: card, error } = await supabase.rpc('get_or_create_student_id_card', { p_course: enrollment.course_id }); return { enrollment, card, error }; }));
    return `<div class="list">${cards.map(({ enrollment, card, error }) => { if (error || !card) return `<div class="alert err">${esc(enrollment.course.title)} card unavailable: ${esc(error?.message || '')}</div>`; const signature = cfg.signature_url ? `<image href="${xml(cfg.signature_url)}" x="680" y="404" width="170" height="54" preserveAspectRatio="xMidYMid meet"/>` : ''; const issued = fmtDate(card.issued_at, { day: 'numeric', month: 'short', year: 'numeric' }); const avatar = profile.avatar_url ? `<image href="${xml(profile.avatar_url)}" x="34" y="74" width="160" height="180" preserveAspectRatio="xMidYMid slice"/>` : ''; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" rx="30" fill="#f9fbf5"/><rect width="900" height="96" rx="30" fill="#17212b"/><text x="34" y="60" fill="#fff" font-family="Arial" font-size="30">COURSSINS TECHNOLOGY INSTITUTE</text>${avatar}<text x="230" y="145" fill="#5e6b74" font-family="Arial" font-size="18">STUDENT · ${xml(student.student_no)}</text><text x="230" y="190" fill="#17212b" font-family="Arial" font-size="34" font-weight="700">${xml(profile.full_name)}</text><text x="230" y="236" font-family="Arial" font-size="20">${xml(profile.email)}</text><text x="230" y="272" font-family="Arial" font-size="20">${xml(profile.phone || 'No phone')}</text><text x="230" y="308" font-family="Arial" font-size="20">${xml(profile.address || '')}</text><text x="34" y="350" font-family="Arial" font-size="20">Course: ${xml(enrollment.course.title)}</text><path d="M34 380H866" stroke="#d7ded4"/><text x="34" y="435" font-family="Arial" font-size="22">${xml(card.card_number)} · Issued ${xml(issued)} · ${xml(card.status.toUpperCase())}</text>${signature}<path d="M680 468H850" stroke="#17212b"/><text x="680" y="495" font-family="Arial" font-size="14">${xml(cfg.signatory_name || 'Abdulmannan Sulayman')}</text><text x="680" y="515" font-family="Arial" font-size="13">${xml(cfg.signatory || 'Director of Studies')}</text></svg>`; const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })); return `<div class="panel"><h3>${esc(enrollment.course.title)}</h3><p class="muted">Card status: ${esc(card.status)}</p><img src="${url}" alt="${esc(enrollment.course.title)} student ID card" style="display:block;width:100%;max-width:720px;margin:14px 0;border-radius:12px;border:1px solid var(--line)"><a class="btn btn-lime" href="${url}" download="${esc(card.card_number)}.svg">${icon('download', '', 16)} Download course ID card</a></div>`; }).join('')}</div>`;
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
    const t = e.target.closest('[data-tab],[data-go],[data-lesson],[data-assign],[data-exam],[data-claim],[data-cert],[data-readall],[data-notice-read],[data-react-post],[data-book-event]'); if (!t) return;
    if (t.dataset.tab) return void show(t.dataset.tab);
    if (t.dataset.go) return void show(t.dataset.go, t.dataset.course);
    if (t.dataset.lesson) return location.assign(`learn.html?lesson=${encodeURIComponent(t.dataset.lesson)}`);
    if (t.dataset.assign) return openAssignment(t.dataset.assign);
    if (t.dataset.exam) return openExam(t.dataset.exam);
    if (t.dataset.claim) { setBusy(t, true, 'Issuing'); const { error } = await supabase.rpc('claim_certificate', { p_course: t.dataset.claim }); if (error) { setBusy(t, false); return toast(error.message, 'err'); } toast('Certificate issued', 'ok'); return void show('certificates'); }
    if (t.dataset.cert) return openCert(t.dataset.cert);
    if (t.dataset.readall) { await supabase.from('notifications').update({ read: true }).eq('user_id', me.id).eq('read', false); return void show('notifications'); }
    if (t.dataset.noticeRead) { const { error } = await supabase.from('notifications').update({ read: true }).eq('id', t.dataset.noticeRead).eq('user_id', me.id); if (error) return toast(error.message, 'err'); return void show('notifications'); }
    if (t.dataset.reactPost) { const { error } = await supabase.from('tutor_group_reactions').insert({ post_id: t.dataset.reactPost, user_id: me.id, reaction: t.dataset.reaction }); if (error && !/duplicate key/i.test(error.message)) return toast(error.message, 'err'); return void show('discussions'); }
    if (t.dataset.bookEvent) {
      setBusy(t, true, 'Booking'); const { data, error } = await supabase.rpc('book_event_ticket', { p_event: t.dataset.bookEvent });
      if (error) { setBusy(t, false); return toast(error.message, 'err'); }
      if (data.status === 'valid') { toast(`Ticket booked: ${data.ticket_code}`, 'ok'); return void show('tickets'); }
      if (!CONFIG.PAYMENT_INIT_URL) { setBusy(t, false); return modal({ title: 'Ticket payment pending', body: `<p>Your ticket code is <strong>${esc(data.ticket_code)}</strong>. Payment has not been configured.</p><p>Payment reference: ${esc(data.reference)} · ${money(data.amount, data.currency)}</p>` }); }
      try { const { data: auth } = await supabase.auth.getSession(); const response = await fetch(CONFIG.PAYMENT_INIT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session.access_token}` }, body: JSON.stringify({ reference: data.reference, callback_url: `${location.origin}/dashboard.html#tickets` }) }); const result = await response.json(); if (!response.ok || !result.authorization_url) throw new Error(result.error || 'Ticket payment could not start'); location.assign(result.authorization_url); }
      catch (paymentError) { setBusy(t, false); toast(paymentError.message || 'Ticket payment could not start.', 'err'); }
    }
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'lsCourse') show('lessons', e.target.value); });
  function openAssignment(id) {
    const a = S.assign.find((x) => x.id === id), s = S.subs[id]; const locked = s?.status === 'graded';
    const m = modal({ title: a.title, body: `<p class="muted" style="margin-bottom:16px">${esc(a.instructions)}</p>${a.due_at ? `<p class="alert info">${a.is_project ? "Project" : "Assignment"} deadline: ${fmtDate(a.due_at)}</p>` : ""}<form id="asForm"><div class="field"><label for="asText">Your answer</label><textarea class="input" id="asText" ${locked ? 'disabled' : ''} maxlength="8000">${esc(s?.content || '')}</textarea></div><div class="field"><label for="asLink">Link to your work (optional)</label><input class="input" id="asLink" type="url" placeholder="https://" value="${esc(s?.link_url || '')}" ${locked ? 'disabled' : ''}></div><div class="field"><label for="asFile">Upload answer file (optional, up to 50 MB)</label><input class="input" id="asFile" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*,video/*" ${locked ? 'disabled' : ''}>${s?.file_path ? `<span class="hint">A file is already submitted. Selecting a replacement will replace it after save.</span>` : ''}</div></form>${locked ? `<div class="alert ok">Graded: ${s.score}/${a.max_score}. ${esc(s.feedback || '')}</div>` : ''}`, actions: locked ? '' : '<button class="btn btn-lime" id="asSave">Submit assignment</button>' });
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
    if (error || !attempt?.questions?.length) return toast(error?.message || 'This quiz has no questions yet.', 'err');
    const qs = attempt.questions;
    const expiresAt = new Date(attempt.expires_at).getTime();
    const m = modal({ title: x.title, wide: true, body: `<p class="muted" style="margin-bottom:8px">${esc(x.instructions || '')} Pass mark ${x.pass_mark}%.</p><p class="badge warn" id="examTimer" aria-live="polite"></p><form id="exForm">${qs.map((q, i) => `<fieldset class="q" style="border:1px solid var(--line)"><legend style="font-weight:700;padding:0 6px">${i + 1}. ${esc(q.question)}</legend>${arr(q.options).map((o, k) => `<label class="opt"><input type="radio" name="q_${q.id}" value="${k}"><span>${esc(o)}</span></label>`).join('')}</fieldset>`).join('')}</form><div id="exOut"></div>`, actions: '<button class="btn btn-lime" id="exSubmit">Submit quiz</button>' });
    const submitButton = m.el.querySelector('#exSubmit');
    let finished = false;
    const submitAttempt = async (automatic = false) => {
      if (finished) return;
      const answers = {};
      qs.forEach((q) => { const checked = m.el.querySelector(`input[name="q_${q.id}"]:checked`); if (checked) answers[q.id] = Number(checked.value); });
      if (!automatic && Object.keys(answers).length < qs.length && !confirm('Some questions are unanswered. Submit the quiz anyway?')) return;
      finished = true;
      clearInterval(timer);
      setBusy(submitButton, true, 'Submitting');
      const { data, error: submitError } = await supabase.rpc('submit_exam_attempt', { p_attempt: attempt.attempt_id, p_answers: answers });
      setBusy(submitButton, false);
      if (submitError) { finished = false; return toast(submitError.message, 'err'); }
      m.el.querySelector('#exForm').hidden = true;
      submitButton.hidden = true;
      const detail = data.expired ? 'Time expired; unanswered questions were marked incorrect.' : data.passed ? 'Well done.' : `You need ${data.pass_mark}% to pass. You can retake this quiz.`;
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
    const signature = /^https?:\/\//i.test(cfg.signature_url || '') ? `<img class="cert-signature" src="${esc(cfg.signature_url)}" alt="Signature of ${esc(cfg.signatory_name || 'Abdulmannan Sulayman')}">` : '';
    modal({ title: 'Certificate', wide: true, body: `<div class="cert"><div class="cert-in"><div><img src="assets/images/logo-mark.svg" width="54" height="54" alt="" style="margin:0 auto 8px"><h3>${esc(cfg.organisation || 'Courssins Technology Institute')}</h3><small>Certificate of Completion</small></div><div><small>This certifies that</small><div class="who">${esc(c.student_name)}</div><p style="margin-top:12px"><small>has successfully completed</small></p><h3>${esc(c.course_title)}</h3><small>Completed on ${fmtDate(c.completed_at, { day: 'numeric', month: 'long', year: 'numeric' })}</small></div><div style="width:100%"><div class="cert-sign"><div style="border:0;padding:0">${signature}<div style="border-top:1.5px solid var(--ink);padding-top:6px">${esc(cfg.signatory_name || 'Abdulmannan Sulayman')}<br><small>${esc(cfg.signatory || 'Director of Studies')}</small></div></div><div>${esc(c.certificate_number)}<br><small>Certificate number</small></div></div><p style="margin-top:12px"><small>Verify at ${esc(url)}</small></p></div></div></div>`, actions: `<a class="btn btn-outline" href="${esc(url)}" target="_blank" rel="noopener">Open verification page</a><button class="btn btn-lime" onclick="window.print()">Print or save as PDF</button>` });
  }
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'profForm') {
      e.preventDefault(); const btn = e.target.querySelector('button'); setBusy(btn, true, 'Saving');
      const upd = { full_name: $('pName').value.trim(), phone: $('pPhone').value.trim(), country: $('pCountry').value.trim(), address: $('pAddress').value.trim() };
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
