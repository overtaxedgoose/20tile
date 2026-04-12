export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { JuniorPuzzleRow } from "@/lib/supabase/types";

export default async function JuniorArchivePage() {
  const supabase = createClient();

  const { data: puzzles, error } = await supabase
    .from("junior_puzzles")
    .select("id, number, title, creator_name, play_count, balloon_count, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    return (
      <main
        className="flex items-center justify-center min-h-screen px-4"
        style={{ background: "#f0f9ff" }}
      >
        <p className="text-sm text-red-500 font-mono">Failed to load puzzles. Please refresh.</p>
      </main>
    );
  }

  const rows = (puzzles ?? []) as Pick<
    JuniorPuzzleRow,
    "id" | "number" | "title" | "creator_name" | "play_count" | "balloon_count" | "published_at"
  >[];

  return (
    <main className="min-h-screen px-4 py-12" style={{ background: "#f0f9ff" }}>
      <div className="max-w-lg mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <Link
              href="/junior"
              className="text-xs tracking-widest font-mono text-slate-600 hover:text-slate-900 transition-colors"
            >
              ← JUNIOR HOME
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-widest font-mono" style={{ color: "#0369a1" }}>
            JUNIOR PUZZLES
          </h1>
          <p className="text-xs tracking-widest text-slate-600 font-mono">
            {rows.length} puzzle{rows.length !== 1 ? "s" : ""} available
          </p>
        </div>

        <div className="border-t border-slate-300" />

        {/* Puzzle list */}
        {rows.length === 0 ? (
          <p className="text-sm text-slate-700">
            No puzzles yet. Be the first —{" "}
            <Link href="/junior/create" className="underline text-sky-600">
              create one
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((p) => (
              <Link
                key={p.id}
                href={`/junior/play/${p.number}`}
                className="block border-2 border-slate-200 rounded-xl px-4 py-3 transition-all hover:border-sky-300 hover:bg-white group bg-white/80 shadow-sm space-y-2"
              >
                {/* Top row: title + meta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-lg font-bold font-mono tabular-nums text-sky-700">
                        #{p.number}
                      </span>
                      {p.title && (
                        <span className="text-sm font-mono font-bold text-slate-800">{p.title}</span>
                      )}
                      {p.creator_name && (
                        <span className="text-xs font-mono text-slate-600">by {p.creator_name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex-none flex flex-col items-end gap-1">
                    <span className="text-[10px] font-mono tracking-wider text-slate-500">
                      {p.play_count} play{p.play_count !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity text-sky-600 font-bold">
                      PLAY →
                    </span>
                  </div>
                </div>

                {/* Balloon row */}
                {p.balloon_count > 0 && (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <span className="text-lg leading-none">🎈</span>
                    <span className="text-sm font-bold font-mono text-sky-500">
                      {p.balloon_count} balloon{p.balloon_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        <div className="border-t border-slate-300 pt-6">
          <Link
            href="/junior/create"
            className="block w-full py-3 border-2 border-sky-400 text-center tracking-widest uppercase text-xs font-mono font-bold transition-all hover:bg-sky-50 rounded-xl text-sky-700"
          >
            + CREATE A PUZZLE
          </Link>
        </div>
      </div>
    </main>
  );
}
