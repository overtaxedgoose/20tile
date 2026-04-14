"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  decodePuzzle,
  loadWordSet,
  evaluateSelection,
  getFoundQuartiles,
  computePuzzleStats,
  findAllValidWords,
  generateShareCard,
  formatElapsedTime,
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
  ref,
}: {
  tile: Tile;
  isSelected: boolean;
  quartileIndex: number | null;
  shake: boolean;
  onClick: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const isLocked = quartileIndex !== null;

  // Play a quick upward jump when the tile is freshly selected.
  // Uses translateY only — scale transforms break mobile grid row recalculation.
  const prevSelectedRef = useRef(false);
  const [playJump, setPlayJump] = useState(false);
  useEffect(() => {
    if (isSelected && !prevSelectedRef.current) {
      setPlayJump(true);
      const t = setTimeout(() => setPlayJump(false), 300);
      prevSelectedRef.current = true;
      return () => clearTimeout(t);
    }
    if (!isSelected) prevSelectedRef.current = false;
  }, [isSelected]);
  const qColor = isLocked ? QUARTILE_COLORS[quartileIndex] : null;

  // Determine styles — locked+selected gets a special combined look
  let borderCls: string;
  let bgCls: string;
  let textCls: string;
  let shadowCls = "";

  if (isLocked && isSelected && qColor) {
    // Found quartile tile that's also re-selected: bright outline + quartile fill
    borderCls = "border-white/80";
    bgCls = qColor.bg;
    textCls = "text-white";
    shadowCls = "shadow-[0_0_20px_rgba(255,255,255,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)]";
  } else if (isLocked && qColor) {
    // Found quartile tile at rest: subtle depth with a hint of quartile glow
    borderCls = qColor.border;
    bgCls = qColor.bg;
    textCls = qColor.text;
    shadowCls = "shadow-[0_3px_8px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_3px_12px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)]";
  } else if (isSelected) {
    // Actively selected (free) tile: confident green fill + outer glow
    borderCls = "border-green-400/80";
    bgCls = "bg-green-950";
    textCls = "text-green-100";
    shadowCls = "shadow-[0_0_18px_rgba(0,255,65,0.45),inset_0_1px_0_rgba(0,255,65,0.35)] active:shadow-[0_0_10px_rgba(0,255,65,0.3),inset_0_2px_6px_rgba(0,0,0,0.7)]";
  } else {
    // Default unselected: raised-tile look via drop shadow + inner top highlight
    borderCls = "border-green-900/80";
    bgCls = "bg-[#060d06]";
    textCls = "text-green-400";
    shadowCls = "shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(0,255,65,0.12)] hover:shadow-[0_3px_14px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(0,255,65,0.22),0_0_10px_rgba(0,255,65,0.1)] active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(0,255,65,0.05)]";
  }

  // w-full h-full: tile fills the grid cell whose dimensions are set by the
  // grid container (not by this element). No scale transforms — they cause
  // mobile browsers to incorrectly recalculate grid row heights.
  const sizeClass = "w-full h-full text-xl sm:text-2xl";

  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Tile ${tile.letters}`}
      style={{ zIndex: playJump ? 10 : undefined }}
      className={`
        relative flex items-center justify-center
        border rounded-2xl
        font-mono font-bold tracking-wide lowercase
        transition-all duration-150 select-none
        ${borderCls} ${bgCls} ${textCls} ${shadowCls} ${sizeClass}
        ${shake ? "animate-shake" : ""}
        ${playJump ? "animate-tile-jump" : ""}
      `}
    >
      {tile.letters}
      {isLocked && (
        <span className={`absolute top-1 right-1 text-[7px] leading-none opacity-70 ${qColor?.text}`}>★</span>
      )}
    </button>
  );
}

// ─── StagingChips ─────────────────────────────────────────────────────────────
// Slim chip row showing only the currently selected tiles.
// Tapping a chip deselects that tile.

function StagingChips({
  selectedTiles,
  onDeselect,
  shaking,
}: {
  selectedTiles: Tile[];
  onDeselect: (id: string) => void;
  shaking: boolean;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        height: "52px",
        display: "flex",
        alignItems: "center",
      }}
    >
      {selectedTiles.length === 0 ? (
        <div
          className="w-full flex items-center justify-center rounded-lg border-2 border-dashed"
          style={{ borderColor: "var(--border)", height: "44px" }}
        >
          <span className="text-xs font-mono tracking-widest opacity-25" style={{ color: "var(--green)" }}>
            SELECT UP TO 4 TILES
          </span>
        </div>
      ) : (
        <div className="flex gap-2 justify-center w-full">
          {selectedTiles.map((tile) => (
            <button
              key={tile.id}
              onClick={() => onDeselect(tile.id)}
              aria-label={`Remove ${tile.letters} from selection`}
              className={`
                flex items-center gap-1
                border-2 border-green-300 bg-green-900 text-green-100
                rounded-lg font-mono font-bold tracking-wide lowercase
                px-3 py-1.5 text-sm
                transition-colors duration-150 select-none
                hover:bg-green-800 active:opacity-80
                shadow-[0_0_12px_rgba(0,255,65,0.35)]
                animate-chip-pop
                ${shaking ? "animate-shake" : ""}
              `}
            >
              {tile.letters}
              <span className="text-[9px] opacity-50 leading-none">✕</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ActionBar ────────────────────────────────────────────────────────────────
// Two-row control strip below the tile grid:
//   Row 1: Submit (full width)
//   Row 2: Shuffle | Lock toggle | Clear

function ActionBar({
  onShuffle,
  onSubmit,
  onClear,
  onToggleLock,
  canSubmit,
  shaking,
  selectedCount,
  isLocked,
  hasDiscoveredQuartiles,
}: {
  onShuffle: () => void;
  onSubmit: () => void;
  onClear: () => void;
  onToggleLock: () => void;
  canSubmit: boolean;
  shaking: boolean;
  selectedCount: number;
  isLocked: boolean;
  hasDiscoveredQuartiles: boolean;
}) {
  return (
    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Row 1 — Submit */}
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`
          w-full border-2 text-sm font-mono font-bold tracking-widest uppercase rounded-lg
          transition-all
          ${canSubmit ? "hover:bg-green-900 cursor-pointer" : "opacity-30 cursor-not-allowed"}
          ${shaking ? "animate-shake" : ""}
        `}
        style={{ borderColor: "var(--green)", color: "var(--green)", height: "44px" }}
      >
        ✓ SUBMIT{selectedCount > 0 ? ` (${selectedCount})` : ""}
      </button>

      {/* Row 2 — Shuffle | Lock | Clear */}
      <div style={{ display: "flex", gap: "8px" }}>
        {/* Shuffle */}
        <button
          onClick={onShuffle}
          className="flex-1 flex items-center justify-center border rounded-lg transition-all hover:bg-green-950"
          style={{ borderColor: "var(--border)", color: "var(--green-muted)", height: "44px", fontSize: "18px" }}
          aria-label="Shuffle tiles"
        >
          ⟳
        </button>

        {/* Lock / Unlock toggle */}
        <button
          onClick={onToggleLock}
          disabled={!hasDiscoveredQuartiles}
          className="flex-1 flex items-center justify-center border rounded-lg transition-all disabled:opacity-25 disabled:cursor-not-allowed hover:bg-green-950"
          style={{
            borderColor: hasDiscoveredQuartiles && !isLocked ? "var(--green)" : "var(--border)",
            color: hasDiscoveredQuartiles && !isLocked ? "var(--green)" : "var(--green-muted)",
            height: "44px",
            fontSize: "18px",
          }}
          aria-label={isLocked ? "Unlock discovered quartiles" : "Lock discovered quartiles"}
        >
          {isLocked ? "🔒" : "🔓"}
        </button>

        {/* Clear */}
        <button
          onClick={onClear}
          disabled={selectedCount === 0}
          className="flex-1 flex items-center justify-center border rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-green-950"
          style={{ borderColor: "var(--border)", color: "var(--green-muted)", height: "44px", fontSize: "16px" }}
          aria-label="Clear selection"
        >
          ✕
        </button>
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

// ─── WordsByLetterHint ────────────────────────────────────────────────────────
// Expandable hint showing how many discoverable words start with each letter.
// Revealed only after all 5 quartiles are found.

function WordsByLetterHint({ letterCounts }: { letterCounts: Record<string, number> }) {
  const entries = Object.entries(letterCounts).sort(([a], [b]) => a.localeCompare(b));
  return (
    <details style={{ width: "100%", minWidth: 0 }}>
      <summary
        className="text-xs tracking-widest cursor-pointer select-none list-none flex items-center gap-1.5 py-1"
        style={{ color: "var(--green-muted)" }}
      >
        <span style={{ fontSize: "10px" }}>▸</span>
        WORDS BY LETTER
        <span className="ml-1 text-[9px] opacity-40 tracking-widest">· hint</span>
      </summary>
      <div className="pt-2 pb-1">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {entries.map(([letter, count]) => (
            <span key={letter} className="font-mono text-xs inline-flex items-baseline gap-1">
              <span className="font-bold uppercase" style={{ color: "var(--green-muted)" }}>{letter}</span>
              <span style={{ color: "#9ca3af" }}>{count}</span>
            </span>
          ))}
        </div>
      </div>
    </details>
  );
}

// ─── CollapsibleWordsDrawer ───────────────────────────────────────────────────
// Collapsed by default; tap the summary to expand and see found words.

function CollapsibleWordsDrawer({ words, invalidGuesses }: { words: ValidatedWord[]; invalidGuesses: string[] }) {
  const sorted = [...words].sort((a, b) => a.word.localeCompare(b.word));
  return (
    <details style={{ width: "100%", minWidth: 0 }}>
      <summary
        className="text-xs tracking-widest cursor-pointer select-none list-none flex items-center gap-1.5 py-1"
        style={{ color: "var(--green-muted)" }}
      >
        <span style={{ fontSize: "10px" }}>▸</span>
        WORDS FOUND ({words.length})
      </summary>
      <div className="pt-2 pb-1 space-y-2">
        {sorted.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--green-dark)" }}>No words found yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((w, i) => (
              <span
                key={i}
                className={`text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  w.isQuartile
                    ? "border-yellow-600 bg-yellow-950 text-yellow-300"
                    : "border-green-800 bg-black text-green-400"
                }`}
              >
                {w.word}
              </span>
            ))}
          </div>
        )}
        {invalidGuesses.length > 0 && (
          <div className="pt-1">
            <p className="text-xs mb-1" style={{ color: "var(--green-dark)" }}>
              {invalidGuesses.length} invalid guess{invalidGuesses.length !== 1 ? "es" : ""}
            </p>
            <div className="flex flex-wrap gap-1">
              {[...new Set(invalidGuesses)].map((g, i) => (
                <span
                  key={i}
                  className="text-xs font-mono uppercase px-1.5 py-0.5 rounded"
                  style={{ color: "var(--green-dark)", border: "1px solid var(--green-dark)" }}
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
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
  score, words, puzzle, shareCard, allWordsFound, puzzleId, puzzleNumber, elapsedSeconds, onDismiss,
}: {
  score: number;
  words: ValidatedWord[];
  puzzle: Puzzle;
  shareCard: string;
  allWordsFound: boolean;
  puzzleId?: string;
  puzzleNumber?: number;
  elapsedSeconds?: number;
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
          {elapsedSeconds != null && (
            <p className="text-xs font-mono tabular-nums mt-1" style={{ color: "var(--green-dark)" }}>
              ⏱ {formatElapsedTime(elapsedSeconds)}
            </p>
          )}
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
  initialTileOrder,
  creatorName,
}: {
  encodedPuzzle: string | null;
  puzzleId?: string;
  puzzleNumber?: number;
  /** Creator-defined starting order: comma-separated tile IDs, or null to shuffle. */
  initialTileOrder?: string | null;
  creatorName?: string;
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
  // Tile DOM element refs — keyed by tile.id, used for FLIP shuffle animations
  const tileRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  // Tile positions captured just before a shuffle; consumed by useLayoutEffect
  const pendingFlip = useRef<Map<string, DOMRect> | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  // true = discovered quartile tiles are pinned to top rows (default)
  // false = all tiles move freely together
  const [quartilesPinned, setQuartilesPinned] = useState(true);

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
    guesses: string[],
    elapsed: number
  ) => {
    if (!progressKey) return;
    try {
      localStorage.setItem(progressKey, JSON.stringify({
        discoveredWords: words,
        tileOrder: order,
        invalidGuesses: guesses,
        elapsedSeconds: elapsed,
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
          if (typeof saved.elapsedSeconds === "number") {
            setElapsedSeconds(saved.elapsedSeconds);
          }
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

    if (!restored) {
      // Use the creator's defined starting order if provided and valid
      if (initialTileOrder) {
        const idToTile = Object.fromEntries(decoded.tiles.map((t) => [t.id, t]));
        const ordered = initialTileOrder
          .split(",")
          .map((id) => idToTile[id])
          .filter(Boolean) as typeof decoded.tiles;
        setTileOrder(ordered.length === decoded.tiles.length ? ordered : shuffleArray([...decoded.tiles]));
      } else {
        setTileOrder(shuffleArray([...decoded.tiles]));
      }
    }

    loadWordSet()
      .then((ws) => {
        setWordSet(ws);
        setTimeout(() => {
          const stats = computePuzzleStats(decoded, ws);
          setPuzzleStats(stats);
        }, 0);
      })
      .catch(() => setError("Failed to load word list. Please refresh."))
      .finally(() => {
        setLoading(false);
        setTimerRunning(true);
      });
  }, [encodedPuzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived: which seed groups have a found quartile
  const foundQuartiles = puzzle ? getFoundQuartiles(discoveredWords, puzzle) : new Set<number>();

  // Derived: letter → count of all discoverable words (used by WordsByLetterHint)
  // Runs once puzzle + wordSet are both available; result is stable.
  const wordsByLetter = useMemo<Record<string, number> | null>(() => {
    if (!puzzle || !wordSet) return null;
    const allWords = findAllValidWords(puzzle, wordSet);
    const counts: Record<string, number> = {};
    for (const word of allWords.keys()) {
      const letter = word[0].toUpperCase();
      counts[letter] = (counts[letter] ?? 0) + 1;
    }
    return counts;
  }, [puzzle, wordSet]);

  // Auto-finish: show completion modal as soon as every discoverable word is found
  useEffect(() => {
    if (
      puzzleStats &&
      discoveredWords.length > 0 &&
      discoveredWords.length >= puzzleStats.totalWords &&
      !showCompletion
    ) {
      clearProgress();
      setTimerRunning(false);
      setShowCompletion(true);
    }
  }, [discoveredWords.length, puzzleStats, showCompletion, clearProgress]);

  // Persist progress to localStorage after each change
  useEffect(() => {
    if (puzzle && discoveredWords.length > 0) {
      saveProgress(discoveredWords, tileOrder, invalidGuesses, elapsedSeconds);
    }
  }, [discoveredWords, tileOrder, invalidGuesses, elapsedSeconds, puzzle, saveProgress]);

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
      // Capture positions so the FLIP animation plays when tiles lock to the top
      const positions = new Map<string, DOMRect>();
      tileRefs.current.forEach((el, id) => positions.set(id, el.getBoundingClientRect()));
      pendingFlip.current = positions;
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

  // Track tab visibility so the timer can pause when the player switches away
  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => {
    const handleVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Timer — count up every second; pauses automatically when tab is hidden
  useEffect(() => {
    if (!timerRunning || !tabVisible) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning, tabVisible]);

  // FLIP animation — runs after tileOrder changes caused by shuffle/toggleLock.
  // Reads old positions from pendingFlip, measures new positions, then applies
  // inverted transforms and animates them back to zero with a spring bounce.
  useLayoutEffect(() => {
    const oldPositions = pendingFlip.current;
    if (!oldPositions) return;
    pendingFlip.current = null;

    tileRefs.current.forEach((el, id) => {
      const oldPos = oldPositions.get(id);
      if (!oldPos) return;
      const newPos = el.getBoundingClientRect();
      const dx = oldPos.left - newPos.left;
      const dy = oldPos.top - newPos.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      // INVERT: snap tile to its old visual position before paint
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;

      // PLAY: one rAF later, release with a spring so the tile flies home
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = "transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1)";
          el.style.transform = "";
        });
      });
    });
  }, [tileOrder]);

  // Shuffle — when pinned, only the free tail (after locked quartile rows) is
  // reshuffled. When unpinned, all 20 tiles are shuffled together.
  const handleShuffle = useCallback(() => {
    // Capture positions before the state update so FLIP knows where tiles were
    const positions = new Map<string, DOMRect>();
    tileRefs.current.forEach((el, id) => positions.set(id, el.getBoundingClientRect()));
    pendingFlip.current = positions;

    setTileOrder((prev) => {
      if (!quartilesPinned) return shuffleArray([...prev]);
      const lockCount = foundQuartiles.size * 4;
      return [
        ...prev.slice(0, lockCount),
        ...shuffleArray([...prev.slice(lockCount)]),
      ];
    });
  }, [foundQuartiles, quartilesPinned]);

  // Toggle lock — pins or unpins discovered quartile tiles.
  const handleToggleLock = useCallback(() => {
    if (!puzzle) return;

    // Capture tile positions so the FLIP animation can play
    const positions = new Map<string, DOMRect>();
    tileRefs.current.forEach((el, id) => positions.set(id, el.getBoundingClientRect()));
    pendingFlip.current = positions;

    if (quartilesPinned) {
      // Unpin: release all tiles into a single shuffled pool.
      setTileOrder((prev) => shuffleArray([...prev]));
      setQuartilesPinned(false);
    } else {
      // Re-pin: pull discovered quartile tiles to the top rows in canonical
      // seed order; leave the remaining tiles below in their current order.
      setTileOrder((prev) => {
        const discoveredSeedIndices = [...foundQuartiles].sort((a, b) => a - b);
        const pinnedIds = new Set(
          discoveredSeedIndices.flatMap((si) => puzzle.seedTiles[si].map((t) => t.id))
        );
        const pinnedTiles = discoveredSeedIndices.flatMap((si) => puzzle.seedTiles[si]);
        const freeTiles = prev.filter((t) => !pinnedIds.has(t.id));
        return [...pinnedTiles, ...freeTiles];
      });
      setQuartilesPinned(true);
    }
  }, [puzzle, quartilesPinned, foundQuartiles]);

  // Share card
  const puzzleUrl = puzzleNumber != null
    ? `20tile.app/play/${puzzleNumber}`
    : typeof window !== "undefined" ? window.location.href : "20tile.app";
  const shareCard = puzzle ? generateShareCard(discoveredWords, puzzle, score, puzzleUrl, puzzleStats ?? undefined, elapsedSeconds, creatorName) : "";

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
          elapsedSeconds={elapsedSeconds}
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
        className="max-w-sm mx-auto"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: "100dvh",
          padding: "12px",
          gap: "8px",
          boxSizing: "border-box",
        }}
      >
        {/*
          ── TOP SECTION ────────────────────────────────────────────────────────
          flex: 1 + minHeight: 0  fills all viewport height MINUS the bottom
          strip. overflow: hidden is the hard ceiling — no child may push
          this taller. The tile grid inside uses flex: 1 + minHeight: 0 to
          fill whatever space remains after header / chips / action bar.
        */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* ── Compact single-line header ──────────────────────────────── */}
          <header
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {/* Back link */}
            <Link
              href="/"
              className="text-xs tracking-widest opacity-40 hover:opacity-100 transition-opacity font-mono flex-none"
              style={{ color: "var(--green)" }}
            >
              ← 20TILE
            </Link>

            {/* Score + word count — centred */}
            <div className="flex-1 flex items-baseline justify-center gap-2">
              <span
                className="text-lg font-bold font-mono tabular-nums text-glow"
                style={{ color: "var(--green)" }}
              >
                {score}
                {puzzleStats?.maxScore != null && (
                  <span className="text-xs font-normal" style={{ color: "var(--green-dark)" }}>
                    /{puzzleStats.maxScore}
                  </span>
                )}
                <span className="text-xs font-normal ml-1" style={{ color: "var(--green-muted)" }}>pts</span>
              </span>
              <span className="text-xs font-mono" style={{ color: "var(--green-muted)" }}>
                {discoveredWords.length}
                {puzzleStats?.totalWords != null ? `/${puzzleStats.totalWords}` : ""} words
              </span>
            </div>

            {/* Timer */}
            <span
              className="text-xs font-mono tabular-nums flex-none"
              style={{ color: "var(--green-muted)" }}
            >
              ⏱ {formatElapsedTime(elapsedSeconds)}
            </span>

            {/* Quartile progress dots */}
            <div className="flex gap-1 items-center flex-none">
              {QUARTILE_COLORS.map((c, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full border transition-all duration-300 ${
                    foundQuartiles.has(i)
                      ? `${c.dot} border-transparent scale-125`
                      : "border-green-800 bg-transparent"
                  }`}
                  title={`${c.label} ${foundQuartiles.has(i) ? "✓" : "○"}`}
                />
              ))}
            </div>
          </header>

          {/* ── Staging chips ────────────────────────────────────────────── */}
          <StagingChips
            selectedTiles={selectedTiles}
            onDeselect={(id) => setSelectedIds((prev) => prev.filter((x) => x !== id))}
            shaking={shaking}
          />

          {/*
            ── 4×5 TILE GRID ──────────────────────────────────────────────
            flex: 1 + minHeight: 0  takes every pixel remaining after
            header / chips / action bar. overflow: hidden prevents bleed.
            gridTemplateRows: repeat(5, 1fr) divides the exact height into
            5 equal rows so tiles are always square-ish without aspect-ratio.
          */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gridTemplateRows: "repeat(5, minmax(0, 60px))",
              gap: "10px",
            }}
          >
            {tileOrder.map((tile) => (
              <TileCell
                key={tile.id}
                ref={(el) => {
                  if (el) tileRefs.current.set(tile.id, el);
                  else tileRefs.current.delete(tile.id);
                }}
                tile={tile}
                isSelected={selectedIds.includes(tile.id)}
                quartileIndex={foundQuartiles.has(tile.seedIndex) ? tile.seedIndex : null}
                shake={shaking && selectedIds.includes(tile.id)}
                onClick={() => handleTileTap(tile)}
              />
            ))}
          </div>

          {/* ── Action bar (below grid) ──────────────────────────────────── */}
          <ActionBar
            onShuffle={handleShuffle}
            onSubmit={handleSubmit}
            onClear={() => setSelectedIds([])}
            onToggleLock={handleToggleLock}
            canSubmit={selectedIds.length >= 1 && !!wordSet}
            shaking={shaking}
            selectedCount={selectedTiles.length}
            isLocked={quartilesPinned}
            hasDiscoveredQuartiles={foundQuartiles.size > 0}
          />
        </div>

        {/*
          ── BOTTOM STRIP ───────────────────────────────────────────────────────
          Collapsed words drawer + optional FINISH PUZZLE button.
          flexShrink: 0 so the top section always wins the height budget.
          maxHeight + overflowY: auto lets the drawer scroll if opened.
        */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <CollapsibleWordsDrawer words={discoveredWords} invalidGuesses={invalidGuesses} />

          {/* Words by letter hint — unlocked after all 5 quartiles are found */}
          {foundQuartiles.size === 5 && wordsByLetter && (
            <WordsByLetterHint letterCounts={wordsByLetter} />
          )}

          {/* Show once all 5 quartiles are found but game hasn't auto-finished */}
          {foundQuartiles.size === 5 && !showCompletion && (
            <button
              onClick={() => { setTimerRunning(false); setShowCompletion(true); }}
              className="w-full py-2 border text-xs font-mono tracking-widest uppercase rounded transition-colors hover:bg-yellow-950"
              style={{ borderColor: "#854d0e", color: "#fde68a", flexShrink: 0 }}
            >
              🏆 [ FINISH PUZZLE ]
            </button>
          )}
        </div>
      </div>
    </>
  );
}
