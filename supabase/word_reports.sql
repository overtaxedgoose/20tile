-- ─── 20Tile — Word Reports Table ──────────────────────────────────────────────
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS.

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS word_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  section     text        NOT NULL CHECK (section IN ('regular', 'junior')),
  issue_type  text        NOT NULL CHECK (issue_type IN ('remove', 'add')),
  word        text        NOT NULL,
  notes       text,
  status      text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE word_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a report (no auth required)
CREATE POLICY "public_insert_word_reports"
  ON word_reports FOR INSERT
  WITH CHECK (true);

-- No public SELECT — review reports via Supabase dashboard or service key only.

-- ─── Index ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS word_reports_status_idx    ON word_reports (status);
CREATE INDEX IF NOT EXISTS word_reports_created_at_idx ON word_reports (created_at DESC);
