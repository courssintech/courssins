begin;

update storage.buckets set file_size_limit=524288000 where id='media';

-- Keep progression pass marks at or above the institute's 50% floor.
update public.exams set pass_mark = 50 where pass_mark < 50;
alter table public.exams drop constraint if exists exams_pass_mark_minimum;
alter table public.exams add constraint exams_pass_mark_minimum check (pass_mark >= 50 and pass_mark <= 100);
update public.exam_results r set passed=(r.score >= x.pass_mark) from public.exams x where x.id=r.exam_id;

-- A valid certificate preserves learning access after course completion.
create or replace function public.is_enrolled(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.enrollments e where e.course_id=cid and e.user_id=auth.uid() and e.status='active')
   or exists(select 1 from public.certificates c where c.course_id=cid and c.user_id=auth.uid() and c.status='valid')
$$;

-- Every previous module must have a published quiz and a passing result (50%+).
create or replace function public.module_is_unlocked(p_course uuid, p_module uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select case
   when p_user is distinct from auth.uid() and not public.is_admin() then false
   when exists(select 1 from public.certificates c where c.course_id=p_course and c.user_id=p_user and c.status='valid') then true
   when p_module is null then true
   else exists(select 1 from public.course_modules current_module
     where current_module.id=p_module and current_module.course_id=p_course
       and not exists(
         select 1 from public.course_modules previous_module
         where previous_module.course_id=p_course and previous_module.position<current_module.position
           and (not exists(select 1 from public.exams x where x.module_id=previous_module.id and x.published and not x.is_final)
             or not exists(select 1 from public.exams x join public.exam_results r on r.exam_id=x.id
               where x.module_id=previous_module.id and x.published and not x.is_final and r.user_id=p_user and r.passed and r.score>=50))
       ))
 end
$$;
revoke all on function public.is_enrolled(uuid) from public, anon;
grant execute on function public.is_enrolled(uuid) to authenticated;
revoke all on function public.module_is_unlocked(uuid,uuid,uuid) from public, anon;
grant execute on function public.module_is_unlocked(uuid,uuid,uuid) to authenticated;

-- Public campaign media can be either an image or video. Existing image_url rows stay valid.
alter table public.advertisements add column if not exists media_type text not null default 'image' check (media_type in ('image','video'));
alter table public.advertisements add column if not exists media_url text;
update public.advertisements set media_url = image_url where media_url is null and image_url is not null;

create or replace function public.enforce_active_advertisement_limit() returns trigger
language plpgsql set search_path = public as $$
declare active_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('courssins-active-advertisements'));
  if new.active then
    select count(*) into active_count from public.advertisements
      where active and id is distinct from new.id;
    if active_count >= 5 then raise exception 'Only five advertisements may be active at once'; end if;
  end if;
  return new;
end $$;
drop trigger if exists advertisements_active_limit on public.advertisements;
create trigger advertisements_active_limit before insert or update of active on public.advertisements
for each row execute function public.enforce_active_advertisement_limit();

-- Student ID records are revocable like staff IDs; profile data stays in profiles.
create table if not exists public.student_id_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  card_number text not null unique default ('CTI-STU-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  issue_year integer not null default extract(year from now())::integer,
  issued_at timestamptz not null default now(),
  status text not null default 'valid' check (status in ('valid','revoked')),
  revoked_at timestamptz,
  revoked_reason text
);
insert into public.student_id_cards(user_id)
select user_id from public.students on conflict (user_id) do nothing;
alter table public.student_id_cards enable row level security;
drop policy if exists student_id_cards_read on public.student_id_cards;
create policy student_id_cards_read on public.student_id_cards for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists student_id_cards_admin_manage on public.student_id_cards;
create policy student_id_cards_admin_manage on public.student_id_cards for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.student_id_cards to authenticated;
create or replace function public.get_or_create_student_id_card() returns public.student_id_cards
language plpgsql security definer set search_path = public as $$
declare result public.student_id_cards;
begin
  if not exists (select 1 from public.students s join public.profiles p on p.id=s.user_id where s.user_id=auth.uid() and p.is_active)
  then raise exception 'An active student account is required'; end if;
  insert into public.student_id_cards(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select * into result from public.student_id_cards where user_id=auth.uid();
  return result;
end $$;
revoke all on function public.get_or_create_student_id_card() from public, anon;
grant execute on function public.get_or_create_student_id_card() to authenticated;

-- Staff inbox supports direct or all-tutor messages and threaded replies.
create table if not exists public.staff_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  parent_id uuid references public.staff_messages(id) on delete cascade,
  body text not null check (length(body) between 1 and 5000),
  attachment_url text,
  created_at timestamptz not null default now()
);
alter table public.staff_messages enable row level security;
create or replace function public.can_read_staff_message(p_sender uuid, p_recipient uuid, p_parent uuid default null) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare parent public.staff_messages;
begin
  if public.is_admin() or p_sender=auth.uid() or p_recipient=auth.uid() then return true; end if;
  if p_recipient is null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='tutor' and p.is_active) then return true; end if;
  if p_parent is not null then
    select * into parent from public.staff_messages where id=p_parent;
    if found and (parent.sender_id=auth.uid() or parent.recipient_id=auth.uid() or
      (parent.recipient_id is null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='tutor' and p.is_active))) then return true; end if;
  end if;
  return false;
