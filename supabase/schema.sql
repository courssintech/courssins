-- Courssins Technology Institute: Supabase schema
-- Run this whole file once in Supabase Dashboard > SQL Editor. Then run seed.sql.
-- Safe to re-run: tables use IF NOT EXISTS, policies are dropped and recreated.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ profiles
-- "users" live in Supabase Auth (auth.users). public.profiles extends them.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  country text,
  interest text,
  avatar_url text,
  role text not null default 'student' check (role in ('student','tutor','admin','super_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.student_no_seq start 1001;
create table if not exists public.students (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  student_no text unique not null,
  status text not null default 'active' check (status in ('active','suspended','graduated')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ role helpers (SECURITY DEFINER so RLS can call them safely)
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('admin','super_admin') and is_active from public.profiles where id = auth.uid()), false) $$;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'super_admin' and is_active from public.profiles where id = auth.uid()), false) $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('tutor','admin','super_admin') and is_active from public.profiles where id = auth.uid()), false) $$;

-- ------------------------------------------------------------------ catalogue
create table if not exists public.tutors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  slug text unique not null,
  full_name text not null,
  title text,
  specialization text,
  bio text,
  experience text,
  qualifications jsonb not null default '[]',
  expertise jsonb not null default '[]',
  socials jsonb not null default '{}',
  email text,
  image_url text,
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text,
  icon text,
  short_description text,
  description text,
  duration text,
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'NGN',
  tutor_id uuid references public.tutors(id) on delete set null,
  image_url text,
  outcomes jsonb not null default '[]',
  requirements jsonb not null default '[]',
  faqs jsonb not null default '[]',
  assessment_info text,
  certificate_info text,
  featured boolean not null default false,
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.course_tutors (
  course_id uuid not null references public.courses(id) on delete cascade,
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, tutor_id)
);

create or replace function public.owns_course(cid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.course_tutors ct join public.tutors t on t.id = ct.tutor_id join public.profiles p on p.id = t.user_id where ct.course_id = cid and t.user_id = auth.uid() and p.role = 'tutor' and p.is_active) $$;

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  summary text,
  topics jsonb not null default '[]',
  position int not null default 1
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.course_modules(id) on delete set null,
  title text not null,
  content text,
  video_url text,
  duration_min int,
  is_preview boolean not null default false,
  position int not null default 1
);

-- ------------------------------------------------------------------ enrolment and payments
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','cancelled')),
  enrolled_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (user_id, course_id)
);

-- (is_enrolled is defined after enrollments exists)
create or replace function public.is_enrolled(cid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.enrollments e where e.course_id = cid and e.user_id = auth.uid() and e.status = 'active') $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'NGN',
  provider text not null default 'paystack',
  reference text unique not null,
  status text not null default 'pending' check (status in ('pending','success','failed','refunded')),
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- ------------------------------------------------------------------ assessment
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.course_modules(id) on delete set null,
  title text not null,
  instructions text,
  max_score int not null default 100,
  due_days int,
  position int not null default 1
);
create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  resource_type text not null check (resource_type in ('video','pdf','note','assignment')),
  description text,
  object_path text,
  external_url text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  check (object_path is not null or external_url is not null)
);
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  link_url text,
  status text not null default 'submitted' check (status in ('submitted','graded')),
  score numeric,
  feedback text,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (assignment_id, user_id)
);
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  instructions text,
  duration_min int not null default 30,
  pass_mark int not null default 50,
  published boolean not null default true
);
create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]',
  correct_index int not null default 0,
  position int not null default 1
);
create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score numeric not null,
  passed boolean not null,
  taken_at timestamptz not null default now()
);
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  certificate_number text unique not null,
  student_name text not null,
  course_title text not null,
  completed_at timestamptz not null default now(),
  issued_at timestamptz not null default now(),
  status text not null default 'valid' check (status in ('valid','revoked')),
  unique (user_id, course_id)
);

