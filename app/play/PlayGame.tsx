"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  decodePuzzle,
  loadWordSet,
  evaluateSelection,
  getFoundQuartiles,
  isPuzzleComplete,
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
    // Selected on top of a locked tile — brighten the quartile colour
    borderCls = "border-white";
    bgCls = qColor.bg;
    textCls = "text-white";
    shadowCls = "shadow-[0_0_14px_rgba(255,255,255,0.35)]";
    scaleCls = "scale-105";
  } else if (isLocked && qColor) {
    borderCls = qColor.border;
    bgCls = qColor.bg;
    textCls = qColor.text;
    shadowCls = "hover:shadow-[0_0_8px_rgba(255,255,255,0.15)]";
    scaleCls = "hover:scale-105";
  } else if (isSelected) {
    borderCls = "border-green-300";
    bgCls = "bg-green-900";
    textCls = "text-green-100";
    shadowCls = "shadow-[0_0_12px_rgba(0,255,65,0.4)]";
    scaleCls = "scale-105";
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
  const sizeClass = "w-full h-full text-xs sm:text-sm";

  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Tile ${tile.letters}`}
      className={`
        relative flex items-center justify-center
        border-2 rounded-lg
        font-mono font-bold tracking-widest uppercase
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
      {/* 4 staging slots — same column width as the tile grid; gap fixed (non-responsive) */}
      <div className="grid grid-cols-4 gap-2">
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
                  rounded-lg font-mono font-bold tracking-widest uppercase
                  text-xs sm:text-sm w-full aspect-square
                  transition-all duration-150 select-none
                  hover:bg-green-800 active:scale-95
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
              className="w-full aspect-square rounded-lg border-2 border-dashed flex items-center justify-center"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-xs opacity-20" style={{ color: "var(--green)" }}>·</span>
            </div>
          );
        })}
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
}: {
  score: number;
  discoveredCount: number;
  foundQuartiles: Set<number>;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      {/* Score + word count */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold font-mono tabular-nums text-glow" style={{ color: "var(--green)" }}>
          {score}
          <span className="text-sm font-normal ml-1" style={{ color: "var(--green-muted)" }}>pts</span>
        </span>
        <span className="text-xs" style={{ color: "var(--green-muted)" }}>
          {discoveredCount} word{discoveredCount !== 1 ? "s" : ""}
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

function CompletionModal({
  score, words, puzzle, shareCard, onDismiss,
}: {
  score: number; words: ValidatedWord[]; puzzle: Puzzle; shareCard: string; onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

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
          <p className="text-3xl">🏆</p>
          <h2 className="text-xl font-bold tracking-widest text-glow font-mono" style={{ color: "var(--green)" }}>
            PUZZLE COMPLETE
          </h2>
          <p className="text-xs tracking-widest" style={{ color: "var(--green-muted)" }}>
            {quartileWords.length}/5 quartiles · {words.length} words total
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

        <button onClick={onDismiss}
          className="w-full py-2 border text-xs font-mono tracking-widest uppercase rounded transition-all hover:bg-green-950"
          style={{ borderColor: "var(--border)", color: "var(--green-muted)" }}>
          KEEP PLAYING
        </button>
      </div>
    </div>
  );
}

// ─── Main Game Component ──────────────────────────────────────────────────────

export default function PlayGame({ encodedPuzzle }: { encodedPuzzle: string | null }) {
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
    // Shuffle on load so the seed structure isn't immediately visible
    setTileOrder(shuffleArray([...decoded.tiles]));
    loadWordSet()
      .then(setWordSet)
      .catch(() => setError("Failed to load word list. Please refresh."))
      .finally(() => setLoading(false));
  }, [encodedPuzzle]);

  // Derived: which seed groups have a found quartile
  const foundQuartiles = puzzle ? getFoundQuartiles(discoveredWords, puzzle) : new Set<number>();
  const complete = puzzle ? isPuzzleComplete(discoveredWords, puzzle) : false;

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
  const shareCard = puzzle ? generateShareCard(discoveredWords, puzzle, score) : "";

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
      {/* Toasts — fixed positioned, zero document-flow impact */}
      <ToastList toasts={toasts} />

      {/* Completion modal — fixed overlay */}
      {showCompletion && (
        <CompletionModal
          score={score}
          words={discoveredWords}
          puzzle={puzzle}
          shareCard={shareCard}
          onDismiss={() => setShowCompletion(false)}
        />
      )}

      {/*
        Fixed full-viewport layout. Every section is flex-none with a
        deterministic height, except the discovered-words panel which is
        flex-1 and scrolls internally. Nothing shifts at any point during play.
      */}
      <div className="h-dvh flex flex-col max-w-lg mx-auto px-3 py-4 gap-3 overflow-hidden">

        {/* Nav */}
        <header className="flex-none flex items-center justify-between">
          <Link
            href="/"
            className="text-xs tracking-widest opacity-40 hover:opacity-100 transition-opacity"
            style={{ color: "var(--green)" }}
          >
            ← 20TILE
          </Link>
        </header>

        {/* Score + quartile progress dots */}
        <div className="flex-none">
          <ScoreHeader
            score={score}
            discoveredCount={discoveredWords.length}
            foundQuartiles={foundQuartiles}
          />
        </div>

        {/* Staging row + action buttons */}
        <div className="flex-none">
          <StagingRow
            selectedTiles={selectedTiles}
            onDeselect={(id) => setSelectedIds((prev) => prev.filter((x) => x !== id))}
            onClear={() => setSelectedIds([])}
            onSubmit={handleSubmit}
            onShuffle={handleShuffle}
            canSubmit={selectedIds.length >= 1 && !!wordSet}
            shaking={shaking}
          />
        </div>

        {/*
          4×5 tile grid — explicit CSS grid with a fixed height.

          Height is set via aspect-ratio: 4/5 on the container. Because
          width is fixed (100% of a max-w-lg column) and height is derived
          only from that width, the grid is pixel-identical whether 0 or 5
          quartiles are found. Tiles use h-full so they fill their cell
          without pushing the container height — the container owns its size.

          gap: 8px is a hard constant (not a responsive Tailwind class) so
          it cannot cause a height change at any breakpoint.
          overflow: hidden is a hard ceiling — no child can expand the box.
        */}
        <div
          className="flex-none w-full"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gridTemplateRows: "repeat(5, 1fr)",
            gap: "8px",
            aspectRatio: "4 / 5",
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

        {/* Discovered words — consumes all remaining vertical space, scrolls internally */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <DiscoveredWordsPanel words={discoveredWords} invalidGuesses={invalidGuesses} />
        </div>

        {/*
          Bottom bar — always the same fixed height (h-10).
          Content switches between a keyboard hint and the Finish button
          when all quartiles are found. Never causes layout shift.
        */}
        <div
          className="flex-none h-10 flex items-center justify-center border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {complete && !showCompletion ? (
            <button
              onClick={() => setShowCompletion(true)}
              className="text-xs font-mono tracking-widest uppercase border px-4 py-1.5 rounded transition-colors hover:bg-yellow-950 whitespace-nowrap"
              style={{ borderColor: "#854d0e", color: "#fde68a" }}
            >
              🏆 [ FINISH GAME ]
            </button>
          ) : (
            <p className="text-xs" style={{ color: "var(--green-dark)" }}>
              Enter to submit · Escape to clear
            </p>
          )}
        </div>

      </div>
    </>
  );
}
