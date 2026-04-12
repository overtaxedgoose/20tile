import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use a plain untyped client — avoids TypeScript inference issues with
// handwritten Database generics and the supabase-js rpc() overloads.
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  let body: { puzzleId?: string; difficulty?: number; cleverness?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { puzzleId, difficulty, cleverness } = body;

  if (!puzzleId || typeof difficulty !== "number" || typeof cleverness !== "number") {
    return NextResponse.json(
      { error: "Missing required fields: puzzleId, difficulty, cleverness" },
      { status: 400 }
    );
  }

  if (difficulty < 1 || difficulty > 3 || cleverness < 1 || cleverness > 3) {
    return NextResponse.json(
      { error: "difficulty and cleverness must each be 1, 2, or 3" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  const { error } = await supabase.rpc("submit_rating", {
    puzzle_id: puzzleId,
    difficulty_val: difficulty,
    cleverness_val: cleverness,
  });

  if (error) {
    console.error("submit_rating RPC error:", error);
    return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
