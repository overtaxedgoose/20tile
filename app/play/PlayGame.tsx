"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  decodePuzzle,
  loadWordSet,
  evaluateSelection,
  getFoundQuartiles,
  computePuzzleStats,
  generateShareCard,
  shuffleArray,
  type Puzzle,
  type Tile,
  type ValidatedWord,
} from "@/lib/word-engine";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUARTILE_COLORS = [
  { border: "border-green-500",  bg: "bg-green-950",  text: "text-green-300",  dot: "bg-green-500",  label: "SQ1" },
  { border: "border-blue-500",   bg: "bg-blue-950",   text: "text-blue-300",   dot: "bg-blue-500",   label: "SQ2" },
  { border: "border-yellow-500", bg: "bg-yellow-950", text: "text-yellow-300", dot: "bg-yellow-500", label: "SQ3" },
  { border: "border-orange-500", bg: "bg-orange-950", text: "text-orange-300", dot: "bg-orange-500", label: "SQ4" },
  { border: "border-red-500",    bg: "bg-red-950",    text: "text-red-300",    dot: "bg-red-500",    label: "SQ5" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "quartile" | "info";
}

// ─── TileCell ─────────────────────────────────────────────────────────────────
// Used both in the free grid and in locked quartile rows.
// Locked tiles are always interactive (issue #4).

function TileCell({
  tile,
  isSelected,
  quartileIndex,
  shake,
  onClick,
}: {
  tile: Tile;
  isSelected: boolean;
  quartileIndex: number | null;
  shake: boolean;
  onClick: () => void;
}) {
  const isLocked = quartileIndex !== null;
  const qColor = isLocked ? QUARTILE_COLORS[quartileIndex] : null;

  // Determine styles — locked+selected gets a special combined look
  let borderCls: string;
  let bgCls: string;
  let textCls: string;
  let shadowCls = "";
  let scaleCls = "";

  if (isLocked && isSelected && qColor) {
    // Selected on top of a locked tile — brighten the quartile colour.
    // No scale transform: static transforms on grid children can cause
    // mobile browsers to incorrectly expand the grid's layout height.
    borderCls = "border-white";
    bgCls = qColor.bg;
    textCls = "text-white";
    shadowCls = "shadow-[0_0_16px_rgba(255,255,255,0.5)]";
    scaleCls = "";
  } else if (isLocked && qColor) {
    borderCls = qColor.border;
    bgCls = qColor.bg;
    textCls = qColor.text;
    shadowCls = "hover:shadow-[0_0_8px_rgba(255,255,255,0.15)]";
    scaleCls = "hover:scale-105";
  } else if (isSelected) {
    // Use a bright glow + border instead of scale to indicate selection.
    // scale-105 as a persistent (non-hover) class causes some mobile browsers
    // to recalculate grid row heights, expanding the tile grid on each tap.
    borderCls = "border-green-300";
    bgCls = "bg-green-900";
    textCls = "text-green-100";
    shadowCls = "shadow-[0_0_16px_rgba(0,255,65,0.6)]";
    scaleCls = "";
  } else {
    borderCls = "border-green-800";
    bgCls = "bg-black";
    textCls = "text-green-400";
    shadowCls = "hover:shadow-[0_0_8px_rgba(0,255,65,0.2)]";
    scaleCls = "hover:scale-105";
  }

  // w-full h-full: tile fills the grid cell whose dimensions are set by the
  // grid container (not by this element). Do NOT use aspect-square here —
  // that would let tile content drive the grid row height.
  const sizeClass = "w-full h-full text-sm sm:text-base";

  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Tile ${tile.letters}`}
      className={`
        relative flex items-center justify-center
        border-2 rounded-lg
        font-mono font-bold tracking-wide lowercase
        transition-all duration-150 select-none active:scale-95
        ${borderCls} ${bgCls} ${textCls} ${shadowCls} ${scaleCls} ${sizeClass}
        ${shake ? "animate-shake" : ""}
      `}
    >
      {tile.letters}
      {isLocked && (
        <span className={`absolute top-0.5 right-0.5 text-[8px] leading-none ${qColor?.text}`}>★</span>
      )}
    </button>
  );
}

// ─── StagingRow ───────────────────────────────────────────────────────────────
// Replaces SelectionBar. Four fixed slots at the top of the board.
// Tapping a staged tile returns it to the board (deselects it).

function StagingRow({
  selectedTiles,
  onDeselect,
  onClear,
  onSubmit,
  onShuffle,
  canSubmit,
  shaking,
}: {
  selectedTiles: Tile[];
  onDeselect: (id: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  onShuffle: () => void;
  canSubmit: boolean;
  shaking: boolean;
}) {
  return (
    <div className="space-y-2">
      {/*
        Staging slots — padding-top hack enforces height = 25% of width
        (≈ one square cell wide). paddingTop % is always relative to element
        WIDTH in CSS, so this height can never be overridden by content.
      */}
      <div style={{ position: "relative", paddingTop: "18%", flexShrink: 0 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
          }}
        >
          {[0, 1, 2, 3].map((i) => {
            const tile = selectedTiles[i];
            if (tile) {
              return (
                <button
                  key={tile.id}
                  onClick={() => onDeselect(tile.id)}
                  aria-label={`Remove ${tile.letters} from selection`}
                  className={`
                    relative flex items-center justify-center
                    border-2 border-green-300 bg-green-900 text-green-100
                    rounded-lg font-mono font-bold tracking-wide lowercase
                    text-sm w-full h-full
                    transition-colors duration-150 select-none
                    hover:bg-green-800 active:opacity-80
                    shadow-[0_0_12px_rgba(0,255,65,0.35)]
                    ${shaking ? "animate-shake" : ""}
                  `}
                >
                  {tile.letters}
                  <span className="absolute top-0.5 right-0.5 text-[8px] opacity-50">✕</span>
                </button>
              );
            }
            return (
              <div
                key={i}
                className="w-full h-full rounded-lg border-2 border-dashed flex items-center justify-center"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-xs opacity-20" style={{ color: "var(--green)" }}>·</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex gap-2">
        <button
          onClick={onShuffle}
          className="
            flex-none px-3 py-2 border text-xs font-mono tracking-widest uppercase rounded
            transition-all hover:bg-green-950
          "
          style={{ borderColor: "var(--border)", color: "var(--green-muted)" }}
          aria-label="Shuffle tiles"
        >
          ⟳ SHUFFLE
        </button>
        <button
          onClick={onClear}
          disabled={selectedTiles.length === 0}
          className="
            flex-none px-3 py-2 border text-xs font-mono tracking-widest uppercase rounded
            transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-green-950
          "
          style={{ borderColor: "var(--border)", color: "var(--green-muted)" }}
        >
          CLEAR
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`
            flex-1 py-2 px-3 border text-sm font-mono tracking-widest uppercase rounded
            font-bold transition-all
            ${canSubmit ? "hover:bg-green-900 cursor-pointer" : "opacity-30 cursor-not-allowed"}
            ${shaking ? "animate-shake" : ""}
          `}
          style={{ borderColor: "var(--green)", color: "var(--green)" }}
        >
          [ SUBMIT{selectedTiles.length > 0 ? ` (${selectedTiles.length})` : "" } ]
        </button>
      </div>
    </div>
  );
}

// ─── ScoreHeader ──────────────────────────────────────────────────────────────

function ScoreHeader({
  score,
  discoveredCount,
  foundQuartiles,
  maxScore,
  totalWords,
}: {
  score: number;
  discoveredCount: number;
  foundQuartiles: Set<number>;
  maxScore?: number;
  totalWords?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      {/* Score + word count */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold font-mono tabular-nums text-glow" style={{ color: "var(--green)" }}>
          {score}
          {maxScore != null && (
            <span className="text-sm font-normal" style={{ color: "var(--green-dark)" }}>
              /{maxScore}
            </span>
          )}
          <span className="text-sm font-normal ml-1" style={{ color: "var(--green-muted)" }}>pts</span>
        </span>
        <span className="text-xs font-mono" style={{ color: "var(--green-muted)" }}>
          {discoveredCount}{totalWords != null ? `/${totalWords}` : ""} word{(totalWords ?? discoveredCount) !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Quartile progress dots */}
      <div className="flex gap-1.5 items-center">
        {QUARTILE_COLORS.map((c, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border transition-all duration-300 ${
              foundQuartiles.has(i)
                ? `${c.dot} border-transparent scale-125`
                : "border-green-800 bg-transparent"
            }`}
            title={`${c.label} ${foundQuartiles.has(i) ? "✓" : "○"}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────

function ToastList({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const styles: Record<Toast["type"], string> = {
          success:  "border-green-500 bg-green-950 text-green-300",
          error:    "border-red-700 bg-red-950 text-red-300",
          quartile: "border-yellow-500 bg-yellow-950 text-yellow-200",
          info:     "border-green-800 bg-black text-green-500",
        };
        return (
          <div
            key={t.id}
            className={`px-4 py-2 border rounded font-mono text-sm tracking-widest uppercase shadow-lg ${styles[t.type]}`}
            style={{ animation: "fadeSlideDown 0.25s ease-out" }}
          >
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

// ─── Discovered Words Panel ───────────────────────────────────────────────────

function DiscoveredWordsPanel({ words, invalidGuesses }: { words: ValidatedWord[]; invalidGuesses: string[] }) {
  const sorted = [...words].sort((a, b) => a.word.localeCompare(b.word));
  return (
    <div className="space-y-3">
      <div className="border rounded-lg p-3 space-y-2" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
        <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>
          DISCOVERED WORDS ({words.length})
        </p>
        {sorted.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--green-dark)" }}>No words found yet. Start tapping!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sorted.map((w, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className={`text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  w.isQuartile ? "border-yellow-600 bg-yellow-950 text-yellow-300" : "border-green-800 bg-black text-green-400"
                }`}>
                  {w.word}
                </span>
                <span className="text-xs tabular-nums" style={{ color: "var(--green-muted)" }}>{w.points}p</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {invalidGuesses.length > 0 && (
        <details>
          <summary className="text-xs cursor-pointer tracking-widest select-none" style={{ color: "var(--green-dark)" }}>
            ▸ {invalidGuesses.length} invalid guess{invalidGuesses.length !== 1 ? "es" : ""}
          </summary>
          <div className="mt-2 flex flex-wrap gap-1 pl-2">
            {[...new Set(invalidGuesses)].map((g, i) => (
              <span key={i} className="text-xs font-mono uppercase px-1.5 py-0.5 rounded"
                style={{ color: "var(--green-dark)", border: "1px solid var(--green-dark)" }}>
                {g}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Completion Modal ─────────────────────────────────────────────────────────

const DIFFICULTY_OPTIONS = [
  { value: 1, label: "EASY" },
  { value: 2, label: "MEDIUM" },
  { value: 3, label: "HARD" },
] as const;

const CLEVERNESS_OPTIONS = [
  { value: 1, label: "MEH" },
  { value: 2, label: "CLEVER" },
  { value: 3, label: "GENIUS" },
] as const;

function CompletionModal({
  score, words, puzzle, shareCard, allWordsFound, puzzleId, puzzleNumber, onDismiss,
}: {
  score: number;
  words: ValidatedWord[];
  puzzle: Puzzle;
  shareCard: string;
  allWordsFound: boolean;
  puzzleId?: string;
  puzzleNumber?: number;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // Rating state
  const ratingKey = puzzleNumber != null ? `rated_${puzzleNumber}` : null;
  const [alreadyRated] = useState<boolean>(() => {
    if (!ratingKey) return false;
    try { return localStorage.getItem(ratingKey) === "1"; } catch { return false; }
  });
  const [ratingDifficulty, setRatingDifficulty] = useState<number | null>(null);
  const [ratingCleverness, setRatingCleverness] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(alreadyRated);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const canSubmitRating = ratingDifficulty !== null && ratingCleverness !== null && !ratingSubmitted && !ratingSubmitting;

  const handleSubmitRating = async () => {
    if (!puzzleId || !canSubmitRating) return;
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId, difficulty: ratingDifficulty, cleverness: ratingCleverness }),
      });
      if (!res.ok) throw new Error("server error");
      setRatingSubmitted(true);
      if (ratingKey) { try { localStorage.setItem(ratingKey, "1"); } catch { /* ignore */ } }
    } catch {
      setRatingError("Couldn't save rating. Try again?");
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareCard); }
    catch {
      const el = document.createElement("textarea");
      el.value = shareCard; document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quartileWords = words.filter((w) => w.isQuartile);
  const otherWords = words.filter((w) => !w.isQuartile);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm border rounded-xl p-6 space-y-5 overflow-y-auto max-h-[90vh]"
        style={{ borderColor: "var(--green-dim)", background: "var(--bg-panel)" }}>

        <div className="text-center space-y-1">
          <p className="text-3xl">{allWordsFound ? "🏆" : "🎯"}</p>
          <h2 className="text-xl font-bold tracking-widest text-glow font-mono" style={{ color: "var(--green)" }}>
            {allWordsFound ? "PUZZLE COMPLETE" : quartileWords.length === 5 ? "PUZZLE COMPLETE" : "GAME OVER"}
          </h2>
          <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>
            {quartileWords.length}/5 quartiles · {words.length} words found
          </p>
        </div>

        <div className="text-center border rounded py-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-4xl font-bold font-mono tabular-nums text-glow" style={{ color: "var(--green)" }}>{score}</p>
          <p className="text-xs tracking-widest mt-1" style={{ color: "var(--green-muted)" }}>TOTAL POINTS</p>
        </div>

        {quartileWords.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>QUARTILES</p>
            {quartileWords.map((w, i) => (
              <div key={i} className="flex justify-between text-xs font-mono">
                <span className="text-yellow-300 uppercase tracking-wider">{w.word}</span>
                <span style={{ color: "var(--green-muted)" }}>8 pts</span>
              </div>
            ))}
          </div>
        )}

        {otherWords.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>
              OTHER WORDS ({otherWords.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {[...otherWords].sort((a, b) => b.points - a.points).slice(0, 12).map((w, i) => (
                <span key={i} className="text-xs font-mono uppercase px-1.5 py-0.5 rounded border border-green-800 text-green-400">
                  {w.word} <span className="opacity-50">{w.points}p</span>
                </span>
              ))}
              {otherWords.length > 12 && (
                <span className="text-xs" style={{ color: "var(--green-dark)" }}>+{otherWords.length - 12} more</span>
              )}
            </div>
          </div>
        )}

        {/* Rating section — only shown when puzzle has a DB ID */}
        {puzzleId && (
          <div className="border rounded-lg p-3 space-y-3" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>
              {ratingSubmitted ? "YOUR RATING" : "RATE THIS PUZZLE"}
            </p>

            {/* Difficulty row */}
            <div className="space-y-1.5">
              <p className="text-[10px] tracking-widest font-mono" style={{ color: "var(--green-dark)" }}>DIFFICULTY</p>
              <div className="flex gap-2">
                {DIFFICULTY_OPTIONS.map(({ value, label }) => {
                  const isSelected = ratingDifficulty === value;
                  const isDisabled = ratingSubmitted;
                  return (
                    <button
                      key={value}
                      onClick={() => !isDisabled && setRatingDifficulty(value)}
                      disabled={isDisabled}
                      className="flex-1 py-1.5 border text-[10px] font-mono tracking-widest uppercase rounded transition-all"
                      style={{
                        borderColor: isSelected ? "var(--green)" : "var(--border)",
                        color: isSelected ? "var(--green)" : isDisabled ? "var(--green-dark)" : "var(--green-muted)",
                        background: isSelected ? "rgba(0,255,65,0.08)" : "transparent",
                        cursor: isDisabled ? "default" : "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cleverness row */}
            <div className="space-y-1.5">
              <p className="text-[10px] tracking-widest font-mono" style={{ color: "var(--green-dark)" }}>CLEVERNESS</p>
              <div className="flex gap-2">
                {CLEVERNESS_OPTIONS.map(({ value, label }) => {
                  const isSelected = ratingCleverness === value;
                  const isDisabled = ratingSubmitted;
                  return (
                    <button
                      key={value}
                      onClick={() => !isDisabled && setRatingCleverness(value)}
                      disabled={isDisabled}
                      className="flex-1 py-1.5 border text-[10px] font-mono tracking-widest uppercase rounded transition-all"
                      style={{
                        borderColor: isSelected ? "#facc15" : "var(--border)",
                        color: isSelected ? "#facc15" : isDisabled ? "var(--green-dark)" : "var(--green-muted)",
                        background: isSelected ? "rgba(250,204,21,0.08)" : "transparent",
                        cursor: isDisabled ? "default" : "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit / confirmation */}
            {ratingSubmitted ? (
              <p className="text-center text-xs font-mono tracking-widest" style={{ color: "var(--green-dark)" }}>
                ✓ THANKS FOR RATING
              </p>
            ) : (
              <>
                <button
                  onClick={handleSubmitRating}
                  disabled={!canSubmitRating}
                  className="w-full py-2 border text-xs font-mono tracking-widest uppercase rounded transition-all"
                  style={{
                    borderColor: canSubmitRating ? "var(--green)" : "var(--border)",
                    color: canSubmitRating ? "var(--green)" : "var(--green-dark)",
                    cursor: canSubmitRating ? "pointer" : "default",
                    opacity: ratingSubmitting ? 0.6 : 1,
                  }}
                >
                  {ratingSubmitting ? "SUBMITTING…" : "[ SUBMIT RATING ]"}
                </button>
                {ratingError && (
                  <p className="text-center text-[10px] font-mono" style={{ color: "#f87171" }}>{ratingError}</p>
                )}
              </>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>SHARE CARD</p>
          <pre className="text-xs font-mono whitespace-pre p-3 rounded border leading-relaxed"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--green-dim)" }}>
            {shareCard}
          </pre>
          <button onClick={handleCopy}
            className="w-full py-2 border text-xs font-mono tracking-widest uppercase rounded transition-all hover:bg-green-950"
            style={{ borderColor: "var(--green)", color: "var(--green)" }}>
            {copied ? "✓ COPIED TO CLIPBOARD" : "[ COPY SHARE CARD ]"}
          </button>
        </div>

        <div className="space-y-2">
          {/* Always offer a route home */}
          <Link
            href="/"
            className="block w-full py-2 border text-xs font-mono tracking-widest uppercase rounded transition-all text-center hover:bg-green-950"
            style={{ borderColor: "var(--green)", color: "var(--green)" }}
          >
            ← BACK TO HOME
          </Link>

          {/* Only show "keep playing" when the player finished early */}
          {!allWordsFound && (
            <button
              onClick={onDismiss}
              className="w-full py-2 border text-xs font-mono tracking-widest uppercase rounded transition-all hover:bg-green-950"
              style={{ borderColor: "var(--border)", color: "var(--green-muted)" }}
            >
              KEEP PLAYING
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Game Component ──────────────────────────────────────────────────────

export default function PlayGame({
  encodedPuzzle,
  puzzleId,
  puzzleNumber,
}: {
  encodedPuzzle: string | null;
  puzzleId?: string;
  puzzleNumber?: number;
}) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  // tileOrder holds all 20 tiles in their current display slots.
  // Invariant: locked (quartile) tiles always occupy the leading slots
  // [0..lockCount-1]; free tiles fill [lockCount..19].
  // When a quartile is found its tiles are moved to the next top row.
  // Shuffle only reorders the free tail — the locked prefix is untouched.
  const [tileOrder, setTileOrder] = useState<Tile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [discoveredWords, setDiscoveredWords] = useState<ValidatedWord[]>([]);
  const [invalidGuesses, setInvalidGuesses] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [wordSet, setWordSet] = useState<Set<string> | null>(null);
  const [puzzleStats, setPuzzleStats] = useState<{ totalWords: number; maxScore: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounterRef = useRef(0);

  const addToast = useCallback((message: string, type: Toast["type"], duration = 1800) => {
    const id = ++toastCounterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  // ── Progress persistence ──────────────────────────────────────────────────
  // Key: puzzle number for DB puzzles, or first 40 chars of encoded string for URL puzzles.
  const progressKey = puzzleNumber != null
    ? `progress_${puzzleNumber}`
    : encodedPuzzle ? `progress_url_${encodedPuzzle.slice(0, 40)}` : null;

  const saveProgress = useCallback((
    words: ValidatedWord[],
    order: Tile[],
    guesses: string[]
  ) => {
    if (!progressKey) return;
    try {
      localStorage.setItem(progressKey, JSON.stringify({
        discoveredWords: words,
        tileOrder: order,
        invalidGuesses: guesses,
      }));
    } catch { /* storage full or unavailable */ }
  }, [progressKey]);

  const clearProgress = useCallback(() => {
    if (!progressKey) return;
    try { localStorage.removeItem(progressKey); } catch { /* ignore */ }
  }, [progressKey]);

  // Load puzzle + word list
  useEffect(() => {
    if (!encodedPuzzle) {
      setError("No puzzle found in URL. Ask the creator to share the link again.");
      setLoading(false);
      return;
    }
    const decoded = decodePuzzle(encodedPuzzle);
    if (!decoded) {
      setError("Invalid or corrupted puzzle link. Please check the URL.");
      setLoading(false);
      return;
    }
    setPuzzle(decoded);

    // Restore saved progress if available, otherwise shuffle fresh
    const savedKey = puzzleNumber != null
      ? `progress_${puzzleNumber}`
      : `progress_url_${encodedPuzzle.slice(0, 40)}`;
    let restored = false;
    try {
      const raw = localStorage.getItem(savedKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.discoveredWords?.length > 0) {
          setDiscoveredWords(saved.discoveredWords);
          setScore(saved.discoveredWords.reduce((sum: number, w: ValidatedWord) => sum + w.points, 0));
          setInvalidGuesses(saved.invalidGuesses ?? []);
          // Validate that saved tile order matches this puzzle before restoring
          const savedIds = new Set((saved.tileOrder as Tile[]).map((t) => t.id));
          const puzzleIds = new Set(decoded.tiles.map((t) => t.id));
          const orderValid = savedIds.size === puzzleIds.size &&
            [...savedIds].every((id) => puzzleIds.has(id));
          setTileOrder(orderValid ? saved.tileOrder : shuffleArray([...decoded.tiles]));
          restored = true;
        }
      }
    } catch { /* corrupted save — ignore */ }

    if (!restored) setTileOrder(shuffleArray([...decoded.tiles]));

    loadWordSet()
      .then((ws) => {
        setWordSet(ws);
        setTimeout(() => {
          const stats = computePuzzleStats(decoded, ws);
          setPuzzleStats(stats);
        }, 0);
      })
      .catch(() => setError("Failed to load word list. Please refresh."))
      .finally(() => setLoading(false));
  }, [encodedPuzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived: which seed groups have a found quartile
  const foundQuartiles = puzzle ? getFoundQuartiles(discoveredWords, puzzle) : new Set<number>();

  // Auto-finish: show completion modal as soon as every discoverable word is found
  useEffect(() => {
    if (
      puzzleStats &&
      discoveredWords.length > 0 &&
      discoveredWords.length >= puzzleStats.totalWords &&
      !showCompletion
    ) {
      clearProgress();
      setShowCompletion(true);
    }
  }, [discoveredWords.length, puzzleStats, showCompletion, clearProgress]);

  // Persist progress to localStorage after each change
  useEffect(() => {
    if (puzzle && discoveredWords.length > 0) {
      saveProgress(discoveredWords, tileOrder, invalidGuesses);
    }
  }, [discoveredWords, tileOrder, invalidGuesses, puzzle, saveProgress]);

  // Selected tiles in tap order
  const selectedTiles = selectedIds
    .map((id) => tileOrder.find((t) => t.id === id))
    .filter(Boolean) as Tile[];

  // Tap handler — all tiles always selectable
  const handleTileTap = useCallback((tile: Tile) => {
    setSelectedIds((prev) => {
      if (prev.includes(tile.id)) return prev.filter((id) => id !== tile.id);
      if (prev.length >= 4) return prev;
      return [...prev, tile.id];
    });
  }, []);

  // Submit guess
  const handleSubmit = useCallback(() => {
    if (!puzzle || !wordSet || selectedIds.length === 0) return;

    const result = evaluateSelection(selectedIds, puzzle, wordSet);

    if (!result.valid) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      const attempted = selectedTiles.map((t) => t.letters).join("");
      setInvalidGuesses((prev) => [attempted, ...prev]);
      addToast("✗  not a word", "error");
      setSelectedIds([]);
      return;
    }

    const alreadyFound = discoveredWords.some((dw) => dw.word === result.word);
    if (alreadyFound) {
      addToast(`already found "${result.word}"`, "info");
      setSelectedIds([]);
      return;
    }

    const newWord: ValidatedWord = {
      word: result.word,
      tileIds: selectedIds,
      points: result.points,
      isQuartile: result.isQuartile,
    };
    setDiscoveredWords((prev) => [...prev, newWord]);
    setScore((prev) => prev + result.points);
    setSelectedIds([]);

    if (result.isQuartile) {
      // Move this quartile's 4 tiles to the next available top row.
      // foundQuartiles still reflects the count BEFORE this word was added
      // (React batches state updates), so foundQuartiles.size is the number
      // of rows already locked — exactly where the new row should go.
      const quartiledSeedIdx = selectedTiles[0].seedIndex;
      setTileOrder((prev) => {
        const lockBoundary = foundQuartiles.size * 4;
        const seedTiles = puzzle.seedTiles[quartiledSeedIdx];
        const seedTileIds = new Set(seedTiles.map((t) => t.id));
        // Remove the 4 quartile tiles from wherever they currently sit
        const rest = prev.filter((t) => !seedTileIds.has(t.id));
        return [
          ...rest.slice(0, lockBoundary), // existing locked rows — untouched
          ...seedTiles,                    // new quartile in canonical seed order
          ...rest.slice(lockBoundary),     // remaining free tiles
        ];
      });
      addToast(`🟨 QUARTILE! "${result.word}" +${result.points}pts`, "quartile", 2500);
    } else {
      addToast(`✓ "${result.word}" +${result.points}pt${result.points !== 1 ? "s" : ""}`, "success");
    }
  }, [puzzle, wordSet, selectedIds, selectedTiles, discoveredWords, foundQuartiles, addToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && selectedIds.length > 0) handleSubmit();
      if (e.key === "Escape") setSelectedIds([]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSubmit, selectedIds.length]);

  // Shuffle — locked tiles are always at tileOrder[0..lockCount-1] (invariant
  // maintained by the quartile-pinning logic in handleSubmit). Only the tail
  // (free tiles) is reshuffled. The grid container size never changes.
  const handleShuffle = useCallback(() => {
    setTileOrder((prev) => {
      const lockCount = foundQuartiles.size * 4;
      return [
        ...prev.slice(0, lockCount),
        ...shuffleArray([...prev.slice(lockCount)]),
      ];
    });
  }, [foundQuartiles]);

  // Share card
  const puzzleUrl = puzzleNumber != null
    ? `20tile.app/play/${puzzleNumber}`
    : typeof window !== "undefined" ? window.location.href : "20tile.app";
  const shareCard = puzzle ? generateShareCard(discoveredWords, puzzle, score, puzzleUrl) : "";

  // ── Render guards ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm tracking-widest animate-pulse" style={{ color: "var(--green-muted)" }}>LOADING PUZZLE…</p>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 text-center">
        <p className="text-sm text-red-400 max-w-xs">{error || "Unknown error"}</p>
        <Link href="/create"
          className="text-xs px-4 py-2 border border-green-700 text-green-400 rounded font-mono tracking-widest hover:bg-green-950 transition-colors">
          CREATE A PUZZLE
        </Link>
      </div>
    );
  }

  return (
    <>
      {/*
        Toasts — position: fixed, outside all layout containers.
        They float over the game and never affect document flow.
      */}
      <ToastList toasts={toasts} />

      {/* Completion modal — fixed overlay, outside layout */}
      {showCompletion && (
        <CompletionModal
          score={score}
          words={discoveredWords}
          puzzle={puzzle}
          shareCard={shareCard}
          allWordsFound={puzzleStats != null && discoveredWords.length >= puzzleStats.totalWords}
          puzzleId={puzzleId}
          puzzleNumber={puzzleNumber}
          onDismiss={() => { clearProgress(); setShowCompletion(false); }}
        />
      )}

      {/*
        ── PAGE ROOT ────────────────────────────────────────────────────────────
        display: flex / flex-direction: column / height: 100dvh / overflow: hidden
        are all expressed as inline styles so they cannot be overridden by
        Tailwind purging or specificity issues. This is the only scroll context
        on the page — everything either fits inside it or scrolls within it.
      */}
      <div
        className="max-w-lg mx-auto"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          overflow: "hidden",
          padding: "12px",
          gap: "8px",
          boxSizing: "border-box",
        }}
      >
        {/*
          ── TOP SECTION ────────────────────────────────────────────────────────
          flex: 1 + minHeight: 0   fills all viewport height MINUS the fixed
                                   bottom strip; can shrink but never overflow
          overflow: hidden         HARD CEILING — no child can push this taller,
                                   regardless of game state or browser quirks

          The tile grid inside uses flex: 1 + minHeight: 0 to fill whatever
          vertical space remains after header / score / staging / buttons.
          No aspect-ratio or padding-top tricks needed — the height is simply
          whatever the screen gives after the bottom strip is reserved.
        */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Nav */}
          <header style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <Link
              href="/"
              className="text-xs tracking-widest opacity-40 hover:opacity-100 transition-opacity font-mono"
              style={{ color: "var(--green)" }}
            >
              ← 20TILE
            </Link>
          </header>

          {/* Score + quartile progress dots */}
          <ScoreHeader
            score={score}
            discoveredCount={discoveredWords.length}
            foundQuartiles={foundQuartiles}
            maxScore={puzzleStats?.maxScore}
            totalWords={puzzleStats?.totalWords}
          />

          {/* Staging row (4 slots) + Shuffle / Clear / Submit buttons */}
          <StagingRow
            selectedTiles={selectedTiles}
            onDeselect={(id) => setSelectedIds((prev) => prev.filter((x) => x !== id))}
            onClear={() => setSelectedIds([])}
            onSubmit={handleSubmit}
            onShuffle={handleShuffle}
            canSubmit={selectedIds.length >= 1 && !!wordSet}
            shaking={shaking}
          />

          {/*
            ── 4×5 TILE GRID ──────────────────────────────────────────────────
            flex: 1 + minHeight: 0  fills every pixel left over in the top
                                    section after header / score / staging.
            overflow: hidden        tiles never leak out of the grid.

            gridTemplateRows: repeat(5, 1fr)  divides the exact available
            height into 5 equal rows; with w-full h-full tiles the cells
            fill perfectly without influencing the container's size.

            On most modern phones this produces near-square tiles. On small
            screens (iPhone SE) tiles are slightly wider than tall but the
            layout is perfectly stable across all game states.
          */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gridTemplateRows: "repeat(5, 1fr)",
              gap: "8px",
              overflow: "hidden",
            }}
          >
            {tileOrder.map((tile) => (
              <TileCell
                key={tile.id}
                tile={tile}
                isSelected={selectedIds.includes(tile.id)}
                quartileIndex={foundQuartiles.has(tile.seedIndex) ? tile.seedIndex : null}
                shake={shaking && selectedIds.includes(tile.id)}
                onClick={() => handleTileTap(tile)}
              />
            ))}
          </div>
        </div>

        {/*
          ── BOTTOM SECTION ─────────────────────────────────────────────────────
          height: clamp(...)  FIXED height — never grows, never shrinks.
                              Because this is fixed, the top section always
                              gets a known, stable amount of vertical space.
          overflow-y: auto    scrolls within its fixed height if word list grows
          flexShrink: 0       won't be squeezed by the top section
        */}
        <div
          style={{
            flexShrink: 0,
            height: "clamp(120px, 22vh, 180px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <DiscoveredWordsPanel words={discoveredWords} invalidGuesses={invalidGuesses} />

          {/* Show once all 5 quartiles are found but game hasn't auto-finished */}
          {foundQuartiles.size === 5 && !showCompletion && (
            <button
              onClick={() => setShowCompletion(true)}
              className="w-full py-2 border text-xs font-mono tracking-widest uppercase rounded transition-colors hover:bg-yellow-950"
              style={{ borderColor: "#854d0e", color: "#fde68a", flexShrink: 0 }}
            >
              🏆 [ FINISH PUZZLE ]
            </button>
          )}

          <p
            className="text-center text-xs pb-2"
            style={{ color: "var(--green-dark)", marginTop: "auto" }}
          >
            Enter to submit · Escape to clear
          </p>
        </div>
      </div>
    </>
  );
}