end $$;
revoke all on function public.can_read_staff_message(uuid,uuid,uuid) from public, anon;
grant execute on function public.can_read_staff_message(uuid,uuid,uuid) to authenticated;
drop policy if exists staff_messages_read on public.staff_messages;
create policy staff_messages_read on public.staff_messages for select using (public.can_read_staff_message(sender_id,recipient_id,parent_id));
drop policy if exists staff_messages_send on public.staff_messages;
create policy staff_messages_send on public.staff_messages for insert with check (
 sender_id=auth.uid() and public.is_staff() and
 ((public.is_admin()) or (recipient_id is not null and exists(select 1 from public.profiles p where p.id=recipient_id and p.role in ('admin','super_admin'))) or
  (recipient_id is null and parent_id is null and public.is_admin()) or
  (parent_id is not null and public.can_read_staff_message(null,null,parent_id)))
);
grant select, insert on public.staff_messages to authenticated;

-- Tutor-owned course groups: enrolled students can read posts and react, but cannot post replies.
create table if not exists public.tutor_groups (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.courses(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(title) between 2 and 160),
 created_at timestamptz not null default now()
);
create table if not exists public.tutor_group_posts (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.tutor_groups(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 post_type text not null default 'message' check(post_type in ('message','assignment')),
 body text not null check(length(body) between 1 and 5000),
 attachment_url text,
 created_at timestamptz not null default now()
);
create table if not exists public.tutor_group_reactions (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.tutor_group_posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 reaction text not null check(reaction in ('👍','❤️','👏','✅')),
 created_at timestamptz not null default now(),
 unique(post_id,user_id,reaction)
);
alter table public.tutor_groups enable row level security;
alter table public.tutor_group_posts enable row level security;
alter table public.tutor_group_reactions enable row level security;
drop policy if exists tutor_groups_read on public.tutor_groups;
create policy tutor_groups_read on public.tutor_groups for select using(public.is_admin() or owner_id=auth.uid() or public.is_enrolled(course_id));
drop policy if exists tutor_groups_manage on public.tutor_groups;
create policy tutor_groups_manage on public.tutor_groups for all using(public.is_admin() or (owner_id=auth.uid() and public.owns_course(course_id))) with check(public.is_admin() or (owner_id=auth.uid() and public.owns_course(course_id)));
drop policy if exists tutor_group_posts_read on public.tutor_group_posts;
create policy tutor_group_posts_read on public.tutor_group_posts for select using(exists(select 1 from public.tutor_groups g where g.id=group_id and (public.is_admin() or g.owner_id=auth.uid() or public.is_enrolled(g.course_id))));
drop policy if exists tutor_group_posts_tutor_send on public.tutor_group_posts;
create policy tutor_group_posts_tutor_send on public.tutor_group_posts for insert with check(author_id=auth.uid() and exists(select 1 from public.tutor_groups g where g.id=group_id and (public.is_admin() or (g.owner_id=auth.uid() and public.owns_course(g.course_id)))));
drop policy if exists tutor_group_reactions_read on public.tutor_group_reactions;
create policy tutor_group_reactions_read on public.tutor_group_reactions for select using(exists(select 1 from public.tutor_group_posts p join public.tutor_groups g on g.id=p.group_id where p.id=post_id and (public.is_admin() or g.owner_id=auth.uid() or public.is_enrolled(g.course_id))));
drop policy if exists tutor_group_reactions_add on public.tutor_group_reactions;
create policy tutor_group_reactions_add on public.tutor_group_reactions for insert with check(user_id=auth.uid() and exists(select 1 from public.tutor_group_posts p join public.tutor_groups g on g.id=p.group_id where p.id=post_id and public.is_enrolled(g.course_id)));
drop policy if exists tutor_group_reactions_remove on public.tutor_group_reactions;
create policy tutor_group_reactions_remove on public.tutor_group_reactions for delete using(user_id=auth.uid() or public.is_admin());
grant select, insert, update, delete on public.tutor_groups to authenticated;
grant select, insert on public.tutor_group_posts to authenticated;
grant select, insert, delete on public.tutor_group_reactions to authenticated;

commit;
