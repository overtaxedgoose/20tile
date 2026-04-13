// Server Component — fetches a puzzle by its sequential number, increments
// play_count via RPC, then renders the existing PlayGame client component.
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createClient as createUntypedClient } from "@supabase/supabase-js";
import PlayGame from "../PlayGame";

interface PageProps {
  params: Promise<{ number: string }>;
}

export default async function PlayByNumberPage({ params }: PageProps) {
  const { number: numberStr } = await params;
  const puzzleNumber = parseInt(numberStr, 10);

  if (isNaN(puzzleNumber) || puzzleNumber < 1) {
    redirect("/archive");
  }

  const supabase = createClient();

  const { data: puzzle, error } = await supabase
    .from("puzzles")
    .select("id, number, tiles, tile_order, status")
    .eq("number", puzzleNumber)
    .eq("status", "published")
    .single();

  if (error || !puzzle) {
    notFound();
  }

  // Increment play count asynchronously — fire and forget; don't block render.
  // Uses an untyped client to avoid handwritten-Database generic conflicts.
  const untypedSupabase = createUntypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  untypedSupabase.rpc("increment_play_count", { puzzle_id: puzzle.id }).then(() => {});

  // tiles in DB is the raw "|" / "," format (not url-encoded).
  // PlayGame's decodePuzzle() expects encodeURIComponent(rawTiles), so we wrap it.
  const encodedPuzzle = encodeURIComponent(puzzle.tiles);

  return (
    <PlayGame
      encodedPuzzle={encodedPuzzle}
      puzzleId={puzzle.id}
      puzzleNumber={puzzle.number}
      initialTileOrder={puzzle.tile_order ?? null}
    />
  );
}
