begin;

-- Scheduled course launch. Modules remain visible as public course outlines;
-- lesson content, resources, and uploads unlock on the tutor-selected date.
alter table public.courses add column if not exists lessons_start_at timestamptz;
alter table public.assignments add column if not exists is_project boolean not null default false;
alter table public.assignments add column if not exists due_at timestamptz;

drop policy if exists courses_tutor_schedule on public.courses;
create policy courses_tutor_schedule on public.courses for update using(public.owns_course(id)) with check(public.owns_course(id));
grant update on public.courses to authenticated;
create or replace function public.protect_tutor_course_schedule() returns trigger
language plpgsql set search_path=public as $$
begin
 if not public.is_admin() and (not public.owns_course(old.id) or (to_jsonb(new)-'lessons_start_at') is distinct from (to_jsonb(old)-'lessons_start_at')) then
   raise exception 'Tutors may only change the lesson start date on courses assigned to them';
 end if;
 return new;
end $$;
drop trigger if exists tutor_course_schedule_only on public.courses;
create trigger tutor_course_schedule_only before update on public.courses
for each row execute function public.protect_tutor_course_schedule();

create or replace function public.notify_course_enrollment() returns trigger
language plpgsql security definer set search_path=public as $$
declare course_title text; start_at timestamptz; message text;
begin
  select title, lessons_start_at into course_title, start_at from public.courses where id=new.course_id;
  message := case when start_at is null
    then 'Your enrollment in '||course_title||' is recorded. Your tutor has not announced the lesson start date yet. Course outlines are available in My courses.'
    when start_at > now()
    then 'Your enrollment in '||course_title||' is recorded. Lessons and learning materials will be available starting '||to_char(start_at at time zone 'UTC','FMMonth FMDD, YYYY "at" HH12:MI AM "UTC"')||'. Course outlines are available now.'
    else 'Your enrollment in '||course_title||' is active. Lessons and learning materials are available in My courses.' end;
  insert into public.notifications(user_id,title,body,link)
  values(new.user_id,'Course enrollment and start date',message,'dashboard.html#courses');
  return new;
end $$;
drop trigger if exists course_enrollment_notification on public.enrollments;
create trigger course_enrollment_notification after insert on public.enrollments
for each row execute function public.notify_course_enrollment();

create or replace function public.notify_course_start_date_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.lessons_start_at is distinct from old.lessons_start_at then
    insert into public.notifications(user_id,title,body,link)
    select e.user_id,'Course start date updated',
      case when new.lessons_start_at is null then 'The tutor has not set a lesson start date for '||new.title||'. Course outlines remain available in My courses.'
      else 'Lessons and learning materials for '||new.title||' will be available starting '||to_char(new.lessons_start_at at time zone 'UTC','FMMonth FMDD, YYYY "at" HH12:MI AM "UTC"')||'. Course outlines remain available now.' end,
      'dashboard.html#courses'
    from public.enrollments e where e.course_id=new.id and e.status in ('active','pending');
  end if;
  return new;
end $$;
drop trigger if exists course_start_date_notification on public.courses;
create trigger course_start_date_notification after update of lessons_start_at on public.courses
for each row execute function public.notify_course_start_date_change();