-- ------------------------------------------------------------------ content
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text, starts_at timestamptz, location text, url text, image_url text,
  published boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.library (
  id uuid primary key default gen_random_uuid(),
  title text not null, type text not null default 'material' check (type in ('book','pdf','material','video','document')),
  description text, url text, cover_url text,
  course_id uuid references public.courses(id) on delete set null,
  access text not null default 'public' check (access in ('public','members')),
  published boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, title text not null, excerpt text, content text, category text,
  author text, image_url text, published boolean not null default false,
  published_at timestamptz default now(), created_at timestamptz not null default now()
);
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  created_at timestamptz not null default now()
);
create table if not exists public.email_notification_deliveries (
  source_type text not null check (source_type in ('contact','newsletter')),
  source_id uuid not null,
  sender_hash text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (source_type, source_id)
);
create index if not exists idx_email_notification_rate on public.email_notification_deliveries(sender_hash, created_at desc);
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null, html text, css text, image_url text, meta_title text, meta_description text,
  published boolean not null default false, updated_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, body text, link text, read boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.settings (
  key text primary key, value jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) <= 120), email text not null check (length(email) <= 254),
  subject text check (length(subject) <= 200), message text not null check (length(message) <= 4000),
  created_at timestamptz not null default now()
);
create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, rating int not null check (rating between 1 and 5), comment text check (length(comment) <= 1500),
  approved boolean not null default false, created_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quote text not null,
  programme text,
  image_url text,
  published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_lessons_course on public.lessons(course_id, position);
create index if not exists idx_modules_course on public.course_modules(course_id, position);
create index if not exists idx_enroll_user on public.enrollments(user_id);
create index if not exists idx_payments_user on public.payments(user_id);
create index if not exists idx_progress_user on public.course_progress(user_id, course_id);

-- ------------------------------------------------------------------ triggers
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Role is ALWAYS student here. Client-supplied metadata can never set a role.
  insert into public.profiles (id, full_name, email, phone, country, interest, role)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''),120), new.email,
          left(coalesce(new.raw_user_meta_data->>'phone',''),40), left(coalesce(new.raw_user_meta_data->>'country',''),80),
          left(coalesce(new.raw_user_meta_data->>'interest',''),120), 'student')
  on conflict (id) do nothing;
  insert into public.students (user_id, student_no)
  values (new.id, 'CTI-' || to_char(now(),'YY') || '-' || nextval('public.student_no_seq'))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Only a super admin can change roles (SQL editor / service role, where auth.uid() is null, may bootstrap the first one).
create or replace function public.protect_profile_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only a super admin can change roles';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Only a super admin can change account status';
    end if;
  end if;
  if old.role = 'super_admin' and old.is_active and (new.role <> 'super_admin' or not new.is_active)
    and (select count(*) from public.profiles where role = 'super_admin' and is_active) <= 1 then
    raise exception 'At least one active super admin must remain';
  end if;
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists protect_role on public.profiles;
create trigger protect_role before update on public.profiles for each row execute function public.protect_profile_role();

-- A payment marked successful (by the verified webhook, or manually by an admin) activates the enrolment.
create or replace function public.on_payment_success() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'success' and old.status is distinct from 'success' then
    new.paid_at = coalesce(new.paid_at, now());
    update public.enrollments set status = 'active', activated_at = now() where id = new.enrollment_id;
    insert into public.notifications (user_id, title, body, link)
    values (new.user_id, 'Payment confirmed', 'Your payment was verified and your course is now unlocked.', 'dashboard.html#courses');
  end if;
  return new;
end $$;
drop trigger if exists payment_success on public.payments;
create trigger payment_success before update on public.payments for each row execute function public.on_payment_success();

