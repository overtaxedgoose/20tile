import { createClient } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { puzzleId } = await req.json();
    if (!puzzleId || typeof puzzleId !== "string") {
      return NextResponse.json({ error: "Missing puzzleId" }, { status: 400 });
    }

    const supabase = createClient();
    const { error } = await supabase.rpc("add_junior_balloon", { puzzle_id: puzzleId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
