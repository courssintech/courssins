begin;

alter table public.exams
  add column if not exists module_id uuid references public.course_modules(id) on delete cascade,
  add column if not exists is_final boolean not null default false;
update public.exams set is_final = true where module_id is null and not is_final;
alter table public.course_resources
  add column if not exists module_id uuid references public.course_modules(id) on delete set null;
alter table public.assignment_submissions
  add column if not exists file_path text;

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score numeric,
  passed boolean,
  created_at timestamptz not null default now()
);
create index if not exists idx_exam_attempts_user_exam on public.exam_attempts(user_id, exam_id, started_at desc);

alter table public.exam_results
  add column if not exists attempt_id uuid references public.exam_attempts(id) on delete set null;
create unique index if not exists idx_exam_results_attempt on public.exam_results(attempt_id) where attempt_id is not null;

create table if not exists public.course_discussions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.course_modules(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.course_discussions(id) on delete cascade,
  author_name text not null default '',
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_course_discussions_thread on public.course_discussions(course_id, lesson_id, created_at);

create or replace function public.set_course_discussion_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select coalesce(nullif(full_name, ''), 'Student') into new.author_name from public.profiles where id = new.user_id;
  end if;
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists course_discussion_author on public.course_discussions;
create trigger course_discussion_author before insert or update on public.course_discussions
for each row execute function public.set_course_discussion_author();

create table if not exists public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  button_text text,
  target_url text,
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.exam_attempts enable row level security;
alter table public.course_discussions enable row level security;
alter table public.advertisements enable row level security;

drop policy if exists exam_attempts_read on public.exam_attempts;
create policy exam_attempts_read on public.exam_attempts for select using (
  user_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.exams e where e.id = exam_id and public.owns_course(e.course_id)
  )
);
revoke all on table public.exam_attempts from public, anon, authenticated;
grant select on table public.exam_attempts to authenticated;

drop policy if exists course_discussions_read on public.course_discussions;
drop policy if exists course_discussions_insert on public.course_discussions;
drop policy if exists course_discussions_update on public.course_discussions;
drop policy if exists course_discussions_delete on public.course_discussions;
create policy course_discussions_read on public.course_discussions for select using (
  public.is_admin() or public.owns_course(course_id) or public.is_enrolled(course_id)
);
create policy course_discussions_insert on public.course_discussions for insert with check (
  user_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
  and (public.is_admin() or public.owns_course(course_id) or public.is_enrolled(course_id))
  and (parent_id is null or exists (
    select 1 from public.course_discussions parent
    where parent.id = course_discussions.parent_id
      and parent.course_id = course_discussions.course_id
      and parent.lesson_id is not distinct from course_discussions.lesson_id
  ))
);
create policy course_discussions_update on public.course_discussions for update using (
  user_id = auth.uid() or public.is_admin() or public.owns_course(course_id)
) with check (user_id = auth.uid() or public.is_admin() or public.owns_course(course_id));
create policy course_discussions_delete on public.course_discussions for delete using (
  public.is_admin() or public.owns_course(course_id) or user_id = auth.uid()
);

drop policy if exists advertisements_public_read on public.advertisements;
drop policy if exists advertisements_admin_manage on public.advertisements;
create policy advertisements_public_read on public.advertisements for select using (
  active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
);
create policy advertisements_admin_manage on public.advertisements for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists tutors_self_update on public.tutors;
create policy tutors_self_update on public.tutors for update using (
  user_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tutor' and p.is_active)
) with check (
  user_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tutor' and p.is_active)
);

