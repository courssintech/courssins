begin;

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

alter table public.course_resources enable row level security;
drop policy if exists course_resources_read on public.course_resources;
drop policy if exists course_resources_manage on public.course_resources;
create policy course_resources_read on public.course_resources for select
  using (public.is_admin() or public.owns_course(course_id) or (published and public.is_enrolled(course_id)));
create policy course_resources_manage on public.course_resources for all
  using (public.is_admin() or public.owns_course(course_id))
  with check (public.is_admin() or public.owns_course(course_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('course-materials', 'course-materials', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists course_materials_read on storage.objects;
drop policy if exists course_materials_insert on storage.objects;
drop policy if exists course_materials_update on storage.objects;
drop policy if exists course_materials_delete on storage.objects;
create policy course_materials_read on storage.objects for select
  using (bucket_id = 'course-materials' and exists (
    select 1 from public.course_resources r
    where r.object_path = name and (public.is_admin() or public.owns_course(r.course_id) or (r.published and public.is_enrolled(r.course_id)))
  ));
create policy course_materials_insert on storage.objects for insert
  with check (bucket_id = 'course-materials' and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_admin() or public.owns_course(split_part(name, '/', 1)::uuid)
    else false end);
create policy course_materials_update on storage.objects for update
  using (bucket_id = 'course-materials' and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_admin() or public.owns_course(split_part(name, '/', 1)::uuid)
    else false end)
  with check (bucket_id = 'course-materials' and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_admin() or public.owns_course(split_part(name, '/', 1)::uuid)
    else false end);
create policy course_materials_delete on storage.objects for delete
  using (bucket_id = 'course-materials' and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_admin() or public.owns_course(split_part(name, '/', 1)::uuid)
    else false end);

commit;
