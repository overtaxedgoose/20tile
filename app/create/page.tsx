"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  autoSplitWord,
  findAllValidWords,
  encodePuzzle,
  loadWordSet,
  scoreForTileCount,
  type Puzzle,
  type Tile,
} from "@/lib/word-engine";
import { createClient } from "@/lib/supabase/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEED_COUNT = 5;
const TILES_PER_SEED = 4;
const SEED_COLORS = [
  { bg: "bg-green-950", border: "border-green-500", text: "text-green-400", label: "SQ1" },
  { bg: "bg-blue-950",  border: "border-blue-500",  text: "text-blue-400",  label: "SQ2" },
  { bg: "bg-yellow-950",border: "border-yellow-600",text: "text-yellow-400",label: "SQ3" },
  { bg: "bg-orange-950",border: "border-orange-500",text: "text-orange-400",label: "SQ4" },
  { bg: "bg-red-950",   border: "border-red-500",   text: "text-red-400",   label: "SQ5" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeedState {
  word: string;           // raw input
  clean: string;          // lowercased, letters only
  tiles: string[];        // current 4-tile split
  splitPositions: number[]; // [p1, p2, p3] byte indices into clean
  error: string | null;
  inWordList: boolean | null; // null = not yet checked
}

interface ValidationState {
  checking: boolean;
  errors: string[];
  warnings: string[];
  duplicatePaths: string[];  // words with multiple tile-paths
  quartilesMissing: string[]; // seed words not in word list
  ok: boolean;
  // word discovery — populated once findAllValidWords has run
  wordGroups: { count: number; pts: number; words: DiscoveredWordEntry[] }[];
  totalWords: number;
  totalScore: number;
}

interface DiscoveredWordEntry {
  word: string;
  pts: number;
  isQuartile: boolean;
  isDuplicate: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tilesToSplitPositions(tiles: string[]): number[] {
  const positions: number[] = [];
  let pos = 0;
  for (let i = 0; i < tiles.length - 1; i++) {
    pos += tiles[i].length;
    positions.push(pos);
  }
  return positions;
}

function splitPositionsToTiles(clean: string, positions: number[]): string[] {
  const splits = [0, ...positions, clean.length];
  return splits.slice(0, -1).map((start, i) => clean.slice(start, splits[i + 1]));
}

function canShiftBoundary(
  clean: string,
  positions: number[],
  boundaryIdx: number,
  direction: 1 | -1
): boolean {
  const newPositions = [...positions];
  newPositions[boundaryIdx] += direction;
  const newTiles = splitPositionsToTiles(clean, newPositions);
  return (
    newTiles.length === TILES_PER_SEED &&
    newTiles.every((t) => t.length >= 2 && t.length <= 4)
  );
}

// ─── Components ───────────────────────────────────────────────────────────────

function TileBox({
  letters,
  colorClass,
  borderClass,
  textClass,
}: {
  letters: string;
  colorClass: string;
  borderClass: string;
  textClass: string;
}) {
  return (
    <div
      className={`
        flex-1 min-w-0 flex items-center justify-center
        border ${borderClass} ${colorClass}
        py-2 px-1 rounded text-center
        font-mono text-sm sm:text-base font-bold tracking-widest uppercase
        ${textClass}
        select-none
      `}
    >
      {letters || "??"}
    </div>
  );
}

function SplitButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Shift split left" : "Shift split right"}
      className={`
        w-5 h-5 flex items-center justify-center rounded text-xs leading-none
        transition-opacity
        ${
          disabled
            ? "opacity-20 cursor-not-allowed"
            : "opacity-60 hover:opacity-100 cursor-pointer"
        }
      `}
      style={{ color: "var(--green-dim)", border: "1px solid var(--border)" }}
    >
      {direction === "left" ? "◀" : "▶"}
    </button>
  );
}

function SeedRow({
  idx,
  state,
  onWordChange,
  onShift,
}: {
  idx: number;
  state: SeedState;
  onWordChange: (idx: number, value: string) => void;
  onShift: (seedIdx: number, boundaryIdx: number, direction: 1 | -1) => void;
}) {
  const color = SEED_COLORS[idx];

  return (
    <div className="space-y-2">
      {/* Row header + input */}
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-bold tracking-widest w-8 text-center ${color.text}`}
        >
          {color.label}
        </span>
        <input
          type="text"
          value={state.word}
          onChange={(e) => onWordChange(idx, e.target.value)}
          placeholder={`seed word ${idx + 1} (8–16 letters)`}
          maxLength={20}
          spellCheck={false}
          className={`
            flex-1 bg-transparent border rounded px-3 py-2
            font-mono text-sm tracking-wider uppercase
            outline-none transition-colors
            placeholder:opacity-30 placeholder:normal-case placeholder:tracking-normal
            ${
              state.error
                ? "border-red-700 text-red-400"
                : state.clean.length >= 8
                ? `${color.border} ${color.text}`
                : "text-green-600"
            }
          `}
          style={{ borderColor: state.error ? undefined : state.clean.length < 8 ? "var(--border)" : undefined }}
        />
        {/* Length badge */}
        {state.clean.length > 0 && (
          <span
            className="text-xs w-6 text-right tabular-nums"
            style={{ color: state.clean.length >= 8 && state.clean.length <= 16 ? "var(--green-dim)" : "var(--red, #f87171)" }}
          >
            {state.clean.length}
          </span>
        )}
      </div>

      {/* Error message */}
      {state.error && (
        <p className="text-xs text-red-400 pl-11">{state.error}</p>
      )}

      {/* Not-in-wordlist warning */}
      {!state.error && state.clean.length >= 8 && state.inWordList === false && (
        <p className="text-xs pl-11" style={{ color: "var(--green-muted)" }}>
          ⚠ &quot;{state.clean}&quot; not in word list — seed won&apos;t form a scoreable quartile
        </p>
      )}

      {/* Tile strip with split controls */}
      {!state.error && state.tiles.length === TILES_PER_SEED && (
        <div className="pl-11">
          <div className="flex items-center gap-1">
            {state.tiles.map((tile, ti) => (
              <div key={ti} className="flex items-center gap-1 flex-1 min-w-0">
                <TileBox
                  letters={tile}
                  colorClass={color.bg}
                  borderClass={color.border}
                  textClass={color.text}
                />
                {/* Split controls between tiles */}
                {ti < TILES_PER_SEED - 1 && (
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <SplitButton
                      direction="left"
                      disabled={!canShiftBoundary(state.clean, state.splitPositions, ti, 1)}
                      onClick={() => onShift(idx, ti, 1)}
                    />
                    <SplitButton
                      direction="right"
                      disabled={!canShiftBoundary(state.clean, state.splitPositions, ti, -1)}
                      onClick={() => onShift(idx, ti, -1)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Letter guide under tiles */}
          <div className="mt-1 flex pl-0 text-xs" style={{ color: "var(--green-dark)" }}>
            <span className="flex-1 text-center">{state.tiles[0]?.length}L</span>
            <span className="w-5" />
            <span className="flex-1 text-center">{state.tiles[1]?.length}L</span>
            <span className="w-5" />
            <span className="flex-1 text-center">{state.tiles[2]?.length}L</span>
            <span className="w-5" />
            <span className="flex-1 text-center">{state.tiles[3]?.length}L</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ArrangeTilesGrid ─────────────────────────────────────────────────────────
// Native HTML5 drag-and-drop grid for setting the puzzle's starting tile order.
// Renders all 20 tiles in a 4×5 grid; drag any tile onto another to reorder.

function ArrangeTilesGrid({
  tiles,
  order,
  onReorder,
}: {
  tiles: Tile[];
  order: string[];
  onReorder: (newOrder: string[]) => void;
}) {
  const draggedIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const tileById = useMemo(
    () => Object.fromEntries(tiles.map((t) => [t.id, t])),
    [tiles]
  );

  const handleDragStart = (id: string) => {
    draggedIdRef.current = id;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = draggedIdRef.current;
    if (!draggedId || draggedId === targetId) {
      setDragOverId(null);
      return;
    }
    const newOrder = [...order];
    const fromIdx = newOrder.indexOf(draggedId);
    newOrder.splice(fromIdx, 1);
    const toIdx = newOrder.indexOf(targetId);
    newOrder.splice(toIdx, 0, draggedId);
    onReorder(newOrder);
    setDragOverId(null);
    draggedIdRef.current = null;
  };

  const handleDragEnd = () => {
    setDragOverId(null);
    draggedIdRef.current = null;
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {order.map((id) => {
        const tile = tileById[id];
        if (!tile) return null;
        const color = SEED_COLORS[tile.seedIndex];
        const isDragOver = dragOverId === id;
        return (
          <div
            key={id}
            draggable
            onDragStart={() => handleDragStart(id)}
            onDragOver={(e) => handleDragOver(e, id)}
            onDrop={(e) => handleDrop(e, id)}
            onDragEnd={handleDragEnd}
            className={`
              flex items-center justify-center
              border rounded py-3 px-1
              font-mono text-sm font-bold tracking-widest uppercase
              cursor-grab active:cursor-grabbing select-none
              transition-all duration-100
              ${color.bg} ${color.text}
              ${isDragOver
                ? "border-white/70 ring-1 ring-white/30 scale-105"
                : color.border
              }
            `}
          >
            {tile.letters}
          </div>
        );
      })}
    </div>
  );
}

function ValidationPanel({ result }: { result: ValidationState | null }) {
  if (!result) return null;

  if (result.checking) {
    return (
      <div className="border rounded p-4 text-sm animate-pulse" style={{ borderColor: "var(--border)" }}>
        <span style={{ color: "var(--green-muted)" }}>VALIDATING PUZZLE…</span>
      </div>
    );
  }

  const allClear =
    result.ok &&
    result.errors.length === 0 &&
    result.duplicatePaths.length === 0;

  return (
    <div
      className="border rounded p-4 space-y-2 text-sm"
      style={{
        borderColor: allClear ? "var(--green-dim)" : "#7f1d1d",
        background: allClear ? "var(--bg-panel)" : "rgba(127,29,29,0.1)",
      }}
    >
      <p
        className="font-bold tracking-widest text-xs"
        style={{ color: allClear ? "var(--green)" : "#f87171" }}
      >
        {allClear ? "✅ PUZZLE VALID" : "⚠ VALIDATION ISSUES"}
      </p>

      {result.errors.map((e, i) => (
        <p key={i} className="text-red-400">✗ {e}</p>
      ))}

      {result.quartilesMissing.length > 0 && (
        <div>
          <p style={{ color: "var(--green-muted)" }}>
            ⚠ These seed words aren&apos;t in the word list (won&apos;t score as quartiles):
          </p>
          {result.quartilesMissing.map((w, i) => (
            <p key={i} className="pl-4" style={{ color: "var(--green-muted)" }}>{w}</p>
          ))}
        </div>
      )}

      {result.duplicatePaths.length > 0 && (
        <div>
          <p className="text-yellow-400">
            ⚠ {result.duplicatePaths.length} word(s) reachable via multiple tile paths:
          </p>
          {result.duplicatePaths.slice(0, 5).map((w, i) => (
            <p key={i} className="pl-4 text-yellow-400/70">{w}</p>
          ))}
          {result.duplicatePaths.length > 5 && (
            <p className="pl-4 text-yellow-400/50">…and {result.duplicatePaths.length - 5} more</p>
          )}
        </div>
      )}

      {result.warnings.map((w, i) => (
        <p key={i} style={{ color: "var(--green-muted)" }}>ℹ {w}</p>
      ))}

      {allClear && (
        <p style={{ color: "var(--green-muted)" }}>
          All 5 quartiles are reachable. Ready to publish.
        </p>
      )}

      {/* ── Word discovery results ── */}
      {result.wordGroups.length > 0 && (
        <div
          className="mt-4 pt-4 space-y-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Summary bar */}
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-bold tracking-widest" style={{ color: "var(--green-dim)" }}>
              DISCOVERABLE WORDS
            </p>
            <div className="flex items-baseline gap-4 text-xs font-mono tabular-nums">
              {result.duplicatePaths.length > 0 && (
                <span className="text-red-400">
                  {result.duplicatePaths.length} dup{result.duplicatePaths.length !== 1 ? "s" : ""}
                </span>
              )}
              <span style={{ color: "var(--green-muted)" }}>
                {result.totalWords} word{result.totalWords !== 1 ? "s" : ""}
              </span>
              <span style={{ color: "var(--green)" }}>
                {result.totalScore} pts max
              </span>
            </div>
          </div>

          {result.totalWords === 0 && (
            <p className="text-xs" style={{ color: "var(--green-dark)" }}>
              No valid words found with current tile splits.
            </p>
          )}

          {/* Per-count groups */}
          {result.wordGroups.map(({ count, pts, words }) => {
            if (words.length === 0) return null;
            const label = `${count}-TILE WORDS`;
            return (
              <div key={count} className="space-y-1.5">
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-xs font-bold tracking-widest"
                    style={{ color: "var(--green-dim)" }}
                  >
                    {label}
                  </span>
                  <span className="text-xs tabular-nums" style={{ color: "var(--green-dark)" }}>
                    {pts}pt each · {words.length} found
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {words.map(({ word, isQuartile, isDuplicate }) => {
                    const chipCls = isDuplicate
                      ? "border-red-700 bg-red-950 text-red-400"
                      : isQuartile
                      ? "border-yellow-600 bg-yellow-950 text-yellow-300"
                      : "border-green-900 bg-black text-green-500";
                    const tipText = isDuplicate
                      ? "Reachable via multiple tile paths"
                      : isQuartile
                      ? "Quartile — uses all 4 tiles from one seed"
                      : "";
                    return (
                      <span
                        key={word}
                        title={tipText}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded text-xs font-mono font-bold uppercase tracking-wider ${chipCls}`}
                      >
                        {isQuartile && !isDuplicate && <span className="opacity-70">★</span>}
                        {isDuplicate && <span className="opacity-70">⚠</span>}
                        {word}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div
            className="flex flex-wrap gap-4 pt-1 text-xs border-t"
            style={{ borderColor: "var(--border)", color: "var(--green-dark)" }}
          >
            <span className="text-yellow-600">★ quartile (8pts)</span>
            <span className="text-red-700">⚠ duplicate path</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function makeSeedState(word: string): SeedState {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (clean.length === 0) {
    return { word, clean, tiles: [], splitPositions: [], error: null, inWordList: null };
  }
  if (clean.length < 8) {
    return { word, clean, tiles: [], splitPositions: [], error: "Too short — need 8–16 letters", inWordList: null };
  }
  if (clean.length > 16) {
    return { word, clean, tiles: [], splitPositions: [], error: "Too long — need 8–16 letters", inWordList: null };
  }
  const tiles = autoSplitWord(clean);
  if (!tiles) {
    return { word, clean, tiles: [], splitPositions: [], error: "Cannot split into 4 valid tiles", inWordList: null };
  }
  return {
    word,
    clean,
    tiles,
    splitPositions: tilesToSplitPositions(tiles),
    error: null,
    inWordList: null,
  };
}

type PublishStage = "idle" | "form" | "submitting" | "published" | "error";

export default function CreatePage() {
  const router = useRouter();
  const [seeds, setSeeds] = useState<SeedState[]>(
    Array.from({ length: SEED_COUNT }, () => makeSeedState(""))
  );
  const [wordSet, setWordSet] = useState<Set<string> | null>(null);
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [validating, setValidating] = useState(false);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Arrange starting positions ───────────────────────────────────────────────
  // Ordered array of tile IDs representing the creator's desired starting layout.
  // Initialised / reset whenever the tile splits change.
  const [arrangeOrder, setArrangeOrder] = useState<string[]>([]);

  // ── Publish flow state ───────────────────────────────────────────────────────
  const [publishStage, setPublishStage] = useState<PublishStage>("idle");
  const [puzzleTitle, setPuzzleTitle] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedNumber, setPublishedNumber] = useState<number | null>(null);
  const [publishedLinkCopied, setPublishedLinkCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [fallbackCopied, setFallbackCopied] = useState(false);

  // Load word list once
  useEffect(() => {
    loadWordSet().then(setWordSet).catch(console.error);
  }, []);

  // Check seed words against word list whenever wordSet or seeds change
  useEffect(() => {
    if (!wordSet) return;
    setSeeds((prev) =>
      prev.map((s) => ({
        ...s,
        inWordList: s.clean.length >= 8 ? wordSet.has(s.clean) : null,
      }))
    );
  }, [wordSet, seeds.map((s) => s.clean).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset arrange order to natural (seed-by-seed) order whenever tiles change
  useEffect(() => {
    if (allSeedsReady) {
      setArrangeOrder(
        seeds.flatMap((s, si) => s.tiles.map((_, ti) => `s${si}-t${ti}`))
      );
    } else {
      setArrangeOrder([]);
    }
  }, [allSeedsReady, seeds.map((s) => s.tiles.join("|")).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle word input changes
  const handleWordChange = useCallback((idx: number, value: string) => {
    setSeeds((prev) => {
      const next = [...prev];
      next[idx] = makeSeedState(value);
      return next;
    });
    setValidation(null);
    setPublishStage("idle");
    setFallbackUrl(null);
  }, []);

  // Handle split-boundary shifts
  const handleShift = useCallback(
    (seedIdx: number, boundaryIdx: number, direction: 1 | -1) => {
      setSeeds((prev) => {
        const next = [...prev];
        const s = { ...next[seedIdx] };
        const newPositions = [...s.splitPositions];
        newPositions[boundaryIdx] += direction;
        s.splitPositions = newPositions;
        s.tiles = splitPositionsToTiles(s.clean, newPositions);
        next[seedIdx] = s;
        return next;
      });
      setValidation(null);
      setPublishStage("idle");
      setFallbackUrl(null);
    },
    []
  );

  // Check all 5 seeds are ready
  const allSeedsReady = seeds.every(
    (s) => s.clean.length >= 8 && s.error === null && s.tiles.length === TILES_PER_SEED
  );

  // Run full validation
  const handleValidate = useCallback(async () => {
    if (!allSeedsReady) return;
    setValidating(true);
    setValidation({
      checking: true,
      errors: [], warnings: [], duplicatePaths: [], quartilesMissing: [],
      ok: false, wordGroups: [], totalWords: 0, totalScore: 0,
    });

    // Yield to paint the "checking…" state
    await new Promise((r) => setTimeout(r, 50));

    const errors: string[] = [];
    const warnings: string[] = [];
    const quartilesMissing: string[] = [];

    // Build a puzzle object from current seed splits
    const seedTiles: Tile[][] = seeds.map((s, si) =>
      s.tiles.map((letters, ti) => ({
        id: `s${si}-t${ti}`,
        letters,
        seedIndex: si,
        tileIndex: ti,
      }))
    );
    const puzzle: Puzzle = {
      tiles: seedTiles.flat(),
      seedWords: seeds.map((s) => s.clean),
      seedTiles,
    };

    // Check tile sizes
    for (const tile of puzzle.tiles) {
      if (tile.letters.length < 2 || tile.letters.length > 4) {
        errors.push(`Tile "${tile.letters}" (${tile.id}) is ${tile.letters.length} letters — must be 2–4.`);
      }
    }

    // Check quartiles in word list
    if (wordSet) {
      for (const s of seeds) {
        if (!wordSet.has(s.clean)) {
          quartilesMissing.push(s.clean);
        }
      }
    }

    // Run findAllValidWords once — used for both duplicate detection AND word groups
    let duplicatePaths: string[] = [];
    let wordGroups: ValidationState["wordGroups"] = [];
    let totalWords = 0;
    let totalScore = 0;

    if (wordSet && errors.length === 0) {
      try {
        const allWords = findAllValidWords(puzzle, wordSet);

        // Classify every result
        const byCount = new Map<number, DiscoveredWordEntry[]>(
          [1, 2, 3, 4].map((n) => [n, []])
        );
        const seedIdxOf = (id: string) => parseInt(id.split("-")[0].slice(1), 10);

        for (const [word, paths] of allWords.entries()) {
          const tileCount = paths[0].length;
          const pts = scoreForTileCount(tileCount);
          const isDuplicate = paths.length > 1;

          // Quartile: 4-tile word where all IDs belong to the same seed group
          let isQuartile = false;
          if (tileCount === 4) {
            isQuartile = paths.some((path) => {
              const first = seedIdxOf(path[0]);
              return (
                path.every((id) => seedIdxOf(id) === first) &&
                puzzle.seedTiles[first]?.every((st) => path.includes(st.id))
              );
            });
          }

          if (isDuplicate) duplicatePaths.push(word);
          totalScore += pts;
          byCount.get(tileCount)!.push({ word, pts, isQuartile, isDuplicate });
        }

        // Sort alphabetically within each group
        for (const arr of byCount.values()) arr.sort((a, b) => a.word.localeCompare(b.word));

        // ── Extra-quartile check ─────────────────────────────────────────────
        // Exactly 5 quartiles must exist — one per seed word, no more.
        // Any other discoverable 4-tile word (cross-seed or additional same-seed)
        // would confuse players and must block publishing.
        const seedWordSet = new Set(seeds.map((s) => s.clean));
        const extraQuartiles = byCount.get(4)!.filter((w) => !seedWordSet.has(w.word));
        if (extraQuartiles.length > 0) {
          const listed = extraQuartiles.map((w) => w.word).join(", ");
          errors.push(
            `${extraQuartiles.length} additional 4-tile word${extraQuartiles.length !== 1 ? "s" : ""} found beyond the 5 required quartiles: ${listed}. Adjust your tile splits to eliminate these.`
          );
        }

        totalWords = allWords.size;
        wordGroups = [1, 2, 3, 4].map((count) => ({
          count,
          pts: scoreForTileCount(count),
          words: byCount.get(count)!,
        }));
      } catch {
        warnings.push("Word discovery scan failed — puzzle may be unusually complex.");
      }
    }

    setValidation({
      checking: false,
      errors,
      warnings,
      duplicatePaths,
      quartilesMissing,
      ok: errors.length === 0,
      wordGroups,
      totalWords,
      totalScore,
    });
    setValidating(false);
  }, [allSeedsReady, seeds, wordSet]);

  // Open the publish name-entry form
  const handleOpenPublishForm = useCallback(() => {
    if (!validation?.ok) return;
    setPublishStage("form");
    setPublishError(null);
    setFallbackUrl(null);
  }, [validation]);

  // Submit to Supabase; fall back to URL if unavailable
  const handleSubmitPublish = useCallback(async () => {
    if (!allSeedsReady) return;
    setPublishStage("submitting");
    setPublishError(null);

    // Raw tiles string stored in DB — NOT url-encoded
    const rawTiles = seeds.map((s) => s.tiles.join("|")).join(",");

    try {
      const supabase = createClient();
      // tile_order: use the creator's arrangement if it covers all 20 tiles
      const tileOrderValue =
        arrangeOrder.length === 20 ? arrangeOrder.join(",") : null;

      const { data, error } = await supabase
        .from("puzzles")
        .insert({
          tiles: rawTiles,
          tile_order: tileOrderValue,
          seed_words: seeds.map((s) => s.clean),
          title: puzzleTitle.trim() || null,
          creator_name: creatorName.trim() || null,
          status: "published",
        })
        .select("number")
        .single();

      if (error) throw error;
      setPublishedNumber(data.number);
      setPublishStage("published");
    } catch (err) {
      console.error("Publish failed:", err);
      // Fallback: generate the old ?p= URL so the puzzle isn't lost
      const seedTiles: Tile[][] = seeds.map((s, si) =>
        s.tiles.map((letters, ti) => ({
          id: `s${si}-t${ti}`,
          letters,
          seedIndex: si,
          tileIndex: ti,
        }))
      );
      const puzzle: Puzzle = {
        tiles: seedTiles.flat(),
        seedWords: seeds.map((s) => s.clean),
        seedTiles,
      };
      const encoded = encodePuzzle(puzzle);
      const url = `${window.location.origin}/play?p=${encoded}`;
      setFallbackUrl(url);
      setPublishError("Could not reach the database — here's a shareable link instead:");
      setPublishStage("error");
    }
  }, [allSeedsReady, seeds, creatorName, router]);

  // Copy fallback URL to clipboard
  const handleCopyFallback = useCallback(async () => {
    if (!fallbackUrl) return;
    try {
      await navigator.clipboard.writeText(fallbackUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = fallbackUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setFallbackCopied(true);
    setTimeout(() => setFallbackCopied(false), 2000);
  }, [fallbackUrl]);

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs tracking-widest opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: "var(--green)" }}
          >
            ← BACK
          </Link>
          <span className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>
            PUZZLE CREATOR
          </span>
        </div>
        <h1
          className="text-3xl font-bold tracking-widest text-glow"
          style={{ color: "var(--green)" }}
        >
          20TILE
        </h1>
        <p className="text-xs tracking-wide" style={{ color: "var(--green-muted)" }}>
          Enter 5 seed words (8–16 letters each). Each word is split into 4 tiles.
        </p>
      </header>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: "var(--border)" }} />

      {/* Word list loading state */}
      {!wordSet && (
        <p className="text-xs animate-pulse" style={{ color: "var(--green-muted)" }}>
          Loading word list…
        </p>
      )}

      {/* Seed rows */}
      <div className="space-y-6">
        {seeds.map((s, i) => (
          <SeedRow
            key={i}
            idx={i}
            state={s}
            onWordChange={handleWordChange}
            onShift={handleShift}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: "var(--border)" }} />

      {/* Tile summary */}
      {allSeedsReady && (
        <div className="space-y-2">
          <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>
            ALL 20 TILES
          </p>
          <div className="flex flex-wrap gap-2">
            {seeds.flatMap((s, si) =>
              s.tiles.map((tile, ti) => {
                const color = SEED_COLORS[si];
                return (
                  <span
                    key={`${si}-${ti}`}
                    className={`
                      inline-flex items-center px-2 py-1 text-xs font-mono font-bold
                      uppercase tracking-widest border rounded
                      ${color.border} ${color.text} ${color.bg}
                    `}
                  >
                    {tile}
                  </span>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Validate */}
        <button
          onClick={handleValidate}
          disabled={!allSeedsReady || validating}
          className={`
            w-full py-3 px-6 border text-sm tracking-widest uppercase font-mono
            transition-all rounded
            ${
              allSeedsReady && !validating
                ? "hover:bg-green-950 cursor-pointer opacity-100"
                : "opacity-30 cursor-not-allowed"
            }
          `}
          style={{ borderColor: "var(--green)", color: "var(--green)" }}
        >
          {validating ? "[ VALIDATING… ]" : "[ VALIDATE PUZZLE ]"}
        </button>

        {/* Validation result */}
        <ValidationPanel result={validation} />

        {/* Arrange starting positions — shown when validation passes */}
        {validation?.ok && arrangeOrder.length === 20 && (
          <div className="space-y-3">
            <div className="border-t" style={{ borderColor: "var(--border)" }} />
            <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>
              ARRANGE STARTING POSITIONS
            </p>
            <p className="text-xs" style={{ color: "var(--green-dark)" }}>
              Drag tiles to set the order players will see when the puzzle loads.
            </p>
            <ArrangeTilesGrid
              tiles={seeds.flatMap((s, si) =>
                s.tiles.map((letters, ti) => ({
                  id: `s${si}-t${ti}`,
                  letters,
                  seedIndex: si,
                  tileIndex: ti,
                }))
              )}
              order={arrangeOrder}
              onReorder={setArrangeOrder}
            />
            <button
              onClick={() =>
                setArrangeOrder(
                  seeds.flatMap((s, si) => s.tiles.map((_, ti) => `s${si}-t${ti}`))
                )
              }
              className="w-full py-2 border text-xs tracking-widest uppercase font-mono transition-all rounded hover:bg-green-950"
              style={{ borderColor: "var(--border)", color: "var(--green-muted)" }}
            >
              [ RESET TO SEED ORDER ]
            </button>
          </div>
        )}

        {/* Publish — only enabled once validation passes */}
        {publishStage === "idle" && (
          <button
            onClick={handleOpenPublishForm}
            disabled={!validation?.ok}
            className={`
              w-full py-3 px-6 border text-sm tracking-widest uppercase font-mono
              transition-all rounded
              ${
                validation?.ok
                  ? "hover:bg-green-950 cursor-pointer opacity-100"
                  : "opacity-30 cursor-not-allowed"
              }
            `}
            style={{ borderColor: "var(--green)", color: "var(--green)" }}
          >
            [ PUBLISH PUZZLE ]
          </button>
        )}

        {/* Published confirmation */}
        {publishStage === "published" && publishedNumber != null && (
          <div
            className="border rounded p-4 space-y-4"
            style={{ borderColor: "var(--green-dim)", background: "var(--bg-panel)" }}
          >
            <div className="text-center space-y-1">
              <p className="text-2xl">🎉</p>
              <p className="text-sm font-bold tracking-widest font-mono text-glow" style={{ color: "var(--green)" }}>
                PUZZLE #{publishedNumber} PUBLISHED
              </p>
            </div>
            <div
              className="text-xs break-all font-mono p-2 rounded border text-center"
              style={{ borderColor: "var(--green-dark)", color: "var(--green-dim)", background: "var(--bg)" }}
            >
              20tile.app/play/{publishedNumber}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const url = `https://20tile.app/play/${publishedNumber}`;
                  try { await navigator.clipboard.writeText(url); }
                  catch {
                    const el = document.createElement("textarea");
                    el.value = url; document.body.appendChild(el); el.select();
                    document.execCommand("copy"); document.body.removeChild(el);
                  }
                  setPublishedLinkCopied(true);
                  setTimeout(() => setPublishedLinkCopied(false), 2000);
                }}
                className="flex-1 py-2 border text-xs tracking-widest uppercase font-mono transition-all rounded hover:bg-green-950"
                style={{ borderColor: "var(--green)", color: "var(--green)" }}
              >
                {publishedLinkCopied ? "✓ COPIED" : "[ COPY LINK ]"}
              </button>
              <a
                href={`/play/${publishedNumber}`}
                className="flex-1 py-2 border text-xs tracking-widest uppercase font-mono text-center transition-all rounded hover:bg-green-950"
                style={{ borderColor: "var(--green-dim)", color: "var(--green-dim)" }}
              >
                [ PLAY NOW ]
              </a>
            </div>
          </div>
        )}

        {/* Publish form */}
        {(publishStage === "form" || publishStage === "submitting" || publishStage === "error") && (
          <div
            className="border rounded p-4 space-y-4"
            style={{ borderColor: "var(--green-dim)", background: "var(--bg-panel)" }}
          >
            <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>
              PUBLISH PUZZLE
            </p>

            {publishError && (
              <p className="text-xs text-red-400">{publishError}</p>
            )}

            {/* Title + creator name inputs */}
            {publishStage !== "error" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs tracking-widest" style={{ color: "var(--green-dark)" }}>
                    PUZZLE TITLE (optional)
                  </label>
                  <input
                    type="text"
                    value={puzzleTitle}
                    onChange={(e) => setPuzzleTitle(e.target.value)}
                    placeholder="untitled"
                    maxLength={60}
                    disabled={publishStage === "submitting"}
                    className="w-full bg-transparent border rounded px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:opacity-30 disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--green)" }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs tracking-widest" style={{ color: "var(--green-dark)" }}>
                    YOUR NAME (optional)
                  </label>
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    placeholder="anonymous"
                    maxLength={40}
                    disabled={publishStage === "submitting"}
                    className="w-full bg-transparent border rounded px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:opacity-30 disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--green)" }}
                  />
                </div>
              </div>
            )}

            {/* Fallback URL on error */}
            {publishStage === "error" && fallbackUrl && (
              <div className="space-y-2">
                <div
                  className="text-xs break-all font-mono p-2 rounded border"
                  style={{ borderColor: "var(--green-dark)", color: "var(--green-dim)", background: "var(--bg)" }}
                >
                  {fallbackUrl}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyFallback}
                    className="flex-1 py-2 border text-xs tracking-widest uppercase font-mono transition-all rounded hover:bg-green-950"
                    style={{ borderColor: "var(--green)", color: "var(--green)" }}
                  >
                    {fallbackCopied ? "✓ COPIED" : "[ COPY LINK ]"}
                  </button>
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 border text-xs tracking-widest uppercase font-mono text-center transition-all rounded hover:bg-green-950"
                    style={{ borderColor: "var(--green-dim)", color: "var(--green-dim)" }}
                  >
                    [ OPEN ]
                  </a>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {publishStage !== "error" && (
                <button
                  onClick={handleSubmitPublish}
                  disabled={publishStage === "submitting"}
                  className={`
                    flex-1 py-2 border text-sm tracking-widest uppercase font-mono
                    transition-all rounded
                    ${publishStage === "submitting" ? "opacity-50 cursor-not-allowed animate-pulse" : "hover:bg-green-950 cursor-pointer"}
                  `}
                  style={{ borderColor: "var(--green)", color: "var(--green)" }}
                >
                  {publishStage === "submitting" ? "[ PUBLISHING… ]" : "[ CONFIRM PUBLISH ]"}
                </button>
              )}
              <button
                onClick={() => { setPublishStage("idle"); setPublishError(null); setFallbackUrl(null); }}
                className="px-4 py-2 border text-xs tracking-widest uppercase font-mono transition-all rounded hover:bg-green-950"
                style={{ borderColor: "var(--border)", color: "var(--green-muted)" }}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* How to use */}
      <details className="text-xs" style={{ color: "var(--green-muted)" }}>
        <summary className="cursor-pointer tracking-widest uppercase hover:opacity-100 opacity-60">
          ▸ How to use
        </summary>
        <div className="mt-3 space-y-2 pl-3 border-l" style={{ borderColor: "var(--border)" }}>
          <p>1. Enter 5 seed words. Each must be 8–16 letters (no spaces).</p>
          <p>2. Each word auto-splits into 4 tiles of 2–4 letters.</p>
          <p>3. Use the ◀ ▶ arrows to shift split boundaries between adjacent tiles.</p>
          <p>4. Hit VALIDATE to check for duplicate tile paths.</p>
          <p>5. Generate a link and share it — players load the puzzle directly from the URL.</p>
          <p className="pt-2">
            💡 Scoring: 1 tile = 1pt · 2 tiles = 2pt · 3 tiles = 4pt · 4 tiles (quartile) = 8pt
          </p>
        </div>
      </details>

      {/* Footer spacer */}
      <div className="h-8" />
    </div>
  );
}
