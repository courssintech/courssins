-- Course discussions use the tutor group feed as a shared chat. Students may
-- send plain messages in groups for courses where they have active access.
alter table public.tutor_group_posts add column if not exists author_name text;
update public.tutor_group_posts p
set author_name = coalesce(nullif(trim(profile.full_name), ''), 'Course member')
from public.profiles profile
where profile.id = p.author_id and p.author_name is null;
update public.tutor_group_posts set author_name = 'Course member' where author_name is null;
alter table public.tutor_group_posts alter column author_name set default 'Course member';
alter table public.tutor_group_posts alter column author_name set not null;

create or replace function public.set_tutor_group_post_author_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(nullif(trim(full_name), ''), 'Course member')
  into new.author_name from public.profiles where id = new.author_id;
  return new;
end;
$$;
drop trigger if exists tutor_group_post_author_name on public.tutor_group_posts;
create trigger tutor_group_post_author_name before insert on public.tutor_group_posts
for each row execute function public.set_tutor_group_post_author_name();
revoke all on function public.set_tutor_group_post_author_name() from public, anon, authenticated;

drop policy if exists tutor_group_posts_tutor_send on public.tutor_group_posts;
drop policy if exists tutor_group_posts_chat_send on public.tutor_group_posts;

create policy tutor_group_posts_chat_send on public.tutor_group_posts
for insert to authenticated
with check (
  author_id = auth.uid()
  and post_type = 'message'
  and assignment_id is null
  and exists (
    select 1
    from public.tutor_groups g
    where g.id = group_id
      and (
        public.is_admin()
        or g.owner_id = auth.uid()
        or public.is_enrolled(g.course_id)
      )
  )
);

grant select, insert on public.tutor_group_posts to authenticated;

-- Publish chat and dashboard data so connected views can refresh immediately.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'tutor_group_posts','profiles','courses','enrollments','payments',
      'assignment_submissions','notifications','contact_messages',
      'certificates','course_progress','exam_results','course_discussions'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
