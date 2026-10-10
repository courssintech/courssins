import { supabase, configured, requireAuth } from './supabase.js';
import { esc, qs, icon, toast, setBusy, empty, fmtDate, arr } from './ui.js';

const root = document.getElementById('learnRoot');
if (!configured) {
  root.innerHTML = empty('Learning is not connected yet', 'Connect Supabase before opening course sections.');
} else {
  const me = await requireAuth();
  const lessonId = qs('lesson');
  const { data: lesson, error } = await supabase.from('lessons').select('*, course:courses(id,title,slug), module:course_modules(id,title,position)').eq('id', lessonId).maybeSingle();
  if (error || !lesson) {
    root.innerHTML = empty('Section unavailable', 'This section is unavailable or locked. Open your course dashboard to continue.', '<a class="btn btn-lime" href="dashboard.html#courses">My courses</a>');
  } else {
    const { data: enrollment } = await supabase.from('enrollments').select('status').eq('course_id', lesson.course_id).eq('user_id', me.id).maybeSingle();
    if (enrollment?.status !== 'active') {
      root.innerHTML = empty('Course access required', 'Enrol in this course to read the notes, watch the lesson, and join its discussion.', `<a class="btn btn-lime" href="course.html?id=${encodeURIComponent(lesson.course?.slug || '')}">View course</a>`);
    } else {
      const [{ data: lessons }, { data: modules }, { data: progress }] = await Promise.all([
        supabase.from('lessons').select('*').eq('course_id', lesson.course_id).order('position'),
        supabase.from('course_modules').select('id,title,position').eq('course_id', lesson.course_id).order('position'),
        supabase.from('course_progress').select('lesson_id').eq('course_id', lesson.course_id).eq('user_id', me.id),
      ]);
      const sections = lessons || [];
      const done = new Set((progress || []).map((row) => row.lesson_id));
      const moduleRows = modules || [];
      const modulePositions = new Map(moduleRows.map((module) => [module.id, module.position]));
      sections.sort((a, b) => (modulePositions.get(a.module_id) ?? Number.MAX_SAFE_INTEGER) - (modulePositions.get(b.module_id) ?? Number.MAX_SAFE_INTEGER) || a.position - b.position);
      const currentIndex = sections.findIndex((row) => row.id === lesson.id);
      const next = sections[currentIndex + 1];
      const previous = sections[currentIndex - 1];
      const moduleSections = (module) => sections.filter((row) => row.module_id === module.id);
      const nav = moduleRows.map((module, index) => `<details class="acc" ${module.id === lesson.module_id ? 'open' : ''}><summary>Module ${module.position}: ${esc(module.title)}</summary><div class="acc-body">${moduleSections(module).map((row) => `<a class="list-item" style="display:flex;gap:10px;align-items:center;color:inherit;text-decoration:none;${row.id === lesson.id ? 'border-color:var(--lime);background:#fbfff0' : ''}" href="learn.html?lesson=${row.id}"><span class="dot">${done.has(row.id) ? icon('check', '', 14) : ''}</span><span class="grow">${esc(row.title)}</span>${row.duration_min ? `<span class="muted">${row.duration_min} min</span>` : ''}</a>`).join('') || '<p class="muted">Sections will appear here.</p>'}</div></details>`).join('');
      const renderThreads = (items) => items.filter((row) => !row.parent_id).map((row) => `<article class="discussion-thread"><div class="discussion-avatar">${esc((row.author_name || 'S').trim().slice(0, 1).toUpperCase())}</div><div class="discussion-message"><header><strong>${esc(row.author_name || 'Student')}</strong><time>${fmtDate(row.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></header><p>${esc(row.body)}</p><button type="button" class="discussion-reply" data-reply="${row.id}">Reply</button>${items.filter((reply) => reply.parent_id === row.id).map((reply) => `<div class="discussion-reply-row"><div class="discussion-avatar small">${esc((reply.author_name || 'S').trim().slice(0, 1).toUpperCase())}</div><div><header><strong>${esc(reply.author_name || 'Student')}</strong><time>${fmtDate(reply.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></header><p>${esc(reply.body)}</p></div></div>`).join('')}</div></article>`).join('');

      async function render() {
        const [{ data: comments, error: commentError }, { data: signed }] = await Promise.all([
          supabase.from('course_discussions').select('*').eq('lesson_id', lesson.id).order('created_at'),
          lesson.video_path ? supabase.storage.from('course-materials').createSignedUrl(lesson.video_path, 3600) : Promise.resolve({ data: null }),
        ]);
        if (commentError) return root.innerHTML = empty('Discussion unavailable', 'Refresh the page and try again.');
        const videoUrl = signed?.signedUrl || lesson.video_url || '';
        const video = (() => {
          if (!/^https?:\/\//i.test(videoUrl)) return '<p class="muted">Your tutor has not added a video for this section yet.</p>';
          try {
            const url = new URL(videoUrl);
            if (signed?.signedUrl || /\.(mp4|webm|ogg)$/i.test(url.pathname)) return `<video controls playsinline preload="metadata" style="display:block;width:100%;max-height:620px;background:#080a08;border-radius:var(--r-lg)"><source src="${esc(url.href)}"></video>`;
            const youtubeId = url.hostname.endsWith('youtu.be') ? url.pathname.slice(1) : ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) ? url.searchParams.get('v') : null;
            if (youtubeId && /^[A-Za-z0-9_-]{11}$/.test(youtubeId)) return `<div style="aspect-ratio:16/9"><iframe src="https://www.youtube-nocookie.com/embed/${youtubeId}" title="${esc(lesson.title)}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen loading="lazy" style="width:100%;height:100%;border:0;border-radius:var(--r-lg)"></iframe></div>`;
            const vimeoId = url.hostname === 'vimeo.com' || url.hostname === 'www.vimeo.com' ? url.pathname.split('/').filter(Boolean)[0] : url.hostname === 'player.vimeo.com' ? url.pathname.split('/').filter(Boolean)[1] : null;
            if (vimeoId && /^\d+$/.test(vimeoId)) return `<div style="aspect-ratio:16/9"><iframe src="https://player.vimeo.com/video/${vimeoId}" title="${esc(lesson.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" style="width:100%;height:100%;border:0;border-radius:var(--r-lg)"></iframe></div>`;
            return `<a class="btn btn-outline" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${icon('video', '', 16)} Open lesson video</a>`;
          } catch { return '<p class="muted">This lesson video link is not valid.</p>'; }
        })();
        const rows = comments || [];
        root.innerHTML = `<nav class="crumbs" aria-label="Breadcrumb"><a href="dashboard.html#courses">My courses</a><span>/</span><a href="course.html?id=${encodeURIComponent(lesson.course?.slug || '')}">${esc(lesson.course?.title || 'Course')}</a><span>/</span><span>${esc(lesson.title)}</span></nav>
        <div class="grid grid-2" style="align-items:start;margin-top:24px"><article><span class="chip">Module ${lesson.module?.position || ''}: ${esc(lesson.module?.title || '')}</span><h1 style="margin:14px 0 20px">${esc(lesson.title)}</h1><div style="margin-bottom:24px">${video}</div><section class="block"><h2>Lesson notes</h2><div class="prose" style="max-width:none">${(lesson.content || 'Your tutor has not added notes for this section yet.').split(/\n{2,}/).map((part) => `<p>${esc(part)}</p>`).join('')}</div></section>
        <section class="block discussion-panel"><div class="discussion-heading"><div><span class="eyebrow">LEARN TOGETHER</span><h2>Section discussion</h2><p class="muted">Ask a question or share a useful insight with your cohort.</p></div><span class="discussion-live"><i></i> Live</span></div><div id="discussionThreads" class="discussion-threads">${renderThreads(rows) || '<p class="discussion-empty">No posts yet. Start the conversation with a question or insight.</p>'}</div><form id="discussionForm" class="discussion-composer"><input id="discussionParent" type="hidden"><div id="replyingTo" class="discussion-replying" hidden></div><div class="field"><label for="discussionBody">Your message</label><textarea class="input" id="discussionBody" maxlength="4000" placeholder="Write a message to your course community…" required></textarea></div><div class="discussion-composer-footer"><span class="muted">Keep it respectful and relevant to this section.</span><button class="btn btn-dark" type="submit">Post message ${icon('arrow-right', '', 15)}</button></div></form></section>
        <div class="tools" style="margin-top:24px"><a class="btn btn-outline" ${previous ? `href="learn.html?lesson=${previous.id}"` : 'href="dashboard.html#lessons"'}>Previous section</a><span class="grow"></span><button class="btn ${done.has(lesson.id) ? 'btn-outline' : 'btn-lime'}" id="markComplete">${done.has(lesson.id) ? 'Completed' : 'Mark as completed'}</button><a class="btn btn-dark" ${next && done.has(lesson.id) ? `href="learn.html?lesson=${next.id}"` : 'aria-disabled="true" tabindex="-1" style="opacity:.55"'}>Next section ${icon('arrow-right', '', 16)}</a></div></article>
        <aside class="panel"><h2 style="margin-bottom:16px">Course content</h2>${nav}<a class="btn btn-outline btn-block" style="margin-top:16px" href="dashboard.html#courses">Back to My courses</a></aside></div>`;
        root.querySelector('#discussionForm').addEventListener('submit', async (event) => {
          event.preventDefault(); const body = root.querySelector('#discussionBody').value.trim(); if (!body) return;
          const parentId = root.querySelector('#discussionParent').value || null;
          const button = event.currentTarget.querySelector('button[type="submit"]'); setBusy(button, true, 'Posting');
          const { error: postError } = await supabase.from('course_discussions').insert({ course_id: lesson.course_id, module_id: lesson.module_id, lesson_id: lesson.id, user_id: me.id, parent_id: parentId, body });
          setBusy(button, false);
          if (postError) return toast('Could not post your message.', 'err');
          event.currentTarget.reset(); root.querySelector('#replyingTo').hidden = true; toast(parentId ? 'Reply posted' : 'Message posted', 'ok'); await updateDiscussion();
        });
        root.querySelectorAll('[data-reply]').forEach((button) => button.addEventListener('click', () => {
          const thread = rows.find((row) => row.id === button.dataset.reply);
          root.querySelector('#discussionParent').value = button.dataset.reply;
          const replyTo = root.querySelector('#replyingTo'); replyTo.hidden = false; replyTo.innerHTML = `Replying to <strong>${esc(thread?.author_name || 'Student')}</strong> <button type="button" id="cancelReply" aria-label="Cancel reply">Cancel</button>`;
          root.querySelector('#cancelReply').addEventListener('click', () => { root.querySelector('#discussionParent').value = ''; replyTo.hidden = true; });
          root.querySelector('#discussionBody').focus();
        }));
        root.querySelector('#markComplete').addEventListener('click', async (event) => {
          if (done.has(lesson.id)) return;
          setBusy(event.currentTarget, true, 'Saving');
          const { error: progressError } = await supabase.from('course_progress').insert({ user_id: me.id, course_id: lesson.course_id, lesson_id: lesson.id });
          if (progressError) { setBusy(event.currentTarget, false); return toast(progressError.message, 'err'); }
          done.add(lesson.id); toast('Section completed', 'ok');
          const moduleLessons = sections.filter((row) => row.module_id === lesson.module_id);
          const moduleDone = moduleLessons.length > 0 && moduleLessons.every((row) => done.has(row.id));
          if (moduleDone) {
            const { data: quiz } = await supabase.from('exams').select('id,title,is_final,module_id').eq('course_id', lesson.course_id).eq('module_id', lesson.module_id).eq('published', true).eq('is_final', false).maybeSingle();
            if (quiz) return startQuiz(quiz, next);
          }
          if (next) return location.assign(`learn.html?lesson=${next.id}`);
          await render();
        });
      }
      async function updateDiscussion() {
        const { data, error: discussionError } = await supabase.from('course_discussions').select('*').eq('lesson_id', lesson.id).order('created_at');
        if (discussionError || !root.querySelector('#discussionThreads')) return;
        const items = data || [];
        root.querySelector('#discussionThreads').innerHTML = renderThreads(items) || '<p class="discussion-empty">No posts yet. Start the conversation with a question or insight.</p>';
        root.querySelectorAll('[data-reply]').forEach((button) => button.addEventListener('click', () => {
          const thread = items.find((row) => row.id === button.dataset.reply);
          root.querySelector('#discussionParent').value = button.dataset.reply;
          const replyTo = root.querySelector('#replyingTo'); replyTo.hidden = false; replyTo.innerHTML = `Replying to <strong>${esc(thread?.author_name || 'Student')}</strong> <button type="button" id="cancelReply" aria-label="Cancel reply">Cancel</button>`;
          root.querySelector('#cancelReply').addEventListener('click', () => { root.querySelector('#discussionParent').value = ''; replyTo.hidden = true; });
          root.querySelector('#discussionBody').focus();
        }));
      }

      async function startQuiz(quiz, nextLesson) {
        const { data: attempt, error: beginError } = await supabase.rpc('begin_exam', { p_exam: quiz.id });
        if (beginError || !attempt?.questions?.length) {
          const reason = beginError?.message || 'This quiz has no questions yet. Ask your tutor to publish its questions, then try again.';
          root.innerHTML = `<div class="panel"><a href="learn.html?lesson=${lesson.id}">← Return to ${esc(lesson.title)}</a><h1 style="margin:14px 0">${esc(quiz.title)}</h1><div class="alert err">${esc(reason)}</div><p class="muted">Your module progress is saved. You can open this quiz again from your student board.</p><a class="btn btn-dark" href="dashboard.html#lessons">Back to my lessons</a></div>`;
          return;
        }
        const questions = attempt.questions;
        const expiresAt = new Date(attempt.expires_at).getTime();
        const body = `<p class="muted">${quiz.is_final ? 'Final course quiz' : 'Module quiz'} · ${attempt.duration_min || quiz.duration_min || 13} minutes</p><p class="badge warn" id="quizTimer" aria-live="polite"></p><form id="quizForm">${questions.map((question, index) => `<fieldset class="q" style="border:1px solid var(--line)"><legend style="font-weight:700;padding:0 6px">${index + 1}. ${esc(question.question)}</legend>${arr(question.options).map((option, choice) => `<label class="opt"><input type="radio" name="q_${question.id}" value="${choice}"><span>${esc(option)}</span></label>`).join('')}</fieldset>`).join('')}</form><div id="quizResult"></div>`;
        root.innerHTML = `<div class="panel"><a href="learn.html?lesson=${lesson.id}">← Return to ${esc(lesson.title)}</a><h1 style="margin:14px 0">${esc(quiz.title)}</h1>${body}<button class="btn btn-lime" id="submitQuiz" type="button">Submit quiz</button></div>`;
        const submitButton = root.querySelector('#submitQuiz'); let finished = false;
        const submit = async (automatic = false) => {
          if (finished) return; const answers = {};
          questions.forEach((question) => { const selected = root.querySelector(`input[name="q_${question.id}"]:checked`); if (selected) answers[question.id] = Number(selected.value); });
          if (!automatic && Object.keys(answers).length < questions.length && !confirm('Some questions are unanswered. Submit anyway?')) return;
          finished = true; clearInterval(timer); setBusy(submitButton, true, 'Submitting');
          const { data, error: submitError } = await supabase.rpc('submit_exam_attempt', { p_attempt: attempt.attempt_id, p_answers: answers });
          setBusy(submitButton, false); if (submitError) { finished = false; return toast(submitError.message, 'err'); }
          root.querySelector('#quizForm').hidden = true; submitButton.hidden = true;
          root.querySelector('#quizResult').innerHTML = `<div class="alert ${data.passed ? 'ok' : 'err'}"><strong>${data.passed ? 'Passed' : 'Not passed'}: ${data.score}%</strong><br>${data.expired ? 'Time expired; unanswered questions count as incorrect.' : data.passed ? 'Well done.' : `You need ${data.pass_mark}% to pass. You can retake the quiz.`}</div>${data.passed ? `<button class="btn btn-dark" id="continueLearning">${nextLesson ? 'Continue to next section' : quiz.is_final ? 'Go to certificates' : 'Continue learning'}</button>` : '<button class="btn btn-outline" id="retakeQuiz">Retake quiz</button>'}`;
          root.querySelector('#continueLearning')?.addEventListener('click', async () => {
            if (nextLesson) return location.assign(`learn.html?lesson=${nextLesson.id}`);
            if (quiz.is_final) return location.assign('dashboard.html#certificates');
            const { data: finalQuiz } = await supabase.from('exams').select('id,title,is_final,module_id').eq('course_id', lesson.course_id).eq('is_final', true).eq('published', true).maybeSingle();
            if (finalQuiz) return startQuiz(finalQuiz, null);
            location.assign('dashboard.html#quizzes');
          });
          root.querySelector('#retakeQuiz')?.addEventListener('click', () => startQuiz(quiz, nextLesson));
        };
        const updateTimer = () => { const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)); root.querySelector('#quizTimer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} remaining`; if (!seconds) submit(true); };
        const timer = setInterval(updateTimer, 1000); updateTimer(); submitButton.addEventListener('click', () => submit(false));
      }
      await render();
      const discussionChannel = supabase.channel(`lesson-discussion-${lesson.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'course_discussions', filter: `lesson_id=eq.${lesson.id}` }, updateDiscussion).subscribe();
      window.addEventListener('pagehide', () => { supabase.removeChannel(discussionChannel); }, { once: true });
    }
  }
}
