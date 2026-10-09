begin;

-- Tutor group assignments become normal coursework, so student submissions and
-- admin/tutor grading use the existing assignment_submissions workflow.
alter table public.tutor_group_posts add column if not exists title text;
alter table public.tutor_group_posts add column if not exists assignment_id uuid references public.assignments(id) on delete set null;
alter table public.assignments add column if not exists attachment_url text;

create or replace function public.post_tutor_group_assignment(p_group uuid, p_title text, p_instructions text, p_attachment_url text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare g public.tutor_groups; assignment_key uuid; next_position integer;
begin
  select * into g from public.tutor_groups where id=p_group;
  if not found or not (g.owner_id=auth.uid() and public.owns_course(g.course_id)) then raise exception 'Only the assigned course tutor can post an assignment'; end if;
  if length(trim(coalesce(p_title,''))) < 2 then raise exception 'Assignment title is required'; end if;
  select coalesce(max(position),0)+1 into next_position from public.assignments where course_id=g.course_id;
  insert into public.assignments(course_id,title,instructions,max_score,position,attachment_url)
  values(g.course_id,trim(p_title),nullif(trim(p_instructions),''),100,next_position,p_attachment_url) returning id into assignment_key;
  insert into public.tutor_group_posts(group_id,author_id,post_type,title,body,attachment_url,assignment_id)
  values(g.id,auth.uid(),'assignment',trim(p_title),coalesce(nullif(trim(p_instructions),''),trim(p_title)),p_attachment_url,assignment_key);
  return assignment_key;
end $$;
revoke all on function public.post_tutor_group_assignment(uuid,text,text,text) from public,anon;
grant execute on function public.post_tutor_group_assignment(uuid,text,text,text) to authenticated;

-- Library pricing and sharing metadata.
alter table public.library add column if not exists pricing text not null default 'free' check(pricing in ('free','paid'));
alter table public.library add column if not exists price numeric(12,2) not null default 0 check(price >= 0);
alter table public.library add column if not exists currency text not null default 'NGN';
alter table public.library add column if not exists preview_pages integer not null default 6 check(preview_pages between 1 and 6);
alter table public.library add column if not exists object_path text;
alter table public.library add column if not exists preview_urls jsonb not null default '[]'::jsonb;
insert into storage.buckets(id,name,public,file_size_limit) values('library-files','library-files',false,104857600) on conflict(id) do update set public=false,file_size_limit=104857600;
drop policy if exists library_files_admin_write on storage.objects;
create policy library_files_admin_write on storage.objects for all using(bucket_id='library-files' and public.is_admin()) with check(bucket_id='library-files' and public.is_admin());
create table if not exists public.library_purchases (
 id uuid primary key default gen_random_uuid(),
 library_id uuid not null references public.library(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','paid','cancelled')),
 created_at timestamptz not null default now(),
 unique(library_id,user_id)
);
drop policy if exists library_files_read on storage.objects;
create policy library_files_read on storage.objects for select using(bucket_id='library-files' and exists(
 select 1 from public.library l where l.object_path=name and (public.is_admin() or l.pricing='free' or exists(select 1 from public.library_purchases p where p.library_id=l.id and p.user_id=auth.uid() and p.status='paid'))
));
alter table public.payments add column if not exists library_purchase_id uuid references public.library_purchases(id) on delete set null;
alter table public.library_purchases enable row level security;
drop policy if exists library_purchases_read on public.library_purchases;
create policy library_purchases_read on public.library_purchases for select using(user_id=auth.uid() or public.is_admin());
grant select on public.library_purchases to authenticated;

create or replace function public.start_library_purchase(p_library uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); item public.library; purchase public.library_purchases; payment_ref text;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and is_active) then raise exception 'Sign in to continue'; end if;
 select * into item from public.library where id=p_library and published;
 if not found then raise exception 'Library item not found'; end if;
 if item.pricing='free' or item.price<=0 then raise exception 'This library item is free'; end if;
 insert into public.library_purchases(library_id,user_id,status) values(item.id,uid,'pending')
 on conflict(library_id,user_id) do update set status=case when public.library_purchases.status='paid' then 'paid' else 'pending' end
 returning * into purchase;
 if purchase.status='paid' then return jsonb_build_object('status','paid','purchase_id',purchase.id); end if;
 payment_ref:='LIB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,18));
 insert into public.payments(user_id,amount,currency,provider,reference,status,library_purchase_id)
 values(uid,item.price,item.currency,'paystack',payment_ref,'pending',purchase.id);
 return jsonb_build_object('status','pending','purchase_id',purchase.id,'reference',payment_ref,'amount',item.price,'currency',item.currency);
end $$;
revoke all on function public.start_library_purchase(uuid) from public,anon;
grant execute on function public.start_library_purchase(uuid) to authenticated;

create or replace function public.set_library_purchase_paid() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.status='success' and new.library_purchase_id is not null then update public.library_purchases set status='paid' where id=new.library_purchase_id; end if;
 return new;
end $$;
drop trigger if exists payments_mark_library_purchase on public.payments;
create trigger payments_mark_library_purchase after insert or update of status on public.payments for each row execute function public.set_library_purchase_paid();

-- Event tickets support free booking and Paystack-paid tickets with verifiable codes.
alter table public.events add column if not exists fee numeric(12,2) not null default 0 check(fee>=0);
alter table public.events add column if not exists currency text not null default 'NGN';
alter table public.events add column if not exists location_type text not null default 'physical' check(location_type in ('physical','virtual'));
alter table public.events add column if not exists capacity integer check(capacity is null or capacity>0);
create table if not exists public.event_tickets (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 ticket_code text not null unique default ('CTI-EVT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 status text not null default 'pending' check(status in ('pending','valid','cancelled')),
 created_at timestamptz not null default now(),
 unique(event_id,user_id)
);
alter table public.payments add column if not exists event_ticket_id uuid references public.event_tickets(id) on delete set null;
alter table public.event_tickets enable row level security;
drop policy if exists event_tickets_read on public.event_tickets;
create policy event_tickets_read on public.event_tickets for select using(user_id=auth.uid() or public.is_admin());
grant select on public.event_tickets to authenticated;

create or replace function public.book_event_ticket(p_event uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); ev public.events; t public.event_tickets; ref text; taken integer;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and is_active) then raise exception 'Sign in to book a ticket'; end if;
 select * into ev from public.events where id=p_event and published;
 if not found then raise exception 'Event is unavailable'; end if;
 if ev.starts_at is not null and ev.starts_at < now() then raise exception 'This event has already started'; end if;
 select count(*) into taken from public.event_tickets where event_id=ev.id and status in ('valid','pending');
 if ev.capacity is not null and taken>=ev.capacity then raise exception 'This event is fully booked'; end if;
 insert into public.event_tickets(event_id,user_id,status) values(ev.id,uid,case when ev.fee=0 then 'valid' else 'pending' end)
 on conflict(event_id,user_id) do update set status=case when public.event_tickets.status='valid' then 'valid' else excluded.status end returning * into t;
 if t.status='valid' then return jsonb_build_object('status','valid','ticket_code',t.ticket_code,'event_title',ev.title); end if;
 ref:='EVT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,18));
 insert into public.payments(user_id,amount,currency,provider,reference,status,event_ticket_id)
 values(uid,ev.fee,ev.currency,'paystack',ref,'pending',t.id);
 return jsonb_build_object('status','pending','ticket_code',t.ticket_code,'reference',ref,'amount',ev.fee,'currency',ev.currency,'event_title',ev.title);
end $$;
revoke all on function public.book_event_ticket(uuid) from public,anon;
grant execute on function public.book_event_ticket(uuid) to authenticated;

create or replace function public.set_event_ticket_status() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.event_ticket_id is not null then
   update public.event_tickets set status=case when new.status='success' then 'valid' when new.status in ('failed','refunded') then 'cancelled' else 'pending' end where id=new.event_ticket_id;
 end if;
 return new;
end $$;
drop trigger if exists payments_mark_event_ticket on public.payments;
create trigger payments_mark_event_ticket after insert or update of status on public.payments for each row execute function public.set_event_ticket_status();

create or replace function public.verify_event_ticket(p_code text)
returns table(ticket_code text,status text,event_title text,event_starts_at timestamptz,attendee_name text,location text)
language sql stable security definer set search_path=public as $$
 select t.ticket_code,t.status,e.title,e.starts_at,p.full_name,e.location from public.event_tickets t
 join public.events e on e.id=t.event_id join public.profiles p on p.id=t.user_id
 where upper(t.ticket_code)=upper(trim(p_code)) limit 1
$$;
revoke all on function public.verify_event_ticket(text) from public;
grant execute on function public.verify_event_ticket(text) to anon,authenticated;

commit;
