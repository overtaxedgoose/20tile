-- Run this in your Supabase SQL editor to set up Junior mode.
-- ─────────────────────────────────────────────────────────────

-- 1. Create the junior_puzzles table
create table if not exists junior_puzzles (
  id            uuid primary key default gen_random_uuid(),
  number        bigint generated always as identity,
  tiles         text not null,           -- "t1|t2|t3,t1|t2|t3,..." (3 tiles per seed)
  seed_words    text[] not null,
  title         text,
  creator_name  text,
  status        text not null default 'published' check (status in ('published', 'hidden')),
  play_count    bigint not null default 0,
  published_at  timestamptz not null default now()
);

-- 2. Index for the archive page query (ordered by published_at desc)
create index if not exists junior_puzzles_published_at_idx
  on junior_puzzles (published_at desc)
  where status = 'published';

-- 3. RPC to increment play count (mirrors the main puzzles function)
create or replace function increment_junior_play_count(puzzle_id uuid)
returns void
language sql
security definer
as $$
  update junior_puzzles
  set play_count = play_count + 1
  where id = puzzle_id;
$$;

-- 4. Enable Row Level Security and allow public reads + inserts
alter table junior_puzzles enable row level security;

create policy "Junior puzzles are publicly readable"
  on junior_puzzles for select
  using (status = 'published');

create policy "Anyone can create a junior puzzle"
  on junior_puzzles for insert
  with check (true);
