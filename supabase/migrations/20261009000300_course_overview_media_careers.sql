alter table public.courses
  add column if not exists intro_video_url text,
  add column if not exists why_important text,
  add column if not exists career_paths jsonb not null default '[]'::jsonb;
