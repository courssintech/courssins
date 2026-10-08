begin;

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

alter table public.testimonials enable row level security;
drop policy if exists testimonials_read on public.testimonials;
drop policy if exists testimonials_manage on public.testimonials;
create policy testimonials_read on public.testimonials for select using (published or public.is_admin());
create policy testimonials_manage on public.testimonials for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_tutor_students_select on public.profiles;
create policy profiles_tutor_students_select on public.profiles for select using (
  role = 'student' and exists (
    select 1 from public.enrollments e
    where e.user_id = profiles.id and e.status = 'active' and public.owns_course(e.course_id)
  )
);

commit;
