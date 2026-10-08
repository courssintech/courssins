begin;

alter table public.profiles
  add column if not exists is_active boolean not null default true;

create table if not exists public.course_tutors (
  course_id uuid not null references public.courses(id) on delete cascade,
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, tutor_id)
);

insert into public.course_tutors (course_id, tutor_id)
select id, tutor_id
from public.courses
where tutor_id is not null
on conflict (course_id, tutor_id) do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('admin','super_admin') and is_active from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'super_admin' and is_active from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('tutor','admin','super_admin') and is_active from public.profiles where id = auth.uid()), false) $$;

create or replace function public.owns_course(cid uuid) returns boolean
language sql stable security definer set search_path = public as
$$
  select exists (
    select 1
    from public.course_tutors ct
    join public.tutors t on t.id = ct.tutor_id
    join public.profiles p on p.id = t.user_id
    where ct.course_id = cid and t.user_id = auth.uid() and p.role = 'tutor' and p.is_active
  )
$$;

create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
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

alter table public.course_tutors enable row level security;
drop policy if exists course_tutors_read on public.course_tutors;
drop policy if exists course_tutors_manage on public.course_tutors;
create policy course_tutors_read on public.course_tutors for select
  using (exists (select 1 from public.courses c where c.id = course_id and c.published) or public.is_admin() or public.owns_course(course_id));
create policy course_tutors_manage on public.course_tutors for all
  using (public.is_admin())
  with check (public.is_admin());

commit;