-- ------------------------------------------------------------------ RPCs (the only way students create enrolments, submit exams or claim certificates)
create or replace function public.start_enrollment(p_course uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.courses; e public.enrollments; pay public.payments; ref text;
begin
  if uid is null then raise exception 'Please log in first'; end if;
  select * into c from public.courses where id = p_course and published;
  if not found then raise exception 'Course not found'; end if;
  select * into e from public.enrollments where user_id = uid and course_id = p_course;
  if found and e.status = 'active' then
    return jsonb_build_object('enrollment_id', e.id, 'status', 'active');
  end if;
  if not found then
    insert into public.enrollments (user_id, course_id, status) values (uid, p_course, case when c.price = 0 then 'active' else 'pending' end)
    returning * into e;
    if c.price = 0 then
      update public.enrollments set activated_at = now() where id = e.id;
      return jsonb_build_object('enrollment_id', e.id, 'status', 'active');
    end if;
  end if;
  select * into pay from public.payments where enrollment_id = e.id and status = 'pending' order by created_at desc limit 1;
  if not found then
    ref := 'CTI-' || upper(substr(encode(gen_random_bytes(8),'hex'),1,12));
    insert into public.payments (user_id, course_id, enrollment_id, amount, currency, reference)
    values (uid, p_course, e.id, c.price, c.currency, ref) returning * into pay;
  end if;
  return jsonb_build_object('enrollment_id', e.id, 'status', 'pending', 'reference', pay.reference, 'amount', pay.amount, 'currency', pay.currency);
end $$;

create or replace function public._progress(p_course uuid, p_user uuid) returns jsonb language sql stable security definer set search_path = public as $$
  with t as (
    select (select count(*) from public.lessons where course_id = p_course) lt,
           (select count(*) from public.course_progress where course_id = p_course and user_id = p_user) ld,
           (select count(*) from public.assignments where course_id = p_course) at_,
           (select count(*) from public.assignment_submissions s join public.assignments a on a.id = s.assignment_id where a.course_id = p_course and s.user_id = p_user) ad,
           (select count(*) from public.exams where course_id = p_course and published) et,
           (select count(distinct r.exam_id) from public.exam_results r join public.exams x on x.id = r.exam_id where x.course_id = p_course and x.published and r.user_id = p_user and r.passed) ed
  )
  select jsonb_build_object('lessons_total', lt, 'lessons_done', ld, 'assignments_total', at_, 'assignments_done', ad,
    'exams_total', et, 'exams_passed', ed,
    'percent', case when lt+at_+et = 0 then 0 else round(100.0 * (ld+ad+ed) / (lt+at_+et)) end,
    'eligible', (lt+at_+et) > 0 and (ld+ad+ed) = (lt+at_+et)) from t $$;
revoke all on function public._progress(uuid, uuid) from public, anon, authenticated;

create or replace function public.course_progress_summary(p_course uuid) returns jsonb language sql stable security definer set search_path = public as
$$ select case when auth.uid() is null then null else public._progress(p_course, auth.uid()) end $$;

create or replace function public.claim_certificate(p_course uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pr jsonb; cert public.certificates; nm text; ct text;
begin
  if uid is null then raise exception 'Please log in first'; end if;
  if not public.is_enrolled(p_course) then raise exception 'You are not enrolled in this course'; end if;
  select * into cert from public.certificates where user_id = uid and course_id = p_course;
  if found then return to_jsonb(cert); end if;
  pr := public._progress(p_course, uid);
  if not (pr->>'eligible')::boolean then raise exception 'Complete all lessons, assignments and examinations first'; end if;
  select full_name into nm from public.profiles where id = uid;
  select title into ct from public.courses where id = p_course;
  insert into public.certificates (user_id, course_id, certificate_number, student_name, course_title)
  values (uid, p_course, 'CTI-' || to_char(now(),'YYYY') || '-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,8)), coalesce(nullif(nm,''),'Student'), ct)
  returning * into cert;
  insert into public.notifications (user_id, title, body, link) values (uid, 'Certificate issued', 'Your certificate for ' || ct || ' is ready.', 'dashboard.html#certificates');
  return to_jsonb(cert);
end $$;

create or replace function public.get_exam_questions(p_exam uuid) returns table (id uuid, question text, options jsonb, "position" int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.exams x where x.id = p_exam and x.published and (public.is_enrolled(x.course_id) or public.is_admin() or public.owns_course(x.course_id))) then
    raise exception 'Not allowed';
  end if;
  return query select q.id, q.question, q.options, q.position from public.exam_questions q where q.exam_id = p_exam order by q.position;
end $$;

create or replace function public.submit_exam(p_exam uuid, p_answers jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); x public.exams; total int; ok int; sc numeric; pass boolean;
begin
  if uid is null then raise exception 'Please log in first'; end if;
  select * into x from public.exams where id = p_exam and published;
  if not found or not public.is_enrolled(x.course_id) then raise exception 'Not allowed'; end if;
  select count(*), count(*) filter (where (p_answers ->> q.id::text) ~ '^[0-9]+$' and (p_answers ->> q.id::text)::int = q.correct_index)
    into total, ok from public.exam_questions q where q.exam_id = p_exam;
  if total = 0 then raise exception 'This exam has no questions yet'; end if;
  sc := round(100.0 * ok / total, 1); pass := sc >= x.pass_mark;
  insert into public.exam_results (exam_id, user_id, score, passed) values (p_exam, uid, sc, pass);
  return jsonb_build_object('score', sc, 'passed', pass, 'pass_mark', x.pass_mark);
end $$;

-- Public certificate verification: returns only non-sensitive fields, and only for an exact certificate number.
create or replace function public.verify_certificate(p_number text) returns table (certificate_number text, student_name text, course_title text, completed_at timestamptz, issued_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select c.certificate_number, c.student_name, c.course_title, c.completed_at, c.issued_at, c.status
  from public.certificates c where upper(c.certificate_number) = upper(trim(p_number)) limit 1 $$;

do $$ declare f text; begin
  foreach f in array array['start_enrollment(uuid)','course_progress_summary(uuid)','claim_certificate(uuid)','get_exam_questions(uuid)','submit_exam(uuid,jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ------------------------------------------------------------------ Row Level Security
do $$ declare t text; begin
  foreach t in array array['profiles','students','tutors','courses','course_tutors','course_modules','lessons','enrollments','payments','course_progress','assignments','course_resources','assignment_submissions','exams','exam_questions','exam_results','certificates','events','library','blog_posts','newsletter_subscribers','email_notification_deliveries','pages','notifications','settings','contact_messages','course_reviews','testimonials'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- drop existing policies so this file can be re-run
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- profiles: own row, or admins. Role changes are additionally guarded by the trigger above.
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy profiles_tutor_students_select on public.profiles for select using (role = 'student' and exists (select 1 from public.enrollments e where e.user_id = profiles.id and e.status = 'active' and public.owns_course(e.course_id)));
create policy students_select on public.students for select using (user_id = auth.uid() or public.is_admin());
create policy students_admin on public.students for all using (public.is_admin()) with check (public.is_admin());

-- catalogue: public read of published rows; admins manage
create policy tutors_read on public.tutors for select using (published or public.is_admin() or user_id = auth.uid());
create policy tutors_admin on public.tutors for all using (public.is_admin()) with check (public.is_admin());
create policy courses_read on public.courses for select using (published or public.is_admin() or public.owns_course(id));
create policy courses_admin on public.courses for all using (public.is_admin()) with check (public.is_admin());
create policy course_tutors_read on public.course_tutors for select using (exists (select 1 from public.courses c where c.id = course_id and c.published) or public.is_admin() or public.owns_course(course_id));
create policy course_tutors_manage on public.course_tutors for all using (public.is_admin()) with check (public.is_admin());
create policy modules_read on public.course_modules for select using (exists (select 1 from public.courses c where c.id = course_id and c.published) or public.is_admin() or public.owns_course(course_id));
create policy modules_write on public.course_modules for all using (public.is_admin() or public.owns_course(course_id)) with check (public.is_admin() or public.owns_course(course_id));
create policy lessons_read on public.lessons for select using (public.is_admin() or public.owns_course(course_id) or public.is_enrolled(course_id)
  or (is_preview and exists (select 1 from public.courses c where c.id = course_id and c.published)));
create policy lessons_write on public.lessons for all using (public.is_admin() or public.owns_course(course_id)) with check (public.is_admin() or public.owns_course(course_id));

-- enrolments / payments: read-only for students; created through start_enrollment(); activated only by a successful payment
create policy enroll_select on public.enrollments for select using (user_id = auth.uid() or public.is_admin() or public.owns_course(course_id));
create policy enroll_admin on public.enrollments for all using (public.is_admin()) with check (public.is_admin());
create policy pay_select on public.payments for select using (user_id = auth.uid() or public.is_admin());
create policy pay_admin on public.payments for all using (public.is_admin()) with check (public.is_admin());

create policy progress_select on public.course_progress for select using (user_id = auth.uid() or public.is_admin() or public.owns_course(course_id));
create policy progress_insert on public.course_progress for insert with check (user_id = auth.uid() and public.is_enrolled(course_id));
create policy progress_delete on public.course_progress for delete using (user_id = auth.uid());

create policy assign_read on public.assignments for select using (public.is_admin() or public.owns_course(course_id) or public.is_enrolled(course_id));
create policy assign_write on public.assignments for all using (public.is_admin() or public.owns_course(course_id)) with check (public.is_admin() or public.owns_course(course_id));
create policy course_resources_read on public.course_resources for select using (public.is_admin() or public.owns_course(course_id) or (published and public.is_enrolled(course_id)));
create policy course_resources_manage on public.course_resources for all using (public.is_admin() or public.owns_course(course_id)) with check (public.is_admin() or public.owns_course(course_id));
create policy sub_select on public.assignment_submissions for select using (user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.assignments a where a.id = assignment_id and public.owns_course(a.course_id)));
create policy sub_insert on public.assignment_submissions for insert with check (user_id = auth.uid() and score is null and feedback is null and status = 'submitted'
  and exists (select 1 from public.assignments a where a.id = assignment_id and public.is_enrolled(a.course_id)));
create policy sub_update_own on public.assignment_submissions for update using (user_id = auth.uid() and score is null)
  with check (user_id = auth.uid() and score is null and feedback is null and status = 'submitted');
create policy sub_grade on public.assignment_submissions for update using (public.is_admin() or exists (select 1 from public.assignments a where a.id = assignment_id and public.owns_course(a.course_id)))
  with check (public.is_admin() or exists (select 1 from public.assignments a where a.id = assignment_id and public.owns_course(a.course_id)));
create policy sub_delete_admin on public.assignment_submissions for delete using (public.is_admin());

create policy exams_read on public.exams for select using (public.is_admin() or public.owns_course(course_id) or (published and public.is_enrolled(course_id)));
create policy exams_write on public.exams for all using (public.is_admin() or public.owns_course(course_id)) with check (public.is_admin() or public.owns_course(course_id));
-- exam_questions holds the answer key: staff only. Students receive questions through get_exam_questions() without answers.
create policy eq_staff on public.exam_questions for all
  using (public.is_admin() or exists (select 1 from public.exams x where x.id = exam_id and public.owns_course(x.course_id)))
  with check (public.is_admin() or exists (select 1 from public.exams x where x.id = exam_id and public.owns_course(x.course_id)));
create policy er_select on public.exam_results for select using (user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.exams x where x.id = exam_id and public.owns_course(x.course_id)));
create policy er_admin on public.exam_results for all using (public.is_admin()) with check (public.is_admin());

create policy cert_select on public.certificates for select using (user_id = auth.uid() or public.is_admin());
create policy cert_admin on public.certificates for all using (public.is_admin()) with check (public.is_admin());

-- content
create policy events_read on public.events for select using (published or public.is_admin());
create policy events_admin on public.events for all using (public.is_admin()) with check (public.is_admin());
create policy library_read on public.library for select using (public.is_admin() or (published and (access = 'public' or auth.uid() is not null)));
create policy library_admin on public.library for all using (public.is_admin()) with check (public.is_admin());
create policy blog_read on public.blog_posts for select using ((published and published_at <= now()) or public.is_admin());
create policy blog_admin on public.blog_posts for all using (public.is_admin()) with check (public.is_admin());
create policy news_insert on public.newsletter_subscribers for insert to anon, authenticated with check (true);
create policy news_admin on public.newsletter_subscribers for all using (public.is_admin()) with check (public.is_admin());
create policy pages_read on public.pages for select using (published or public.is_super_admin());
create policy pages_write on public.pages for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy notif_select on public.notifications for select using (user_id = auth.uid() or public.is_admin());
create policy notif_update_own on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_admin on public.notifications for all using (public.is_admin()) with check (public.is_admin());
create policy settings_read on public.settings for select using (true);   -- settings are public site content only. Never store secrets here.
create policy settings_write on public.settings for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy contact_insert on public.contact_messages for insert to anon, authenticated with check (true);
create policy contact_admin on public.contact_messages for all using (public.is_admin()) with check (public.is_admin());
create policy reviews_read on public.course_reviews for select using (approved or user_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.course_reviews for insert with check (user_id = auth.uid() and approved = false and public.is_enrolled(course_id));
create policy reviews_admin on public.course_reviews for all using (public.is_admin()) with check (public.is_admin());
create policy testimonials_read on public.testimonials for select using (published or public.is_admin());
create policy testimonials_manage on public.testimonials for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------ storage: public "media" bucket, admin-only writes
revoke all on table public.email_notification_deliveries from public, anon, authenticated;
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit) values ('course-materials', 'course-materials', false, 52428800) on conflict (id) do update set public = false, file_size_limit = 52428800;
drop policy if exists media_read on storage.objects;
drop policy if exists media_admin_write on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');
create policy media_admin_write on storage.objects for all using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());
drop policy if exists course_materials_read on storage.objects;
drop policy if exists course_materials_insert on storage.objects;
drop policy if exists course_materials_update on storage.objects;
drop policy if exists course_materials_delete on storage.objects;
create policy course_materials_read on storage.objects for select using (bucket_id = 'course-materials' and exists (select 1 from public.course_resources r where r.object_path = name and (public.is_admin() or public.owns_course(r.course_id) or (r.published and public.is_enrolled(r.course_id)))));
create policy course_materials_insert on storage.objects for insert with check (bucket_id = 'course-materials' and case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_admin() or public.owns_course(split_part(name, '/', 1)::uuid) else false end);
create policy course_materials_update on storage.objects for update using (bucket_id = 'course-materials' and case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_admin() or public.owns_course(split_part(name, '/', 1)::uuid) else false end) with check (bucket_id = 'course-materials' and case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_admin() or public.owns_course(split_part(name, '/', 1)::uuid) else false end);
create policy course_materials_delete on storage.objects for delete using (bucket_id = 'course-materials' and case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_admin() or public.owns_course(split_part(name, '/', 1)::uuid) else false end);

-- Bootstrapping the first Super Admin: sign up on the website, then run (with your email):
--   update public.profiles set role = 'super_admin' where email = 'you@example.com';
