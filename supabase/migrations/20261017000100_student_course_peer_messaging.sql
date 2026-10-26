begin;

-- Students may start a private conversation with another active student in
-- a course where both have an active enrollment.
create or replace function public.can_message_user(p_recipient uuid,p_course uuid default null) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare sender_role text; recipient_role text;
begin
  select role into sender_role from public.profiles where id=auth.uid() and is_active;
  select role into recipient_role from public.profiles where id=p_recipient and is_active;
  if sender_role is null or recipient_role is null or p_recipient=auth.uid() then return false; end if;
  if sender_role in ('admin','super_admin') or recipient_role in ('admin','super_admin') then return true; end if;
  if sender_role='tutor' and recipient_role='tutor' then return true; end if;
  if sender_role='student' and recipient_role='student' then
    return p_course is not null and exists(
      select 1 from public.enrollments sender_enrollment
      join public.enrollments recipient_enrollment on recipient_enrollment.course_id=sender_enrollment.course_id
      where sender_enrollment.course_id=p_course and sender_enrollment.user_id=auth.uid()
        and sender_enrollment.status='active' and recipient_enrollment.user_id=p_recipient
        and recipient_enrollment.status='active'
    );
  end if;
  if p_course is null then return false; end if;
  return exists(select 1 from public.enrollments e where e.course_id=p_course and e.status='active'
    and ((sender_role='student' and e.user_id=auth.uid()) or (recipient_role='student' and e.user_id=p_recipient)))
    and exists(select 1 from public.course_tutors ct join public.tutors t on t.id=ct.tutor_id
      where ct.course_id=p_course and t.user_id in (auth.uid(),p_recipient));
end $$;
revoke all on function public.can_message_user(uuid,uuid) from public,anon,authenticated;

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
    return query select distinct p.id,p.full_name,p.email,p.avatar_url,p.role,c.id,c.title
      from public.enrollments mine join public.enrollments peer on peer.course_id=mine.course_id and peer.status='active'
      join public.profiles p on p.id=peer.user_id and p.role='student' and p.is_active
      join public.courses c on c.id=mine.course_id
      where mine.user_id=auth.uid() and mine.status='active' and p.id<>auth.uid()
      order by c.title,p.full_name;
    return query select p.id,p.full_name,p.email,p.avatar_url,p.role,e.course_id,c.title from public.enrollments e
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

commit;
