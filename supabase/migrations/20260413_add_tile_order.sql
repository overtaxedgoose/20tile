-- Migration: add tile_order column to puzzles table
-- tile_order stores the creator's chosen starting arrangement as a
-- comma-separated list of tile IDs, e.g. "s0-t0,s2-t1,s1-t3,..."
-- NULL means no arrangement was set; the player side will shuffle randomly.

ALTER TABLE puzzles
  ADD COLUMN IF NOT EXISTS tile_order text;
