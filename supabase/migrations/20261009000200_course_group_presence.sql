begin;

create table if not exists public.tutor_group_member_presence (
  group_id uuid not null references public.tutor_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.tutor_group_member_presence enable row level security;
revoke all on public.tutor_group_member_presence from public, anon, authenticated;

create or replace function public.get_tutor_group_members(p_group uuid)
returns table(user_id uuid, full_name text, avatar_url text, role text, last_seen_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare selected_group public.tutor_groups;
begin
  select * into selected_group from public.tutor_groups where id = p_group;
  if not found then raise exception 'Course group not found'; end if;
  if not (
    public.is_admin()
    or selected_group.owner_id = auth.uid()
    or exists(select 1 from public.enrollments e where e.course_id = selected_group.course_id and e.user_id = auth.uid() and e.status = 'active')
    or exists(select 1 from public.certificates c where c.course_id = selected_group.course_id and c.user_id = auth.uid() and c.status = 'valid')
  ) then raise exception 'You are not a member of this course group'; end if;

  return query
  select p.id, coalesce(nullif(trim(p.full_name), ''), 'Course member'), p.avatar_url, p.role, presence.last_seen_at
  from public.profiles p
  left join public.tutor_group_member_presence presence on presence.user_id = p.id and presence.group_id = p_group
  where p.is_active and (
    p.id = selected_group.owner_id
    or exists(select 1 from public.enrollments e where e.course_id = selected_group.course_id and e.user_id = p.id and e.status = 'active')
    or exists(select 1 from public.certificates c where c.course_id = selected_group.course_id and c.user_id = p.id and c.status = 'valid')
  )
  order by (p.id = selected_group.owner_id) desc, p.full_name;
end;
$$;

create or replace function public.touch_tutor_group_presence(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare selected_group public.tutor_groups;
begin
  select * into selected_group from public.tutor_groups where id = p_group;
  if not found then raise exception 'Course group not found'; end if;
  if not (
    public.is_admin()
    or selected_group.owner_id = auth.uid()
    or exists(select 1 from public.enrollments e where e.course_id = selected_group.course_id and e.user_id = auth.uid() and e.status = 'active')
    or exists(select 1 from public.certificates c where c.course_id = selected_group.course_id and c.user_id = auth.uid() and c.status = 'valid')
  ) then raise exception 'You are not a member of this course group'; end if;

  insert into public.tutor_group_member_presence(group_id, user_id, last_seen_at)
  values(p_group, auth.uid(), now())
  on conflict(group_id, user_id) do update set last_seen_at = excluded.last_seen_at;
end;
$$;

revoke all on function public.get_tutor_group_members(uuid) from public, anon;
grant execute on function public.get_tutor_group_members(uuid) to authenticated;
revoke all on function public.touch_tutor_group_presence(uuid) from public, anon;
grant execute on function public.touch_tutor_group_presence(uuid) to authenticated;

create or replace function public.can_access_tutor_group_presence(p_topic text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tutor_groups g
    where p_topic = 'course-group-presence-' || g.id::text
      and (
        public.is_admin()
        or g.owner_id = auth.uid()
        or exists(select 1 from public.enrollments e where e.course_id = g.course_id and e.user_id = auth.uid() and e.status = 'active')
        or exists(select 1 from public.certificates c where c.course_id = g.course_id and c.user_id = auth.uid() and c.status = 'valid')
      )
  );
$$;
revoke all on function public.can_access_tutor_group_presence(text) from public, anon;
grant execute on function public.can_access_tutor_group_presence(text) to authenticated;

drop policy if exists tutor_group_presence_read on realtime.messages;
create policy tutor_group_presence_read on realtime.messages
for select to authenticated
using (
  extension = 'presence'
  and public.can_access_tutor_group_presence(realtime.topic())
);
drop policy if exists tutor_group_presence_write on realtime.messages;
create policy tutor_group_presence_write on realtime.messages
for insert to authenticated
with check (
  extension = 'presence'
  and public.can_access_tutor_group_presence(realtime.topic())
);

commit;
