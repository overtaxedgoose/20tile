// Server Component — fetches all published puzzles and renders the archive.
// Force dynamic rendering so this page is never prerendered at build time.
// Archive data changes with every new puzzle, and Supabase must be reachable.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PuzzleRow } from "@/lib/supabase/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RatingDots({
  value,
  max = 3,
  color,
}: {
  value: number | null;
  max?: number;
  color: string;
}) {
  if (value === null) {
    return <span className="text-xs font-mono" style={{ color: "var(--green-dark)" }}>—</span>;
  }
  const filled = Math.round(value);
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: i < filled ? color : "var(--border)" }}
        />
      ))}
    </span>
  );
}

function DifficultyLabel({ value }: { value: number | null }) {
  if (value === null) return null;
  const r = Math.round(value);
  const labels = ["", "easy", "medium", "hard"];
  return (
    <span className="text-[10px] font-mono ml-1" style={{ color: "var(--green-dark)" }}>
      {labels[r] ?? ""}
    </span>
  );
}

function ClevernessLabel({ value }: { value: number | null }) {
  if (value === null) return null;
  const r = Math.round(value);
  const labels = ["", "meh", "clever", "genius"];
  return (
    <span className="text-[10px] font-mono ml-1" style={{ color: "var(--green-dark)" }}>
      {labels[r] ?? ""}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArchivePage() {
  const supabase = createClient();

  const { data: puzzles, error } = await supabase
    .from("puzzles")
    .select("id, number, title, creator_name, avg_difficulty, avg_cleverness, rating_count, play_count, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    return (
      <main className="flex items-center justify-center min-h-screen px-4">
        <p className="text-sm text-red-400 font-mono">Failed to load archive. Please refresh.</p>
      </main>
    );
  }

  const rows = (puzzles ?? []) as Pick<
    PuzzleRow,
    "id" | "number" | "title" | "creator_name" | "avg_difficulty" | "avg_cleverness" | "rating_count" | "play_count" | "published_at"
  >[];

  return (
    <main
      className="min-h-screen px-4 py-12"
      style={{ background: "var(--bg)" }}
    >
      <div className="max-w-lg mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs tracking-widest opacity-40 hover:opacity-100 transition-opacity font-mono"
              style={{ color: "var(--green)" }}
            >
              ← 20TILE
            </Link>
          </div>
          <h1
            className="text-2xl font-bold tracking-widest font-mono text-glow"
            style={{ color: "var(--green)" }}
          >
            PUZZLE ARCHIVE
          </h1>
          <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>
            {rows.length} puzzle{rows.length !== 1 ? "s" : ""} published
          </p>
        </div>

        <div className="border-t" style={{ borderColor: "var(--border)" }} />

        {/* Puzzle list */}
        {rows.length === 0 ? (
          <p className="text-sm font-mono" style={{ color: "var(--green-dark)" }}>
            No puzzles yet. Be the first —{" "}
            <Link href="/create" className="underline" style={{ color: "var(--green)" }}>
              create one
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((p) => (
              <Link
                key={p.id}
                href={`/play/${p.number}`}
                className="block border rounded-lg px-4 py-3 transition-all hover:bg-green-950 group"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: number + creator */}
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span
                        className="text-lg font-bold font-mono tabular-nums text-glow"
                        style={{ color: "var(--green)" }}
                      >
                        #{p.number}
                      </span>
                      {p.title && (
                        <span className="text-sm font-mono font-bold" style={{ color: "var(--green-dim)" }}>
                          {p.title}
                        </span>
                      )}
                      {p.creator_name && (
                        <span className="text-xs font-mono" style={{ color: "var(--green-muted)" }}>
                          by {p.creator_name}
                        </span>
                      )}
                    </div>

                    {/* Ratings */}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] tracking-widest font-mono" style={{ color: "var(--green-dark)" }}>
                          DIFF
                        </span>
                        <RatingDots value={p.avg_difficulty} color="var(--green)" />
                        <DifficultyLabel value={p.avg_difficulty} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] tracking-widest font-mono" style={{ color: "var(--green-dark)" }}>
                          WIT
                        </span>
                        <RatingDots value={p.avg_cleverness} color="#facc15" />
                        <ClevernessLabel value={p.avg_cleverness} />
                      </div>
                      {p.rating_count > 0 && (
                        <span className="text-[10px] font-mono" style={{ color: "var(--green-dark)" }}>
                          {p.rating_count} rating{p.rating_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: play count + arrow */}
                  <div className="flex-none flex flex-col items-end gap-1">
                    <span
                      className="text-[10px] font-mono tracking-wider"
                      style={{ color: "var(--green-dark)" }}
                    >
                      {p.play_count} play{p.play_count !== 1 ? "s" : ""}
                    </span>
                    <span
                      className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--green)" }}
                    >
                      PLAY →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="border-t pt-6" style={{ borderColor: "var(--border)" }}>
          <Link
            href="/create"
            className="block w-full py-3 border text-center tracking-widest uppercase text-xs font-mono transition-all hover:bg-green-950"
            style={{ borderColor: "var(--green)", color: "var(--green)" }}
          >
            + CREATE A PUZZLE
          </Link>
        </div>
      </div>
    </main>
  );
}
