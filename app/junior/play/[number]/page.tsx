// Server Component — fetches a junior puzzle by its sequential number,
// increments play_count, then renders PlayGameJunior.
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createClient as createUntypedClient } from "@supabase/supabase-js";
import PlayGameJunior from "../PlayGameJunior";

interface PageProps {
  params: Promise<{ number: string }>;
}

export default async function JuniorPlayByNumberPage({ params }: PageProps) {
  const { number: numberStr } = await params;
  const puzzleNumber = parseInt(numberStr, 10);

  if (isNaN(puzzleNumber) || puzzleNumber < 1) {
    redirect("/junior/archive");
  }

  const supabase = createClient();

  const { data: puzzle, error } = await supabase
    .from("junior_puzzles")
    .select("id, number, tiles, status, creator_name")
    .eq("number", puzzleNumber)
    .eq("status", "published")
    .single();

  if (error || !puzzle) {
    notFound();
  }

  // Increment play count — fire and forget
  const untypedSupabase = createUntypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  untypedSupabase.rpc("increment_junior_play_count", { puzzle_id: puzzle.id }).then(() => {});

  // Wrap raw DB tiles string in encodeURIComponent for PlayGameJunior's decoder
  const encodedPuzzle = encodeURIComponent(puzzle.tiles);

  return (
    <PlayGameJunior
      encodedPuzzle={encodedPuzzle}
      puzzleId={puzzle.id}
      puzzleNumber={puzzle.number}
      creatorName={puzzle.creator_name ?? undefined}
    />
  );
}