drop policy if exists profiles_tutor_students_select on public.profiles;
create or replace function public.get_my_course_students()
returns table(student_id uuid, full_name text, email text, interest text, course_id uuid, course_title text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tutor' and p.is_active) then
    raise exception 'Only active tutors can view the course roster';
  end if;
  return query
    select p.id, p.full_name, p.email, p.interest, e.course_id, c.title, p.created_at
    from public.profiles p
    join public.enrollments e on e.user_id = p.id and e.status = 'active'
    join public.courses c on c.id = e.course_id
    where p.role = 'student' and p.is_active and public.owns_course(e.course_id)
    order by c.title, p.full_name;
end $$;
revoke all on function public.get_my_course_students() from public, anon, authenticated;
grant execute on function public.get_my_course_students() to authenticated;

drop policy if exists tutor_profile_media_insert on storage.objects;
drop policy if exists tutor_profile_media_update on storage.objects;
drop policy if exists tutor_profile_media_delete on storage.objects;
create policy tutor_profile_media_insert on storage.objects for insert with check (
  bucket_id = 'media' and name like ('tutors/' || auth.uid()::text || '/%')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tutor' and p.is_active)
);
create policy tutor_profile_media_update on storage.objects for update using (
  bucket_id = 'media' and name like ('tutors/' || auth.uid()::text || '/%')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tutor' and p.is_active)
) with check (
  bucket_id = 'media' and name like ('tutors/' || auth.uid()::text || '/%')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tutor' and p.is_active)
);
create policy tutor_profile_media_delete on storage.objects for delete using (
  bucket_id = 'media' and name like ('tutors/' || auth.uid()::text || '/%')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tutor' and p.is_active)
);

create or replace function public.module_is_unlocked(p_course uuid, p_module uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_user is distinct from auth.uid() and not public.is_admin() then false
    when p_module is null then true
    else exists (
    select 1 from public.course_modules current_module
    where current_module.id = p_module and current_module.course_id = p_course
      and not exists (
        select 1 from public.course_modules previous_module
        join public.exams previous_exam on previous_exam.module_id = previous_module.id
          and previous_exam.published and not previous_exam.is_final
        where previous_module.course_id = p_course and previous_module.position < current_module.position
          and not exists (select 1 from public.exam_results r where r.exam_id = previous_exam.id and r.user_id = p_user and r.passed)
      )
    )
  end
$$;
revoke all on function public.module_is_unlocked(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.module_is_unlocked(uuid, uuid, uuid) to authenticated;

create or replace function public.validate_course_module_reference() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.module_id is not null and not exists (
    select 1 from public.course_modules m where m.id = new.module_id and m.course_id = new.course_id
  ) then
    raise exception 'The selected module does not belong to this course';
  end if;
  if tg_table_name = 'exams' then
    if new.is_final and new.module_id is not null then raise exception 'Final assessments cannot be attached to a module'; end if;
    if not new.is_final and new.module_id is null then raise exception 'Choose a module or mark this as the final assessment'; end if;
  end if;
  return new;
end $$;
drop trigger if exists lessons_module_course_check on public.lessons;
create trigger lessons_module_course_check before insert or update of module_id, course_id on public.lessons
for each row execute function public.validate_course_module_reference();
drop trigger if exists assignments_module_course_check on public.assignments;
create trigger assignments_module_course_check before insert or update of module_id, course_id on public.assignments
for each row execute function public.validate_course_module_reference();
drop trigger if exists exams_module_course_check on public.exams;
create trigger exams_module_course_check before insert or update of module_id, course_id, is_final on public.exams
for each row execute function public.validate_course_module_reference();
drop trigger if exists resources_module_course_check on public.course_resources;
create trigger resources_module_course_check before insert or update of module_id, course_id on public.course_resources
for each row execute function public.validate_course_module_reference();

create or replace function public.validate_assignment_submission_file() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.file_path is not null and new.file_path not like ('submissions/' || new.user_id::text || '/' || new.assignment_id::text || '/%') then
    raise exception 'Submission files must be stored in the submitting students assignment folder';
  end if;
  return new;
end $$;
drop trigger if exists assignment_submission_file_check on public.assignment_submissions;
create trigger assignment_submission_file_check before insert or update of file_path, user_id, assignment_id on public.assignment_submissions
for each row execute function public.validate_assignment_submission_file();

drop policy if exists course_resources_read on public.course_resources;
create policy course_resources_read on public.course_resources for select using (
  public.is_admin() or public.owns_course(course_id)
  or (published and public.is_enrolled(course_id) and public.module_is_unlocked(course_id, module_id, auth.uid()))
);
drop policy if exists course_materials_read on storage.objects;
create policy course_materials_read on storage.objects for select using (
  bucket_id = 'course-materials' and exists (
    select 1 from public.course_resources r
    where r.object_path = name and (public.is_admin() or public.owns_course(r.course_id)
      or (r.published and public.is_enrolled(r.course_id) and public.module_is_unlocked(r.course_id, r.module_id, auth.uid())))
  )
);
drop policy if exists course_submission_upload on storage.objects;
drop policy if exists course_submission_read on storage.objects;
drop policy if exists course_submission_delete on storage.objects;
create policy course_submission_upload on storage.objects for insert with check (
  bucket_id = 'course-materials'
  and split_part(name, '/', 1) = 'submissions'
  and split_part(name, '/', 2) = auth.uid()::text
  and case when split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (select 1 from public.assignments a where a.id = split_part(name, '/', 3)::uuid and public.is_enrolled(a.course_id))
    else false end
);
create policy course_submission_read on storage.objects for select using (
  bucket_id = 'course-materials' and exists (
    select 1 from public.assignment_submissions s join public.assignments a on a.id = s.assignment_id
    where s.file_path = name and (s.user_id = auth.uid() or public.is_admin() or public.owns_course(a.course_id))
  )
);
create policy course_submission_delete on storage.objects for delete using (
  bucket_id = 'course-materials' and split_part(name, '/', 1) = 'submissions'
  and (split_part(name, '/', 2) = auth.uid()::text or public.is_admin())
  and case when split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_admin() or exists (
      select 1 from public.assignments a join public.assignment_submissions s on s.assignment_id = a.id
      where a.id = split_part(name, '/', 3)::uuid and s.user_id = auth.uid() and s.status = 'submitted' and s.score is null
        and public.is_enrolled(a.course_id)
    )
    else false end
);

drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select using (
  public.is_admin() or public.owns_course(course_id)
  or (is_preview and exists (select 1 from public.courses c where c.id = course_id and c.published))
  or (public.is_enrolled(course_id) and public.module_is_unlocked(course_id, module_id, auth.uid()))
);
drop policy if exists progress_insert on public.course_progress;
create policy progress_insert on public.course_progress for insert with check (
  user_id = auth.uid() and public.is_enrolled(course_id)
  and exists (select 1 from public.lessons l where l.id = course_progress.lesson_id and l.course_id = course_progress.course_id and public.module_is_unlocked(course_progress.course_id, l.module_id, auth.uid()))
);

create or replace function public._progress(p_course uuid, p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with t as (
    select (select count(*) from public.lessons where course_id = p_course) lt,
           (select count(*) from public.course_progress where course_id = p_course and user_id = p_user) ld,
           (select count(*) from public.assignments where course_id = p_course) at_,
           (select count(*) from public.assignment_submissions s join public.assignments a on a.id = s.assignment_id where a.course_id = p_course and s.user_id = p_user and s.status = 'graded' and s.score is not null) ad,
           (select count(*) from public.exams where course_id = p_course and published) et,
           (select count(distinct r.exam_id) from public.exam_results r join public.exams x on x.id = r.exam_id where x.course_id = p_course and x.published and r.user_id = p_user and r.passed) ed,
           (select count(*) from public.exams where course_id = p_course and published and is_final) ft,
           (select count(distinct r.exam_id) from public.exam_results r join public.exams x on x.id = r.exam_id where x.course_id = p_course and x.published and x.is_final and r.user_id = p_user and r.passed) fd
  )
  select jsonb_build_object('lessons_total', lt, 'lessons_done', ld, 'assignments_total', at_, 'assignments_done', ad,
    'exams_total', et, 'exams_passed', ed,
    'percent', case when lt+at_+et = 0 then 0 else round(100.0 * (ld+ad+ed) / (lt+at_+et)) end,
    'eligible', ft > 0 and fd = ft and (ld+ad+ed) = (lt+at_+et)) from t $$;
revoke all on function public._progress(uuid, uuid) from public, anon, authenticated;

create or replace function public.begin_exam(p_exam uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); x public.exams; mod_position int; attempt public.exam_attempts; qs jsonb;
begin
  if uid is null or not exists (select 1 from public.profiles p where p.id = uid and p.is_active) then
    raise exception 'Sign in with an active account to start an assessment';
  end if;
  select * into x from public.exams where id = p_exam and published;
  if not found or not public.is_enrolled(x.course_id) then raise exception 'Not enrolled in this course'; end if;

  if x.is_final then
    if exists (
      select 1 from public.lessons l
      where l.course_id = x.course_id and not exists (
        select 1 from public.course_progress cp where cp.user_id = uid and cp.lesson_id = l.id
      )
    ) then raise exception 'Complete all course sections before the final assessment'; end if;
    if exists (
      select 1 from public.exams module_exam
      where module_exam.course_id = x.course_id and module_exam.module_id is not null
        and not module_exam.is_final and module_exam.published
        and not exists (select 1 from public.exam_results er where er.exam_id = module_exam.id and er.user_id = uid and er.passed)
    ) then raise exception 'Pass every module assessment before the final assessment'; end if;
  else
    if x.module_id is null then raise exception 'This assessment is not attached to a module'; end if;
    select position into mod_position from public.course_modules where id = x.module_id and course_id = x.course_id;
    if mod_position is null then raise exception 'Assessment module not found'; end if;
    if exists (
      select 1 from public.lessons l
      where l.course_id = x.course_id and l.module_id = x.module_id and not exists (
        select 1 from public.course_progress cp where cp.user_id = uid and cp.lesson_id = l.id
      )
    ) then raise exception 'Complete every section in this module before its assessment'; end if;
    if exists (
      select 1 from public.course_modules previous
      join public.exams previous_exam on previous_exam.module_id = previous.id and previous_exam.published and not previous_exam.is_final
      where previous.course_id = x.course_id and previous.position < mod_position
        and not exists (select 1 from public.exam_results er where er.exam_id = previous_exam.id and er.user_id = uid and er.passed)
    ) then raise exception 'Pass the previous module assessment first'; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options, 'position', q.position) order by q.position), '[]'::jsonb)
    into qs from public.exam_questions q where q.exam_id = p_exam;
  if jsonb_array_length(qs) = 0 then raise exception 'This assessment has no questions yet'; end if;
  if x.is_final and jsonb_array_length(qs) <> 15 then raise exception 'The final assessment must contain 15 questions'; end if;
  if not x.is_final and jsonb_array_length(qs) <> 7 then raise exception 'A module assessment must contain 7 questions'; end if;

  insert into public.exam_attempts (exam_id, user_id, expires_at)
  values (p_exam, uid, now() + make_interval(mins => greatest(x.duration_min, 1)))
  returning * into attempt;
  return jsonb_build_object('attempt_id', attempt.id, 'started_at', attempt.started_at, 'expires_at', attempt.expires_at, 'duration_min', x.duration_min, 'questions', qs);
end $$;

create or replace function public.submit_exam_attempt(p_attempt uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); attempt public.exam_attempts; x public.exams; total int; correct int; score_value numeric; passed_value boolean; answers jsonb;
begin
  if uid is null or not exists (select 1 from public.profiles p where p.id = uid and p.is_active) then
    raise exception 'Sign in with an active account to submit an assessment';
  end if;
  select * into attempt from public.exam_attempts where id = p_attempt and user_id = uid for update;
  if not found then raise exception 'Assessment attempt not found'; end if;
  select * into x from public.exams where id = attempt.exam_id and published;
  if not found or not public.is_enrolled(x.course_id) then raise exception 'Not enrolled in this course'; end if;
  if attempt.submitted_at is not null then
    return jsonb_build_object('score', attempt.score, 'passed', attempt.passed, 'pass_mark', x.pass_mark, 'already_submitted', true);
  end if;

  answers := case when now() > attempt.expires_at + interval '10 seconds' then '{}'::jsonb else coalesce(p_answers, '{}'::jsonb) end;
  select count(*), count(*) filter (where (answers ->> q.id::text) ~ '^[0-9]+$' and (answers ->> q.id::text)::int = q.correct_index)
    into total, correct from public.exam_questions q where q.exam_id = x.id;
  if total = 0 then raise exception 'This assessment has no questions'; end if;
  score_value := round(100.0 * correct / total, 1);
  passed_value := score_value >= x.pass_mark;

  insert into public.exam_results (exam_id, user_id, score, passed, attempt_id)
  values (x.id, uid, score_value, passed_value, attempt.id);
  update public.exam_attempts set submitted_at = now(), score = score_value, passed = passed_value where id = attempt.id;
  return jsonb_build_object('score', score_value, 'passed', passed_value, 'pass_mark', x.pass_mark, 'expired', now() > attempt.expires_at + interval '10 seconds');
end $$;

revoke all on function public.begin_exam(uuid) from public, anon, authenticated;
revoke all on function public.submit_exam_attempt(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.begin_exam(uuid) to authenticated;
grant execute on function public.submit_exam_attempt(uuid, jsonb) to authenticated;
revoke all on function public.get_exam_questions(uuid) from public, anon, authenticated;
revoke all on function public.submit_exam(uuid, jsonb) from public, anon, authenticated;

commit;
