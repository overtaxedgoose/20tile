import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  let body: {
    section?: string;
    issue_type?: string;
    word?: string;
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { section, issue_type, word, notes } = body;

  if (!section || !issue_type || !word) {
    return NextResponse.json(
      { error: "Missing required fields: section, issue_type, word" },
      { status: 400 }
    );
  }

  if (!["regular", "junior"].includes(section)) {
    return NextResponse.json(
      { error: "section must be 'regular' or 'junior'" },
      { status: 400 }
    );
  }

  if (!["remove", "add"].includes(issue_type)) {
    return NextResponse.json(
      { error: "issue_type must be 'remove' or 'add'" },
      { status: 400 }
    );
  }

  const trimmedWord = word.trim().toLowerCase();
  if (!trimmedWord || trimmedWord.length > 50) {
    return NextResponse.json(
      { error: "word must be between 1 and 50 characters" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  const { error } = await supabase.from("word_reports").insert({
    section,
    issue_type,
    word: trimmedWord,
    notes: notes?.trim() || null,
  });

  if (error) {
    console.error("word_reports insert error:", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
