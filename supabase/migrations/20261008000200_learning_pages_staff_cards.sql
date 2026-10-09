begin;

alter table public.lessons add column if not exists video_path text;
alter table public.profiles add column if not exists address text;
alter table public.exams alter column duration_min set default 13;
update public.exams set duration_min = 13 where duration_min is distinct from 13;

create table if not exists public.staff_id_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  card_number text not null unique default ('CTI-STAFF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  issue_year integer not null default extract(year from now())::integer,
  issued_at timestamptz not null default now(),
  status text not null default 'valid' check (status in ('valid', 'revoked')),
  revoked_at timestamptz,
  revoked_reason text
);
insert into public.staff_id_cards (user_id)
select id from public.profiles where is_active and role in ('tutor', 'admin', 'super_admin')
on conflict (user_id) do nothing;

create or replace function public.set_staff_id_card_revocation() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'revoked' and old.status is distinct from 'revoked' then new.revoked_at = now(); end if;
  if new.status = 'valid' then new.revoked_at = null; new.revoked_reason = null; end if;
  return new;
end $$;
drop trigger if exists staff_id_card_revocation on public.staff_id_cards;
create trigger staff_id_card_revocation before update of status on public.staff_id_cards
for each row execute function public.set_staff_id_card_revocation();

alter table public.staff_id_cards enable row level security;
drop policy if exists staff_id_cards_read on public.staff_id_cards;
create policy staff_id_cards_read on public.staff_id_cards for select using (
  user_id = auth.uid() or public.is_admin()
);
drop policy if exists staff_id_cards_admin_manage on public.staff_id_cards;
create policy staff_id_cards_admin_manage on public.staff_id_cards for all using (public.is_admin()) with check (public.is_admin());
grant select, insert on public.staff_id_cards to authenticated;
grant update, delete on public.staff_id_cards to authenticated;

create or replace function public.get_or_create_staff_id_card()
returns public.staff_id_cards
language plpgsql security definer set search_path = public as $$
declare result public.staff_id_cards;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('tutor', 'admin', 'super_admin')
  ) then raise exception 'An active staff account is required'; end if;

  insert into public.staff_id_cards (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  select * into result from public.staff_id_cards where user_id = auth.uid();
  return result;
end $$;
revoke all on function public.get_or_create_staff_id_card() from public, anon, authenticated;
grant execute on function public.get_or_create_staff_id_card() to authenticated;

drop policy if exists lesson_videos_read on storage.objects;
create policy lesson_videos_read on storage.objects for select using (
  bucket_id = 'course-materials' and exists (
    select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.video_path = name and (
      public.is_admin() or public.owns_course(l.course_id)
      or (public.is_enrolled(l.course_id) and public.module_is_unlocked(l.course_id, l.module_id, auth.uid()))
      or (l.is_preview and c.published)
    )
  )
);

update storage.buckets set file_size_limit = 524288000 where id = 'course-materials';

commit;
