"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  autoSplitWord3,
  findAllValidJuniorWords,
  encodeJuniorPuzzle,
  loadKidsWordSet,
  juniorScoreForTileCount,
  JUNIOR_TILES_PER_SEED,
  JUNIOR_MIN_SEED_LENGTH,
  JUNIOR_MAX_SEED_LENGTH,
  type JuniorPuzzle,
  type Tile,
} from "@/lib/junior-word-engine";
import { createClient } from "@/lib/supabase/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEED_COUNT = 5;

const SEED_COLORS = [
  { bg: "bg-sky-100",    border: "border-sky-400",    text: "text-sky-700",    label: "W1" },
  { bg: "bg-violet-100", border: "border-violet-400", text: "text-violet-700", label: "W2" },
  { bg: "bg-amber-100",  border: "border-amber-400",  text: "text-amber-700",  label: "W3" },
  { bg: "bg-rose-100",   border: "border-rose-400",   text: "text-rose-700",   label: "W4" },
  { bg: "bg-emerald-100",border: "border-emerald-400",text: "text-emerald-700",label: "W5" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeedState {
  word: string;
  clean: string;
  tiles: string[];
  splitPositions: number[];
  error: string | null;
  inWordList: boolean | null;
}

interface ValidationState {
  checking: boolean;
  errors: string[];
  warnings: string[];
  duplicatePaths: string[];
  seedsMissing: string[];
  ok: boolean;
  wordGroups: { count: number; pts: number; words: DiscoveredWordEntry[] }[];
  totalWords: number;
  totalScore: number;
}

interface DiscoveredWordEntry {
  word: string;
  pts: number;
  is3Tile: boolean;
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
    newTiles.length === JUNIOR_TILES_PER_SEED &&
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
        border-2 ${borderClass} ${colorClass}
        py-2 px-1 rounded-lg text-center
        font-mono text-sm sm:text-base font-bold tracking-widest uppercase
        ${textClass}
        select-none shadow-sm
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
        w-6 h-6 flex items-center justify-center rounded text-xs leading-none
        transition-opacity border border-slate-300 bg-white
        ${disabled ? "opacity-20 cursor-not-allowed" : "opacity-70 hover:opacity-100 cursor-pointer hover:bg-slate-50"}
      `}
      style={{ color: "#64748b" }}
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
      <div className="flex items-center gap-3">
        <span className={`text-xs font-bold tracking-widest w-8 text-center ${color.text}`}>
          {color.label}
        </span>
        <input
          type="text"
          value={state.word}
          onChange={(e) => onWordChange(idx, e.target.value)}
          placeholder={`word ${idx + 1} — 6 to 10 letters`}
          maxLength={12}
          spellCheck={false}
          className={`
            flex-1 border-2 rounded-lg px-3 py-2
            font-mono text-sm tracking-wider uppercase
            outline-none transition-colors bg-white
            placeholder:opacity-40 placeholder:normal-case placeholder:tracking-normal placeholder:text-xs
            ${
              state.error
                ? "border-red-400 text-red-600"
                : state.clean.length >= JUNIOR_MIN_SEED_LENGTH
                ? `${color.border} ${color.text}`
                : "border-slate-300 text-slate-600"
            }
          `}
        />
        {state.clean.length > 0 && (
          <span
            className="text-xs w-6 text-right tabular-nums font-mono"
            style={{
              color:
                state.clean.length >= JUNIOR_MIN_SEED_LENGTH &&
                state.clean.length <= JUNIOR_MAX_SEED_LENGTH
                  ? "#16a34a"
                  : "#dc2626",
            }}
          >
            {state.clean.length}
          </span>
        )}
      </div>

      {/* Error */}
      {state.error && (
        <p className="text-xs text-red-500 pl-11">{state.error}</p>
      )}

      {/* Not-in-wordlist warning */}
      {!state.error &&
        state.clean.length >= JUNIOR_MIN_SEED_LENGTH &&
        state.inWordList === false && (
          <p className="text-xs pl-11 text-amber-600">
            ⚠ &quot;{state.clean}&quot; isn&apos;t in the kids word list — players may not be able to find it as a 3tile
          </p>
        )}

      {/* Tile strip */}
      {!state.error && state.tiles.length === JUNIOR_TILES_PER_SEED && (
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
                {ti < JUNIOR_TILES_PER_SEED - 1 && (
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
          <div className="mt-1 flex pl-0 text-xs text-slate-600">
            <span className="flex-1 text-center">{state.tiles[0]?.length}L</span>
            <span className="w-6" />
            <span className="flex-1 text-center">{state.tiles[1]?.length}L</span>
            <span className="w-6" />
            <span className="flex-1 text-center">{state.tiles[2]?.length}L</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ValidationPanel({ result }: { result: ValidationState | null }) {
  if (!result) return null;

  if (result.checking) {
    return (
      <div className="border-2 border-slate-200 rounded-xl p-4 text-sm animate-pulse bg-white">
        <span className="text-slate-700">Checking your puzzle…</span>
      </div>
    );
  }

  const allClear =
    result.ok && result.errors.length === 0 && result.duplicatePaths.length === 0;

  return (
    <div
      className="border-2 rounded-xl p-4 space-y-3 text-sm bg-white"
      style={{ borderColor: allClear ? "#16a34a" : "#fca5a5" }}
    >
      <p className="font-bold tracking-wide text-sm" style={{ color: allClear ? "#15803d" : "#dc2626" }}>
        {allClear ? "✅ Puzzle looks great!" : "⚠ A few things to fix"}
      </p>

      {/* Hard errors */}
      {result.errors.map((e, i) => (
        <p key={i} className="text-red-500 text-sm">✗ {e}</p>
      ))}

      {/* Seeds not in word list */}
      {result.seedsMissing.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
          <p className="text-amber-700 font-medium text-xs">
            These words aren&apos;t in the kids dictionary — players won&apos;t be able to complete them as 3tiles:
          </p>
          {result.seedsMissing.map((w, i) => (
            <p key={i} className="pl-3 text-amber-600 font-mono text-xs">{w}</p>
          ))}
        </div>
      )}

      {/* Duplicate paths */}
      {result.duplicatePaths.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
          <p className="text-orange-700 font-medium text-xs">
            {result.duplicatePaths.length} word{result.duplicatePaths.length !== 1 ? "s" : ""} can be spelled more than one way — try adjusting the tile splits:
          </p>
          {result.duplicatePaths.slice(0, 5).map((w, i) => (
            <p key={i} className="pl-3 text-orange-600 font-mono text-xs">{w}</p>
          ))}
          {result.duplicatePaths.length > 5 && (
            <p className="pl-3 text-orange-400 text-xs">…and {result.duplicatePaths.length - 5} more</p>
          )}
        </div>
      )}

      {result.warnings.map((w, i) => (
        <p key={i} className="text-slate-700 text-xs">ℹ {w}</p>
      ))}

      {allClear && (
        <p className="text-green-600 text-xs">All 5 3tiles are reachable. Ready to publish!</p>
      )}

      {/* Word discovery */}
      {result.wordGroups.length > 0 && (
        <div className="mt-3 pt-3 space-y-4 border-t border-slate-100">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-bold tracking-wide text-slate-700">DISCOVERABLE WORDS</p>
            <div className="flex items-baseline gap-4 text-xs font-mono tabular-nums">
              {result.duplicatePaths.length > 0 && (
                <span className="text-orange-500">
                  {result.duplicatePaths.length} dup{result.duplicatePaths.length !== 1 ? "s" : ""}
                </span>
              )}
              <span className="text-slate-700">{result.totalWords} words</span>
              <span className="text-emerald-600 font-bold">{result.totalScore} pts max</span>
            </div>
          </div>

          {result.totalWords === 0 && (
            <p className="text-xs text-slate-600">No valid words found with current tile splits.</p>
          )}

          {result.wordGroups.map(({ count, pts, words }) => {
            if (words.length === 0) return null;
            const labels: Record<number, string> = { 1: "1-TILE WORDS", 2: "2-TILE WORDS", 3: "3-TILE WORDS" };
            return (
              <div key={count} className="space-y-1.5">
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-bold tracking-wide text-slate-700">{labels[count]}</span>
                  <span className="text-xs tabular-nums text-slate-600">{pts}pt · {words.length} found</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {words.map(({ word, is3Tile, isDuplicate }) => {
                    const chipCls = isDuplicate
                      ? "border-orange-400 bg-orange-50 text-orange-600"
                      : is3Tile
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-600";
                    const tipText = isDuplicate
                      ? "Can be spelled via multiple tile paths"
                      : is3Tile
                      ? "3tile — uses all 3 tiles from one seed word"
                      : "";
                    return (
                      <span
                        key={word}
                        title={tipText}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 border-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider ${chipCls}`}
                      >
                        {is3Tile && !isDuplicate && <span className="opacity-70">★</span>}
                        {isDuplicate && <span className="opacity-70">⚠</span>}
                        {word}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-4 pt-1 text-xs border-t border-slate-100 text-slate-600">
            <span className="text-amber-600">★ 3tile (3pts)</span>
            <span className="text-orange-500">⚠ duplicate path</span>
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
  if (clean.length < JUNIOR_MIN_SEED_LENGTH) {
    return {
      word, clean, tiles: [], splitPositions: [],
      error: `Too short — try a word with ${JUNIOR_MIN_SEED_LENGTH}–${JUNIOR_MAX_SEED_LENGTH} letters`,
      inWordList: null,
    };
  }
  if (clean.length > JUNIOR_MAX_SEED_LENGTH) {
    return {
      word, clean, tiles: [], splitPositions: [],
      error: `Too long — try a word with ${JUNIOR_MIN_SEED_LENGTH}–${JUNIOR_MAX_SEED_LENGTH} letters`,
      inWordList: null,
    };
  }
  const tiles = autoSplitWord3(clean);
  if (!tiles) {
    return {
      word, clean, tiles: [], splitPositions: [],
      error: "This word can't be split into 3 tiles — try a different word",
      inWordList: null,
    };
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

export default function JuniorCreatePage() {
  const [seeds, setSeeds] = useState<SeedState[]>(
    Array.from({ length: SEED_COUNT }, () => makeSeedState(""))
  );
  const [wordSet, setWordSet] = useState<Set<string> | null>(null);
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [validating, setValidating] = useState(false);

  const [publishStage, setPublishStage] = useState<PublishStage>("idle");
  const [puzzleTitle, setPuzzleTitle] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedNumber, setPublishedNumber] = useState<number | null>(null);
  const [publishedLinkCopied, setPublishedLinkCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [fallbackCopied, setFallbackCopied] = useState(false);

  useEffect(() => {
    loadKidsWordSet().then(setWordSet).catch(console.error);
  }, []);

  useEffect(() => {
    if (!wordSet) return;
    setSeeds((prev) =>
      prev.map((s) => ({
        ...s,
        inWordList: s.clean.length >= JUNIOR_MIN_SEED_LENGTH ? wordSet.has(s.clean) : null,
      }))
    );
  }, [wordSet, seeds.map((s) => s.clean).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleShift = useCallback((seedIdx: number, boundaryIdx: number, direction: 1 | -1) => {
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
  }, []);

  const allSeedsReady = seeds.every(
    (s) => s.clean.length >= JUNIOR_MIN_SEED_LENGTH && s.error === null && s.tiles.length === JUNIOR_TILES_PER_SEED
  );

  const handleValidate = useCallback(async () => {
    if (!allSeedsReady) return;
    setValidating(true);
    setValidation({
      checking: true,
      errors: [], warnings: [], duplicatePaths: [], seedsMissing: [],
      ok: false, wordGroups: [], totalWords: 0, totalScore: 0,
    });

    await new Promise((r) => setTimeout(r, 50));

    const errors: string[] = [];
    const warnings: string[] = [];
    const seedsMissing: string[] = [];

    const seedTiles: Tile[][] = seeds.map((s, si) =>
      s.tiles.map((letters, ti) => ({
        id: `s${si}-t${ti}`,
        letters,
        seedIndex: si,
        tileIndex: ti,
      }))
    );
    const puzzle: JuniorPuzzle = {
      tiles: seedTiles.flat(),
      seedWords: seeds.map((s) => s.clean),
      seedTiles,
    };

    for (const tile of puzzle.tiles) {
      if (tile.letters.length < 2 || tile.letters.length > 4) {
        errors.push(`Tile "${tile.letters}" has ${tile.letters.length} letters — each tile must be 2–4 letters.`);
      }
    }

    if (wordSet) {
      for (const s of seeds) {
        if (!wordSet.has(s.clean)) {
          seedsMissing.push(s.clean);
        }
      }
    }

    let duplicatePaths: string[] = [];
    let wordGroups: ValidationState["wordGroups"] = [];
    let totalWords = 0;
    let totalScore = 0;

    if (wordSet && errors.length === 0) {
      try {
        const allWords = findAllValidJuniorWords(puzzle, wordSet);

        const byCount = new Map<number, DiscoveredWordEntry[]>(
          [1, 2, 3].map((n) => [n, []])
        );
        const seedIdxOf = (id: string) => parseInt(id.split("-")[0].slice(1), 10);

        for (const [word, paths] of allWords.entries()) {
          const tileCount = paths[0].length;
          const pts = juniorScoreForTileCount(tileCount);
          const isDuplicate = paths.length > 1;

          let is3Tile = false;
          if (tileCount === 3) {
            is3Tile = paths.some((path) => {
              const first = seedIdxOf(path[0]);
              return (
                path.every((id) => seedIdxOf(id) === first) &&
                puzzle.seedTiles[first]?.every((st) => path.includes(st.id))
              );
            });
          }

          if (isDuplicate) duplicatePaths.push(word);
          totalScore += pts;
          byCount.get(tileCount)!.push({ word, pts, is3Tile, isDuplicate });
        }

        for (const arr of byCount.values()) arr.sort((a, b) => a.word.localeCompare(b.word));

        // Extra 3tile check: exactly 5 three-tile seed words, no extras
        const seedWordSet = new Set(seeds.map((s) => s.clean));
        const extra3Tiles = byCount.get(3)!.filter((w) => w.is3Tile && !seedWordSet.has(w.word));
        if (extra3Tiles.length > 0) {
          const listed = extra3Tiles.map((w) => w.word).join(", ");
          errors.push(
            `The tiles can accidentally spell ${extra3Tiles.length} extra word${extra3Tiles.length !== 1 ? "s" : ""} using all 3 tiles from one group: "${listed}". Adjust your tile splits to fix this.`
          );
        }

        totalWords = allWords.size;
        wordGroups = [1, 2, 3].map((count) => ({
          count,
          pts: juniorScoreForTileCount(count),
          words: byCount.get(count)!,
        }));
      } catch {
        warnings.push("Word scan ran into a problem — the puzzle may be unusually complex.");
      }
    }

    setValidation({
      checking: false,
      errors,
      warnings,
      duplicatePaths,
      seedsMissing,
      ok: errors.length === 0,
      wordGroups,
      totalWords,
      totalScore,
    });
    setValidating(false);
  }, [allSeedsReady, seeds, wordSet]);

  const handleOpenPublishForm = useCallback(() => {
    if (!validation?.ok) return;
    setPublishStage("form");
    setPublishError(null);
    setFallbackUrl(null);
  }, [validation]);

  const handleSubmitPublish = useCallback(async () => {
    if (!allSeedsReady) return;
    setPublishStage("submitting");
    setPublishError(null);

    const rawTiles = seeds.map((s) => s.tiles.join("|")).join(",");

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("junior_puzzles")
        .insert({
          tiles: rawTiles,
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
      const seedTiles: Tile[][] = seeds.map((s, si) =>
        s.tiles.map((letters, ti) => ({
          id: `s${si}-t${ti}`,
          letters,
          seedIndex: si,
          tileIndex: ti,
        }))
      );
      const puzzle: JuniorPuzzle = {
        tiles: seedTiles.flat(),
        seedWords: seeds.map((s) => s.clean),
        seedTiles,
      };
      const encoded = encodeJuniorPuzzle(puzzle);
      const url = `${window.location.origin}/junior/play?p=${encoded}`;
      setFallbackUrl(url);
      setPublishError("Couldn't reach the database — here's a shareable link instead:");
      setPublishStage("error");
    }
  }, [allSeedsReady, seeds, creatorName, puzzleTitle]);

  const handleCopyFallback = useCallback(async () => {
    if (!fallbackUrl) return;
    try { await navigator.clipboard.writeText(fallbackUrl); }
    catch {
      const el = document.createElement("textarea");
      el.value = fallbackUrl; document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    setFallbackCopied(true);
    setTimeout(() => setFallbackCopied(false), 2000);
  }, [fallbackUrl]);

  return (
    <div
      className="min-h-screen px-4 py-8 max-w-2xl mx-auto space-y-8"
      style={{ background: "#f0f9ff" }}
    >
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <Link
            href="/junior"
            className="text-xs tracking-widest opacity-60 hover:opacity-100 transition-opacity font-mono text-slate-700"
          >
            ← BACK
          </Link>
          <span className="text-xs tracking-widest text-slate-600 font-mono">JUNIOR PUZZLE CREATOR</span>
        </div>
        <h1 className="text-3xl font-bold tracking-widest" style={{ color: "#0369a1" }}>
          20TILE JR
        </h1>
        <p className="text-sm text-slate-700">
          Pick 5 words with 6–10 letters each. Each word gets split into 3 tiles.
        </p>
      </header>

      <div className="border-t border-slate-200" />

      {!wordSet && (
        <p className="text-sm animate-pulse text-slate-600">Loading word list…</p>
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

      <div className="border-t border-slate-200" />

      {/* All tiles preview */}
      {allSeedsReady && (
        <div className="space-y-2">
          <p className="text-xs tracking-widest text-slate-600 font-mono">ALL 15 TILES</p>
          <div className="flex flex-wrap gap-2">
            {seeds.flatMap((s, si) =>
              s.tiles.map((tile, ti) => {
                const color = SEED_COLORS[si];
                return (
                  <span
                    key={`${si}-${ti}`}
                    className={`inline-flex items-center px-2 py-1 text-xs font-mono font-bold uppercase tracking-widest border-2 rounded-lg ${color.border} ${color.text} ${color.bg}`}
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
        <button
          onClick={handleValidate}
          disabled={!allSeedsReady || validating}
          className={`
            w-full py-3 px-6 border-2 text-sm tracking-widest uppercase font-mono
            transition-all rounded-xl font-bold
            ${allSeedsReady && !validating
              ? "hover:bg-sky-50 cursor-pointer opacity-100 border-sky-400 text-sky-700 bg-white"
              : "opacity-30 cursor-not-allowed border-slate-300 text-slate-600 bg-white"
            }
          `}
        >
          {validating ? "Checking puzzle…" : "[ CHECK PUZZLE ]"}
        </button>

        <ValidationPanel result={validation} />

        {publishStage === "idle" && (
          <button
            onClick={handleOpenPublishForm}
            disabled={!validation?.ok}
            className={`
              w-full py-3 px-6 border-2 text-sm tracking-widest uppercase font-mono
              transition-all rounded-xl font-bold
              ${validation?.ok
                ? "hover:bg-sky-50 cursor-pointer opacity-100 border-sky-500 text-sky-700 bg-white"
                : "opacity-30 cursor-not-allowed border-slate-300 text-slate-600 bg-white"
              }
            `}
          >
            [ PUBLISH PUZZLE ]
          </button>
        )}

        {/* Published */}
        {publishStage === "published" && publishedNumber != null && (
          <div className="border-2 border-emerald-300 rounded-xl p-4 space-y-4 bg-white">
            <div className="text-center space-y-1">
              <p className="text-2xl">🎉</p>
              <p className="text-sm font-bold tracking-widest font-mono text-emerald-700">
                PUZZLE #{publishedNumber} PUBLISHED!
              </p>
            </div>
            <div className="text-xs break-all font-mono p-2 rounded-lg border border-slate-200 text-center text-slate-700 bg-slate-50">
              20tile.app/junior/play/{publishedNumber}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const url = `https://20tile.app/junior/play/${publishedNumber}`;
                  try { await navigator.clipboard.writeText(url); }
                  catch {
                    const el = document.createElement("textarea");
                    el.value = url; document.body.appendChild(el); el.select();
                    document.execCommand("copy"); document.body.removeChild(el);
                  }
                  setPublishedLinkCopied(true);
                  setTimeout(() => setPublishedLinkCopied(false), 2000);
                }}
                className="flex-1 py-2 border-2 border-sky-400 text-xs tracking-widest uppercase font-mono transition-all rounded-xl hover:bg-sky-50 text-sky-700"
              >
                {publishedLinkCopied ? "✓ COPIED" : "[ COPY LINK ]"}
              </button>
              <a
                href={`/junior/play/${publishedNumber}`}
                className="flex-1 py-2 border-2 border-slate-300 text-xs tracking-widest uppercase font-mono text-center transition-all rounded-xl hover:bg-slate-50 text-slate-700"
              >
                [ PLAY NOW ]
              </a>
            </div>
          </div>
        )}

        {/* Publish form */}
        {(publishStage === "form" || publishStage === "submitting" || publishStage === "error") && (
          <div className="border-2 border-slate-200 rounded-xl p-4 space-y-4 bg-white">
            <p className="text-xs tracking-widest text-slate-700 font-mono">PUBLISH PUZZLE</p>

            {publishError && <p className="text-xs text-red-500">{publishError}</p>}

            {publishStage !== "error" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs tracking-widest text-slate-600">PUZZLE TITLE (optional)</label>
                  <input
                    type="text"
                    value={puzzleTitle}
                    onChange={(e) => setPuzzleTitle(e.target.value)}
                    placeholder="untitled"
                    maxLength={60}
                    disabled={publishStage === "submitting"}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 font-mono text-sm outline-none bg-slate-50 placeholder:opacity-40 disabled:opacity-50 text-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs tracking-widest text-slate-600">YOUR NAME (optional)</label>
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    placeholder="anonymous"
                    maxLength={40}
                    disabled={publishStage === "submitting"}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 font-mono text-sm outline-none bg-slate-50 placeholder:opacity-40 disabled:opacity-50 text-slate-700"
                  />
                </div>
              </div>
            )}

            {publishStage === "error" && fallbackUrl && (
              <div className="space-y-2">
                <div className="text-xs break-all font-mono p-2 rounded-lg border border-slate-200 text-slate-700 bg-slate-50">
                  {fallbackUrl}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyFallback}
                    className="flex-1 py-2 border-2 border-sky-400 text-xs tracking-widest uppercase font-mono transition-all rounded-xl hover:bg-sky-50 text-sky-700"
                  >
                    {fallbackCopied ? "✓ COPIED" : "[ COPY LINK ]"}
                  </button>
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 border-2 border-slate-300 text-xs tracking-widest uppercase font-mono text-center transition-all rounded-xl hover:bg-slate-50 text-slate-700"
                  >
                    [ OPEN ]
                  </a>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {publishStage !== "error" && (
                <button
                  onClick={handleSubmitPublish}
                  disabled={publishStage === "submitting"}
                  className={`
                    flex-1 py-2 border-2 text-sm tracking-widest uppercase font-mono
                    transition-all rounded-xl font-bold
                    ${publishStage === "submitting"
                      ? "opacity-50 cursor-not-allowed border-slate-300 text-slate-600 animate-pulse"
                      : "hover:bg-sky-50 cursor-pointer border-sky-500 text-sky-700"
                    }
                  `}
                >
                  {publishStage === "submitting" ? "Publishing…" : "[ CONFIRM PUBLISH ]"}
                </button>
              )}
              <button
                onClick={() => { setPublishStage("idle"); setPublishError(null); setFallbackUrl(null); }}
                className="px-4 py-2 border-2 border-slate-200 text-xs tracking-widest uppercase font-mono transition-all rounded-xl hover:bg-slate-50 text-slate-700"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
