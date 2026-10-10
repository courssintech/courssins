begin;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text not null unique,
  course_id uuid references public.courses(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  archived boolean not null default false,
  muted boolean not null default false,
  pinned boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  client_nonce uuid not null default gen_random_uuid(),
  body text not null default '' check (length(body) <= 5000),
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size bigint check (attachment_size is null or attachment_size between 1 and 20971520),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (conversation_id,sender_id,client_nonce),
  check (length(btrim(body)) > 0 or attachment_path is not null),
  check ((attachment_path is null and attachment_name is null and attachment_type is null and attachment_size is null)
      or (attachment_path is not null and attachment_name is not null and attachment_type is not null and attachment_size is not null))
);
create index if not exists conversation_participants_user_idx on public.conversation_participants(user_id,conversation_id);
create index if not exists conversations_recent_idx on public.conversations(last_message_at desc);
create index if not exists conversation_messages_recent_idx on public.conversation_messages(conversation_id,created_at desc,id desc);
create index if not exists conversation_messages_unread_idx on public.conversation_messages(conversation_id,read_at) where read_at is null;
create index if not exists notifications_user_recent_idx on public.notifications(user_id,created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id,created_at desc) where read=false;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversation_messages enable row level security;

create or replace function public.can_message_user(p_recipient uuid,p_course uuid default null) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare sender_role text; recipient_role text;
begin
  select role into sender_role from public.profiles where id=auth.uid() and is_active;
  select role into recipient_role from public.profiles where id=p_recipient and is_active;
  if sender_role is null or recipient_role is null or p_recipient=auth.uid() then return false; end if;
  if sender_role in ('admin','super_admin') then return true; end if;
  if recipient_role in ('admin','super_admin') then return true; end if;
  if sender_role='tutor' and recipient_role='tutor' then return true; end if;
  if sender_role='student' and recipient_role='student' then return false; end if;
  if p_course is null then return false; end if;
  return exists(select 1 from public.enrollments e where e.course_id=p_course and e.status='active'
    and ((sender_role='student' and e.user_id=auth.uid()) or (recipient_role='student' and e.user_id=p_recipient)))
    and exists(select 1 from public.course_tutors ct join public.tutors t on t.id=ct.tutor_id
      where ct.course_id=p_course and t.user_id in (auth.uid(),p_recipient));
end $$;
revoke all on function public.can_message_user(uuid,uuid) from public,anon;

create or replace function public.messaging_contacts()
returns table(user_id uuid,full_name text,email text,avatar_url text,role text,course_id uuid,course_title text)
language plpgsql stable security definer set search_path=public as $$
declare my_role text;
begin
  select p.role into my_role from public.profiles p where p.id=auth.uid() and p.is_active;
  if my_role is null then raise exception 'An active account is required'; end if;
  if my_role in ('admin','super_admin') then
    return query select p.id,p.full_name,p.email,p.avatar_url,p.role,null::uuid,null::text from public.profiles p
      where p.id<>auth.uid() and p.is_active order by p.full_name;
  elsif my_role='student' then
    return query select p.id,p.full_name,p.email,p.avatar_url,p.role,c.id,c.title from public.enrollments e
      join public.courses c on c.id=e.course_id join public.course_tutors ct on ct.course_id=c.id
      join public.tutors t on t.id=ct.tutor_id join public.profiles p on p.id=t.user_id and p.role='tutor' and p.is_active
      where e.user_id=auth.uid() and e.status='active' order by c.title,p.full_name;
    return query select p.id,p.full_name,p.email,p.avatar_url,p.role,null::uuid,null::text from public.profiles p
      where p.role in ('admin','super_admin') and p.is_active order by p.full_name;
  elsif my_role='tutor' then
    return query select p.id,p.full_name,p.email,p.avatar_url,p.role,e.course_id,c.title from public.course_tutors ct
      join public.tutors t on t.id=ct.tutor_id and t.user_id=auth.uid() join public.courses c on c.id=ct.course_id
      join public.enrollments e on e.course_id=c.id and e.status='active' join public.profiles p on p.id=e.user_id and p.is_active
      order by c.title,p.full_name;
    return query select p.id,p.full_name,p.email,p.avatar_url,p.role,null::uuid,null::text from public.profiles p
      where p.role in ('tutor','admin','super_admin') and p.is_active and p.id<>auth.uid() order by p.full_name;
  end if;
end $$;
revoke all on function public.messaging_contacts() from public,anon;
grant execute on function public.messaging_contacts() to authenticated;

