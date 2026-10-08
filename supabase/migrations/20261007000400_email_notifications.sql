begin;

create table if not exists public.email_notification_deliveries (
  source_type text not null check (source_type in ('contact', 'newsletter')),
  source_id uuid not null,
  sender_hash text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (source_type, source_id)
);

create index if not exists idx_email_notification_rate
  on public.email_notification_deliveries(sender_hash, created_at desc);

alter table public.email_notification_deliveries enable row level security;
revoke all on table public.email_notification_deliveries from public, anon, authenticated;

commit;
