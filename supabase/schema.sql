-- ─── 20Tile — Supabase Schema ────────────────────────────────────────────────
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.

-- ─── Enum ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE puzzle_status AS ENUM ('published', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Sequence (puzzle numbers) ───────────────────────────────────────────────
-- Gaps are acceptable (sequence does not roll back on failed inserts).

CREATE SEQUENCE IF NOT EXISTS puzzle_number_seq
  START 1
  INCREMENT 1
  NO CYCLE;

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS puzzles (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  number         integer       UNIQUE      DEFAULT nextval('puzzle_number_seq'),
  -- tiles: raw "|" and "," format, e.g. "st|em|in|gs,re|ma|ck|ab,..."
  -- NOT url-encoded — encodeURIComponent is applied in app code when needed.
  tiles          text          NOT NULL,
  -- tile_order: creator-defined starting arrangement, comma-separated tile IDs
  -- e.g. "s0-t0,s2-t1,s1-t3,..." — NULL means shuffle randomly on play
  tile_order     text,
  seed_words     text[]        NOT NULL,
  creator_name   text,
  status         puzzle_status NOT NULL    DEFAULT 'published',
  play_count     integer       NOT NULL    DEFAULT 0,
  -- Rolling averages on a 1–3 scale. NULL until first rating is submitted.
  avg_difficulty numeric(4,2),
  avg_cleverness numeric(4,2),
  rating_count   integer       NOT NULL    DEFAULT 0,
  published_at   timestamptz   NOT NULL    DEFAULT now()
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Direct UPDATE from the client is blocked entirely.
-- All mutations to play_count and ratings go through SECURITY DEFINER functions
-- (see below), which bypass RLS and only touch the columns they are supposed to.

ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;

-- Anyone can read published puzzles
CREATE POLICY "public_read_published"
  ON puzzles FOR SELECT
  USING (status = 'published');

-- Anyone can insert a new puzzle (no auth required)
CREATE POLICY "public_insert"
  ON puzzles FOR INSERT
  WITH CHECK (true);

-- No direct UPDATE policy — updates happen via RPC only.

-- ─── RPC: increment play count ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_play_count(puzzle_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE puzzles
  SET    play_count = play_count + 1
  WHERE  id = puzzle_id;
$$;

-- ─── RPC: submit a rating ────────────────────────────────────────────────────
-- Uses a rolling average formula.
-- COALESCE handles the NULL case for the very first rating on a puzzle.

CREATE OR REPLACE FUNCTION submit_rating(
  puzzle_id      uuid,
  difficulty_val integer,  -- 1 = easy,   2 = medium, 3 = hard
  cleverness_val integer   -- 1 = meh,    2 = clever, 3 = genius
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE puzzles
  SET
    avg_difficulty = (COALESCE(avg_difficulty, 0) * rating_count + difficulty_val)
                     / (rating_count + 1),
    avg_cleverness = (COALESCE(avg_cleverness, 0) * rating_count + cleverness_val)
                     / (rating_count + 1),
    rating_count   = rating_count + 1
  WHERE id = puzzle_id;
END;
$$;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS puzzles_number_idx      ON puzzles (number);
CREATE INDEX IF NOT EXISTS puzzles_published_at_idx ON puzzles (published_at DESC);
CREATE INDEX IF NOT EXISTS puzzles_status_idx      ON puzzles (status);