drop function if exists public.post_tutor_group_assignment(uuid,text,text,text);
create or replace function public.post_tutor_group_assignment(
  p_group uuid,p_title text,p_instructions text,p_attachment_url text default null,
  p_is_project boolean default false,p_due_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare g public.tutor_groups; assignment_key uuid; next_position integer;
begin
  select * into g from public.tutor_groups where id=p_group;
  if not found or not (g.owner_id=auth.uid() and public.owns_course(g.course_id)) then raise exception 'Only the assigned course tutor can post an assignment'; end if;
  if length(trim(coalesce(p_title,'')))<2 then raise exception 'Assignment title is required'; end if;
  select coalesce(max(position),0)+1 into next_position from public.assignments where course_id=g.course_id;
  insert into public.assignments(course_id,title,instructions,max_score,position,attachment_url,is_project,due_at)
  values(g.course_id,trim(p_title),nullif(trim(p_instructions),''),100,next_position,p_attachment_url,p_is_project,p_due_at) returning id into assignment_key;
  insert into public.tutor_group_posts(group_id,author_id,post_type,title,body,attachment_url,assignment_id)
  values(g.id,auth.uid(),'assignment',trim(p_title),coalesce(nullif(trim(p_instructions),''),trim(p_title)),p_attachment_url,assignment_key);
  return assignment_key;
end $$;
revoke all on function public.post_tutor_group_assignment(uuid,text,text,text,boolean,timestamptz) from public,anon;
grant execute on function public.post_tutor_group_assignment(uuid,text,text,text,boolean,timestamptz) to authenticated;

-- Keep course outlines public, but gate lesson pages and learning resources until launch.
drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select using (
  public.is_admin() or public.owns_course(course_id)
  or (is_preview and exists(select 1 from public.courses c where c.id=course_id and c.published and (c.lessons_start_at is null or c.lessons_start_at<=now())))
  or (public.is_enrolled(course_id) and exists(select 1 from public.courses c where c.id=course_id and (c.lessons_start_at is null or c.lessons_start_at<=now())) and public.module_is_unlocked(course_id,module_id,auth.uid()))
);
drop policy if exists course_resources_read on public.course_resources;
create policy course_resources_read on public.course_resources for select using (
  public.is_admin() or public.owns_course(course_id)
  or (published and public.is_enrolled(course_id) and exists(select 1 from public.courses c where c.id=course_id and (c.lessons_start_at is null or c.lessons_start_at<=now())) and public.module_is_unlocked(course_id,module_id,auth.uid()))
);
drop policy if exists course_materials_read on storage.objects;
create policy course_materials_read on storage.objects for select using (
  bucket_id='course-materials' and exists(
    select 1 from public.course_resources r join public.courses c on c.id=r.course_id
    where r.object_path=name and (public.is_admin() or public.owns_course(r.course_id)
      or (r.published and public.is_enrolled(r.course_id) and (c.lessons_start_at is null or c.lessons_start_at<=now()) and public.module_is_unlocked(r.course_id,r.module_id,auth.uid())))
  )
);
drop policy if exists lesson_videos_read on storage.objects;
create policy lesson_videos_read on storage.objects for select using (
  bucket_id='course-materials' and exists(
    select 1 from public.lessons l join public.courses c on c.id=l.course_id
    where l.video_path=name and (public.is_admin() or public.owns_course(l.course_id)
      or (public.is_enrolled(l.course_id) and (c.lessons_start_at is null or c.lessons_start_at<=now()) and public.module_is_unlocked(l.course_id,l.module_id,auth.uid()))
      or (l.is_preview and c.published and (c.lessons_start_at is null or c.lessons_start_at<=now())))
  )
);

create or replace function public.enforce_assignment_deadline() returns trigger
language plpgsql security definer set search_path=public as $$
declare deadline timestamptz;
begin
  if auth.uid()=new.user_id and coalesce(new.status,'submitted')<>'graded' then
    select due_at into deadline from public.assignments where id=new.assignment_id;
    if deadline is not null and now()>deadline then raise exception 'The submission deadline has passed'; end if;
  end if;
  return new;
end $$;
drop trigger if exists assignment_submission_deadline on public.assignment_submissions;
create trigger assignment_submission_deadline before insert or update on public.assignment_submissions
for each row execute function public.enforce_assignment_deadline();

-- Projects share the existing submission and grading workflow. Certificate
-- eligibility additionally requires every project to be submitted and graded.
create or replace function public._progress(p_course uuid,p_user uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 with t as (
  select (select count(*) from public.lessons where course_id=p_course) lt,
         (select count(*) from public.course_progress where course_id=p_course and user_id=p_user) ld,
         (select count(*) from public.assignments where course_id=p_course) at_,
         (select count(*) from public.assignment_submissions s join public.assignments a on a.id=s.assignment_id where a.course_id=p_course and s.user_id=p_user and s.status='graded' and s.score is not null) ad,
         (select count(*) from public.exams where course_id=p_course and published) et,
         (select count(distinct r.exam_id) from public.exam_results r join public.exams x on x.id=r.exam_id where x.course_id=p_course and x.published and r.user_id=p_user and r.passed) ed,
         (select count(*) from public.exams where course_id=p_course and published and is_final) ft,
         (select count(distinct r.exam_id) from public.exam_results r join public.exams x on x.id=r.exam_id where x.course_id=p_course and x.published and x.is_final and r.user_id=p_user and r.passed) fd,
         (select count(*) from public.assignments where course_id=p_course and is_project) pt,
         (select count(*) from public.assignment_submissions s join public.assignments a on a.id=s.assignment_id where a.course_id=p_course and a.is_project and s.user_id=p_user and s.status='graded' and s.score is not null) pd
 )
 select jsonb_build_object('lessons_total',lt,'lessons_done',ld,'assignments_total',at_,'assignments_done',ad,
   'exams_total',et,'exams_passed',ed,'projects_total',pt,'projects_checked',pd,
   'percent',case when lt+at_+et=0 then 0 else round(100.0*(ld+ad+ed)/(lt+at_+et)) end,
   'eligible',ft>0 and fd=ft and (ld+ad+ed)=(lt+at_+et) and pd=pt) from t
$$;
revoke all on function public._progress(uuid,uuid) from public,anon,authenticated;

-- One downloadable identity card per student per enrolled course.
alter table public.student_id_cards add column if not exists course_id uuid references public.courses(id) on delete cascade;
alter table public.student_id_cards drop constraint if exists student_id_cards_user_id_key;
update public.student_id_cards card set course_id=(select e.course_id from public.enrollments e where e.user_id=card.user_id and e.status='active' order by e.enrolled_at limit 1)
where card.course_id is null and exists(select 1 from public.enrollments e where e.user_id=card.user_id and e.status='active');
create unique index if not exists student_id_cards_user_course_key on public.student_id_cards(user_id,course_id) where course_id is not null;
insert into public.student_id_cards(user_id,course_id)
select e.user_id,e.course_id from public.enrollments e where e.status='active'
on conflict(user_id,course_id) where course_id is not null do nothing;

create or replace function public.ensure_course_student_id_card() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.status='active' then
   insert into public.student_id_cards(user_id,course_id) values(new.user_id,new.course_id)
   on conflict(user_id,course_id) where course_id is not null do nothing;
 end if;
 return new;
end $$;
drop trigger if exists enrollment_course_id_card on public.enrollments;
create trigger enrollment_course_id_card after insert or update of status on public.enrollments
for each row execute function public.ensure_course_student_id_card();

drop function if exists public.get_or_create_student_id_card();
create or replace function public.get_or_create_student_id_card(p_course uuid) returns public.student_id_cards
language plpgsql security definer set search_path=public as $$
declare result public.student_id_cards;
begin
 if not exists(select 1 from public.students s join public.profiles p on p.id=s.user_id where s.user_id=auth.uid() and p.is_active) then raise exception 'An active student account is required'; end if;
 if not (public.is_enrolled(p_course) or exists(select 1 from public.enrollments e where e.user_id=auth.uid() and e.course_id=p_course and e.status='active')) then raise exception 'You need an active enrollment in this course to get its ID card'; end if;
 insert into public.student_id_cards(user_id,course_id) values(auth.uid(),p_course) on conflict(user_id,course_id) where course_id is not null do nothing;
 select * into result from public.student_id_cards where user_id=auth.uid() and course_id=p_course;
 return result;
end $$;
revoke all on function public.get_or_create_student_id_card(uuid) from public,anon;
grant execute on function public.get_or_create_student_id_card(uuid) to authenticated;

commit;