create or replace function public.open_direct_conversation(p_recipient uuid,p_course uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare pair_key text; v_conversation uuid; first_id uuid; second_id uuid;
begin
  if not public.can_message_user(p_recipient,p_course) then raise exception 'You are not allowed to start this conversation'; end if;
  first_id := least(auth.uid(),p_recipient); second_id := greatest(auth.uid(),p_recipient);
  pair_key := first_id::text||':'||second_id::text||':'||coalesce(p_course::text,'');
  insert into public.conversations(direct_key,course_id) values(pair_key,p_course)
    on conflict(direct_key) do update set direct_key=excluded.direct_key returning id into v_conversation;
  insert into public.conversation_participants(conversation_id,user_id) values(v_conversation,auth.uid()),(v_conversation,p_recipient)
    on conflict(conversation_id,user_id) do update set archived=false;
  return v_conversation;
end $$;
revoke all on function public.open_direct_conversation(uuid,uuid) from public,anon;
grant execute on function public.open_direct_conversation(uuid,uuid) to authenticated;

create or replace function public.messaging_inbox()
returns table(conversation_id uuid,other_user_id uuid,other_name text,other_email text,other_avatar text,other_role text,
  course_id uuid,course_title text,last_body text,last_sender uuid,last_at timestamptz,unread_count bigint,
  my_last_read_at timestamptz,archived boolean,muted boolean,pinned boolean)
language sql stable security definer set search_path=public as $$
  select c.id,other_p.user_id,coalesce(p.full_name,p.email,'Former user'),p.email,p.avatar_url,p.role,c.course_id,course.title,
    msg.body,msg.sender_id,c.last_message_at,
    (select count(*) from public.conversation_messages unread where unread.conversation_id=c.id and unread.sender_id<>auth.uid()
      and unread.read_at is null and (mine.last_read_at is null or unread.created_at>mine.last_read_at)),
    mine.last_read_at,mine.archived,mine.muted,mine.pinned
  from public.conversation_participants mine join public.conversations c on c.id=mine.conversation_id
  join public.conversation_participants other_p on other_p.conversation_id=c.id and other_p.user_id<>auth.uid()
  left join public.profiles p on p.id=other_p.user_id left join public.courses course on course.id=c.course_id
  left join lateral (select m.body,m.sender_id from public.conversation_messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1) msg on true
  where mine.user_id=auth.uid() and exists(select 1 from public.profiles active_profile where active_profile.id=auth.uid() and active_profile.is_active)
  order by mine.pinned desc,c.last_message_at desc
$$;
revoke all on function public.messaging_inbox() from public,anon;
grant execute on function public.messaging_inbox() to authenticated;

create or replace function public.messaging_can_access(p_conversation uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.conversation_participants cp join public.profiles p on p.id=cp.user_id
   where cp.conversation_id=p_conversation and cp.user_id=auth.uid() and p.is_active)
$$;
revoke all on function public.messaging_can_access(uuid) from public,anon;
grant execute on function public.messaging_can_access(uuid) to authenticated;

drop policy if exists conversation_presence_read on realtime.messages;
create policy conversation_presence_read on realtime.messages for select to authenticated using(
  extension in ('presence','broadcast') and realtime.topic() ~ '^messenger:[0-9a-f-]{36}$'
  and case when split_part(realtime.topic(),':',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.messaging_can_access(split_part(realtime.topic(),':',2)::uuid) else false end
);
drop policy if exists conversation_presence_write on realtime.messages;
create policy conversation_presence_write on realtime.messages for insert to authenticated with check(
  extension in ('presence','broadcast') and realtime.topic() ~ '^messenger:[0-9a-f-]{36}$'
  and case when split_part(realtime.topic(),':',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.messaging_can_access(split_part(realtime.topic(),':',2)::uuid) else false end
);

create or replace function public.can_access_tutor_group_chat_topic(p_topic text) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles active_profile where active_profile.id=auth.uid() and active_profile.is_active)
    and exists(select 1 from public.tutor_groups g where p_topic='tutor-course-chat-'||g.id::text
    and (public.is_admin() or g.owner_id=auth.uid() or public.is_enrolled(g.course_id)))
$$;
revoke all on function public.can_access_tutor_group_chat_topic(text) from public,anon;
grant execute on function public.can_access_tutor_group_chat_topic(text) to authenticated;

drop policy if exists courssins_private_user_topics_read on realtime.messages;
create policy courssins_private_user_topics_read on realtime.messages for select to authenticated using(
  realtime.topic() in ('student-dashboard-live-'||auth.uid()::text,'admin-dashboard-live-'||auth.uid()::text,
    'course-chat-'||auth.uid()::text,'messaging-inbox:'||auth.uid()::text,'notification-bell:'||auth.uid()::text)
);
drop policy if exists courssins_private_group_chat_read on realtime.messages;
create policy courssins_private_group_chat_read on realtime.messages for select to authenticated using(public.can_access_tutor_group_chat_topic(realtime.topic()));

drop policy if exists conversations_member_read on public.conversations;
create policy conversations_member_read on public.conversations for select to authenticated using(public.messaging_can_access(id));
drop policy if exists participants_member_read on public.conversation_participants;
create policy participants_member_read on public.conversation_participants for select to authenticated using(public.messaging_can_access(conversation_id));
drop policy if exists participants_self_update on public.conversation_participants;
create policy participants_self_update on public.conversation_participants for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists messages_member_read on public.conversation_messages;
create policy messages_member_read on public.conversation_messages for select to authenticated using(public.messaging_can_access(conversation_id));
drop policy if exists messages_member_insert on public.conversation_messages;
create policy messages_member_insert on public.conversation_messages for insert to authenticated with check(
  sender_id=auth.uid() and public.messaging_can_access(conversation_id)
  and (attachment_path is null or (split_part(attachment_path,'/',1)=conversation_id::text and split_part(attachment_path,'/',2)=auth.uid()::text))
);
grant select on public.conversations,public.conversation_participants,public.conversation_messages to authenticated;
grant update (last_read_at,archived,muted,pinned) on public.conversation_participants to authenticated;
grant insert (conversation_id,sender_id,client_nonce,body,attachment_path,attachment_name,attachment_type,attachment_size) on public.conversation_messages to authenticated;

create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then raise exception 'An active account is required'; end if;
  update public.conversation_participants set last_read_at=now(),archived=false
    where conversation_id=p_conversation and user_id=auth.uid();
  if not found then raise exception 'Conversation not found'; end if;
  update public.conversation_messages set read_at=now()
    where conversation_id=p_conversation and sender_id<>auth.uid() and read_at is null;
end $$;
revoke all on function public.mark_conversation_read(uuid) from public,anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Preserve existing direct staff inbox threads in the shared inbox.
insert into public.conversations(direct_key)
select distinct least(root.sender_id,root.recipient_id)::text||':'||greatest(root.sender_id,root.recipient_id)::text||':'
from public.staff_messages root where root.parent_id is null and root.recipient_id is not null
on conflict(direct_key) do nothing;
insert into public.conversation_participants(conversation_id,user_id)
select c.id,person.user_id from public.staff_messages root
join public.conversations c on c.direct_key=least(root.sender_id,root.recipient_id)::text||':'||greatest(root.sender_id,root.recipient_id)::text||':'
cross join lateral (values(root.sender_id),(root.recipient_id)) person(user_id)
where root.parent_id is null and root.recipient_id is not null
on conflict(conversation_id,user_id) do nothing;
insert into public.conversation_messages(conversation_id,sender_id,client_nonce,body,created_at)
select c.id,m.sender_id,m.id,coalesce(nullif(m.body,''),case when m.attachment_url is not null then 'Shared an attachment: '||m.attachment_url else 'Message unavailable' end),m.created_at
from public.staff_messages m
join public.staff_messages root on root.id=coalesce(m.parent_id,m.id)
join public.conversations c on c.direct_key=least(root.sender_id,root.recipient_id)::text||':'||greatest(root.sender_id,root.recipient_id)::text||':'
where root.parent_id is null and root.recipient_id is not null
on conflict(conversation_id,sender_id,client_nonce) do nothing;
update public.conversations c set last_message_at=coalesce((
  select max(m.created_at) from public.conversation_messages m where m.conversation_id=c.id
),c.last_message_at);

create or replace function public.notify_direct_message() returns trigger
language plpgsql security definer set search_path=public as $$
declare sender_name text; conv public.conversations; recipient record;
begin
  update public.conversations set last_message_at=new.created_at where id=new.conversation_id returning * into conv;
  select coalesce(full_name,'A Courssins user') into sender_name from public.profiles where id=new.sender_id;
  update public.conversation_participants set archived=false
    where conversation_id=new.conversation_id and user_id<>new.sender_id and not muted;
  for recipient in select cp.user_id,p.role from public.conversation_participants cp join public.profiles p on p.id=cp.user_id
    where cp.conversation_id=new.conversation_id and cp.user_id<>new.sender_id and not cp.muted
  loop
    insert into public.notifications(user_id,title,body,link,read)
    values(recipient.user_id,'New message from '||sender_name,
      case when length(new.body)>180 then left(new.body,177)||'…' else coalesce(nullif(new.body,''),'Sent an attachment') end,
      case when recipient.role='student' then 'dashboard.html#messages?conversation='||conv.id::text
        else 'admin.html#messages?conversation='||conv.id::text end,false);
  end loop;
  return new;
end $$;
revoke all on function public.notify_direct_message() from public,anon,authenticated;
drop trigger if exists conversation_message_notify on public.conversation_messages;
create trigger conversation_message_notify after insert on public.conversation_messages for each row execute function public.notify_direct_message();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('message-attachments','message-attachments',false,20971520,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists message_attachments_read on storage.objects;
create policy message_attachments_read on storage.objects for select to authenticated using(bucket_id='message-attachments' and case
  when split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then public.messaging_can_access(split_part(name,'/',1)::uuid) else false end);
drop policy if exists message_attachments_add on storage.objects;
create policy message_attachments_add on storage.objects for insert to authenticated with check(bucket_id='message-attachments' and case
  when split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then public.messaging_can_access(split_part(name,'/',1)::uuid) and split_part(name,'/',2)=auth.uid()::text else false end);
drop policy if exists message_attachments_delete on storage.objects;
create policy message_attachments_delete on storage.objects for delete to authenticated using(bucket_id='message-attachments' and split_part(name,'/',2)=auth.uid()::text and case
  when split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then public.messaging_can_access(split_part(name,'/',1)::uuid) else false end);

do $$ begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.conversation_participants;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.conversation_messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

commit;
