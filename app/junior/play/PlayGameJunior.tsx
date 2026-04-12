"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  decodeJuniorPuzzle,
  loadKidsWordSet,
  evaluateJuniorSelection,
  getFound3Tiles,
  computeJuniorPuzzleStats,
  findAllValidJuniorWords,
  isJuniorComplete,
  formatElapsedTime,
  shuffleArray,
  JUNIOR_WORD_GOAL,
  type JuniorPuzzle,
  type ValidatedWord,
} from "@/lib/junior-word-engine";
import type { Tile } from "@/lib/junior-word-engine";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEED_COLORS = [
  { border: "border-sky-400",    bg: "bg-sky-100",    text: "text-sky-700",    dot: "bg-sky-400",    label: "W1" },
  { border: "border-violet-400", bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-400", label: "W2" },
  { border: "border-amber-400",  bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-400",  label: "W3" },
  { border: "border-rose-400",   bg: "bg-rose-100",   text: "text-rose-700",   dot: "bg-rose-400",   label: "W4" },
  { border: "border-emerald-400",bg: "bg-emerald-100",text: "text-emerald-700",dot: "bg-emerald-400",label: "W5" },
];

const SCORE_GOAL_PCT = 0.7; // 70% of maxScore triggers the "bonus zone"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "tile3" | "info";
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const target = Math.max(1, Math.floor(maxScore * SCORE_GOAL_PCT));
  const goalReached = score >= target;

  // Main fill: 0 → target, mapped to 0–70% of the bar width
  const mainFillPct = Math.min((score / target) * 70, 70);
  // Bonus fill: target → maxScore, mapped to 70–100% of the bar width
  const bonusFillPct =
    goalReached && maxScore > target
      ? Math.min(((score - target) / (maxScore - target)) * 30, 30)
      : 0;

  return (
    <div className="space-y-1.5">
      {/* Bar */}
      <div className="relative" style={{ height: 16, borderRadius: 8 }}>
        {/* Track */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "#e2e8f0" }}
        />

        {/* Bonus zone dashed outline — always visible once goal is met */}
        {goalReached && (
          <div
            className="absolute inset-y-0 rounded-r-full"
            style={{
              left: "70%",
              right: 0,
              border: "2px dashed #94a3b8",
              borderLeft: "none",
              background: "transparent",
            }}
          />
        )}

        {/* Main solid fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${mainFillPct}%`,
            background: goalReached
              ? "linear-gradient(90deg, #34d399, #10b981)"
              : "linear-gradient(90deg, #60a5fa, #3b82f6)",
          }}
        />

        {/* Bonus fill (amber, appears only after goal) */}
        {goalReached && bonusFillPct > 0 && (
          <div
            className="absolute inset-y-0 rounded-r-full transition-all duration-500"
            style={{
              left: "70%",
              width: `${bonusFillPct}%`,
              background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
            }}
          />
        )}

        {/* Goal marker line at 70% */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: "70%",
            width: 2,
            background: "white",
            opacity: 0.9,
          }}
        />

        {/* Star at goal marker */}
        <div
          className="absolute -top-1 text-[10px] select-none"
          style={{ left: "calc(70% - 5px)" }}
        >
          🎯
        </div>
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
        <span>{score} pts</span>
        {!goalReached ? (
          <span>goal: {target} pts</span>
        ) : (
          <span className="text-amber-500 font-bold animate-pulse">
            🌟 Keep going!
          </span>
        )}
        <span>{maxScore} pts</span>
      </div>
    </div>
  );
}

// ─── TileCell ─────────────────────────────────────────────────────────────────

function TileCell({
  tile,
  isSelected,
  seedIndex3Tile,
  shake,
  onClick,
}: {
  tile: Tile;
  isSelected: boolean;
  seedIndex3Tile: number | null;
  shake: boolean;
  onClick: () => void;
}) {
  const isLocked = seedIndex3Tile !== null;
  const qColor = isLocked ? SEED_COLORS[seedIndex3Tile] : null;

  let borderCls: string;
  let bgCls: string;
  let textCls: string;
  let shadowCls = "";

  if (isLocked && isSelected && qColor) {
    borderCls = "border-white/80";
    bgCls = qColor.bg;
    textCls = "font-bold text-slate-800";
    shadowCls = "shadow-[0_0_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.7)] active:shadow-inner";
  } else if (isLocked && qColor) {
    borderCls = qColor.border;
    bgCls = qColor.bg;
    textCls = qColor.text;
    shadowCls = "shadow-[0_2px_8px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:shadow-inner";
  } else if (isSelected) {
    borderCls = "border-sky-400";
    bgCls = "bg-sky-50";
    textCls = "text-sky-700";
    shadowCls = "shadow-[0_0_16px_rgba(56,189,248,0.4),inset_0_1px_0_rgba(255,255,255,0.8)] active:shadow-inner";
  } else {
    borderCls = "border-slate-200";
    bgCls = "bg-white";
    textCls = "text-slate-700";
    shadowCls = "shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(56,189,248,0.3)] active:shadow-inner";
  }

  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Tile ${tile.letters}`}
      className={`
        relative w-full h-full flex items-center justify-center
        border-2 rounded-2xl
        font-mono font-bold tracking-wide lowercase
        text-xl sm:text-2xl
        transition-all duration-150 select-none
        ${borderCls} ${bgCls} ${textCls} ${shadowCls}
        ${shake ? "animate-shake" : ""}
      `}
    >
      {tile.letters}
      {isLocked && (
        <span className={`absolute top-1 right-1 text-[8px] leading-none opacity-60 ${qColor?.text}`}>★</span>
      )}
    </button>
  );
}

// ─── StagingChips ─────────────────────────────────────────────────────────────

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
    <div style={{ flexShrink: 0, height: "52px", display: "flex", alignItems: "center" }}>
      {selectedTiles.length === 0 ? (
        <div
          className="w-full flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200"
          style={{ height: "44px" }}
        >
          <span className="text-xs font-mono tracking-widest text-slate-700 uppercase">
            Select up to 3 tiles
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
                border-2 border-sky-400 bg-sky-50 text-sky-700
                rounded-xl font-mono font-bold tracking-wide lowercase
                px-3 py-1.5 text-sm
                transition-colors duration-150 select-none
                hover:bg-sky-100 active:opacity-80
                shadow-[0_0_12px_rgba(56,189,248,0.25)]
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

function ActionBar({
  onShuffle,
  onSubmit,
  onClear,
  canSubmit,
  shaking,
  selectedCount,
}: {
  onShuffle: () => void;
  onSubmit: () => void;
  onClear: () => void;
  canSubmit: boolean;
  shaking: boolean;
  selectedCount: number;
}) {
  return (
    <div style={{ flexShrink: 0, display: "flex", gap: "8px", alignItems: "stretch" }}>
      <button
        onClick={onShuffle}
        className="flex items-center justify-center border-2 border-slate-200 bg-white rounded-xl transition-all hover:bg-slate-50 text-slate-600"
        style={{ width: "48px", height: "44px", fontSize: "18px" }}
        aria-label="Shuffle tiles"
      >
        ⟳
      </button>

      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`
          flex-1 border-2 text-sm font-mono font-bold tracking-widest uppercase rounded-xl
          transition-all
          ${canSubmit
            ? "border-sky-400 bg-sky-50 text-sky-700 hover:bg-sky-100 cursor-pointer"
            : "border-slate-200 bg-white text-slate-300 opacity-40 cursor-not-allowed"
          }
          ${shaking ? "animate-shake" : ""}
        `}
        style={{ height: "44px" }}
      >
        ✓ SUBMIT{selectedCount > 0 ? ` (${selectedCount})` : ""}
      </button>

      <button
        onClick={onClear}
        disabled={selectedCount === 0}
        className="flex items-center justify-center border-2 border-slate-200 bg-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-600"
        style={{ width: "48px", height: "44px", fontSize: "16px" }}
        aria-label="Clear selection"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Toast List ───────────────────────────────────────────────────────────────

function ToastList({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const styles: Record<Toast["type"], string> = {
          success: "border-emerald-300 bg-emerald-50 text-emerald-700",
          error:   "border-red-300 bg-red-50 text-red-600",
          tile3:   "border-amber-300 bg-amber-50 text-amber-700",
          info:    "border-slate-200 bg-white text-slate-700",
        };
        return (
          <div
            key={t.id}
            className={`px-4 py-2 border-2 rounded-xl font-mono text-sm tracking-wide uppercase shadow-lg ${styles[t.type]}`}
            style={{ animation: "fadeSlideDown 0.25s ease-out" }}
          >
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

// ─── Words Drawer ─────────────────────────────────────────────────────────────

function CollapsibleWordsDrawer({ words, invalidGuesses }: { words: ValidatedWord[]; invalidGuesses: string[] }) {
  const sorted = [...words].sort((a, b) => a.word.localeCompare(b.word));
  return (
    <details style={{ width: "100%", minWidth: 0 }}>
      <summary className="text-xs tracking-widest cursor-pointer select-none list-none flex items-center gap-1.5 py-1 text-slate-600">
        <span style={{ fontSize: "10px" }}>▸</span>
        WORDS FOUND ({words.length})
      </summary>
      <div className="pt-2 pb-1 space-y-2">
        {sorted.length === 0 ? (
          <p className="text-xs text-slate-700">No words found yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((w, i) => (
              <span
                key={i}
                className={`text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border-2 ${
                  w.isQuartile
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {w.word}
              </span>
            ))}
          </div>
        )}
        {invalidGuesses.length > 0 && (
          <div className="pt-1">
            <p className="text-xs mb-1 text-slate-700">
              {invalidGuesses.length} invalid guess{invalidGuesses.length !== 1 ? "es" : ""}
            </p>
            <div className="flex flex-wrap gap-1">
              {[...new Set(invalidGuesses)].map((g, i) => (
                <span key={i} className="text-xs font-mono uppercase px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
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

function CompletionModal({
  score,
  words,
  puzzle,
  puzzleStats,
  elapsedSeconds,
  onDismiss,
  onKeepPlaying,
}: {
  score: number;
  words: ValidatedWord[];
  puzzle: JuniorPuzzle;
  puzzleStats: { totalWords: number; maxScore: number } | null;
  elapsedSeconds: number;
  onDismiss: () => void;
  onKeepPlaying: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const found3Tiles = getFound3Tiles(words, puzzle);
  const tile3Words = words.filter((w) => w.isQuartile);
  const otherWords = words.filter((w) => !w.isQuartile);
  const allWordsFound = puzzleStats != null && words.length >= puzzleStats.totalWords;

  const shareText = [
    "20TILE JR",
    puzzleStats ? `Score: ${score}/${puzzleStats.maxScore} pts` : `Score: ${score} pts`,
    "",
    `Found ${words.length} words${allWordsFound ? " — ALL of them! 🏆" : ""}`,
    `3tiles: ${found3Tiles.size}/5`,
    `⏱ ${formatElapsedTime(elapsedSeconds)}`,
    "",
    "20tile.app/junior",
  ].join("\n");

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareText); }
    catch {
      const el = document.createElement("textarea");
      el.value = shareText; document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-sm border-2 border-slate-200 rounded-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh] bg-white shadow-2xl"
      >
        <div className="text-center space-y-1">
          <p className="text-4xl">{allWordsFound ? "🏆" : "🎉"}</p>
          <h2 className="text-xl font-bold tracking-widest font-mono text-sky-700">
            {allWordsFound ? "ALL WORDS FOUND!" : "15 WORDS!"}
          </h2>
          <p className="text-xs tracking-widest text-slate-700">
            {found3Tiles.size}/5 3tiles · {words.length} words found
          </p>
        </div>

        {/* Score */}
        <div className="text-center border-2 border-slate-100 rounded-xl py-3 bg-slate-50">
          <p className="text-4xl font-bold font-mono tabular-nums text-sky-600">{score}</p>
          <p className="text-xs tracking-widest mt-1 text-slate-700">TOTAL POINTS</p>
          <p className="text-xs font-mono tabular-nums mt-1 text-slate-700">
            ⏱ {formatElapsedTime(elapsedSeconds)}
          </p>
        </div>

        {/* 3tiles found */}
        {tile3Words.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs tracking-widest text-slate-700">3TILES FOUND</p>
            {tile3Words.map((w, i) => (
              <div key={i} className="flex justify-between text-xs font-mono">
                <span className="text-amber-600 uppercase tracking-wider font-bold">{w.word}</span>
                <span className="text-slate-700">3 pts</span>
              </div>
            ))}
          </div>
        )}

        {/* Other words */}
        {otherWords.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs tracking-widest text-slate-700">OTHER WORDS ({otherWords.length})</p>
            <div className="flex flex-wrap gap-1">
              {[...otherWords].sort((a, b) => b.points - a.points).slice(0, 12).map((w, i) => (
                <span key={i} className="text-xs font-mono uppercase px-1.5 py-0.5 rounded-lg border border-slate-200 text-slate-600">
                  {w.word} <span className="opacity-50">{w.points}p</span>
                </span>
              ))}
              {otherWords.length > 12 && (
                <span className="text-xs text-slate-700">+{otherWords.length - 12} more</span>
              )}
            </div>
          </div>
        )}

        {/* Share */}
        <div className="space-y-2">
          <p className="text-xs tracking-widest text-slate-700">SHARE YOUR SCORE</p>
          <pre className="text-xs font-mono whitespace-pre p-3 rounded-xl border-2 border-slate-100 leading-relaxed bg-slate-50 text-slate-700">
            {shareText}
          </pre>
          <button
            onClick={handleCopy}
            className="w-full py-2 border-2 border-sky-300 text-xs font-mono tracking-widest uppercase rounded-xl transition-all hover:bg-sky-50 text-sky-600"
          >
            {copied ? "✓ COPIED!" : "[ COPY SHARE CARD ]"}
          </button>
        </div>

        <div className="space-y-2">
          {/* Keep playing (always available until all words found) */}
          {!allWordsFound && (
            <button
              onClick={onKeepPlaying}
              className="w-full py-2 border-2 border-emerald-300 text-xs font-mono tracking-widest uppercase rounded-xl transition-all hover:bg-emerald-50 text-emerald-600 font-bold"
            >
              KEEP PLAYING →
            </button>
          )}
          <Link
            href="/junior"
            className="block w-full py-2 border-2 border-slate-200 text-xs font-mono tracking-widest uppercase rounded-xl transition-all text-center hover:bg-slate-50 text-slate-700"
          >
            ← BACK TO JUNIOR
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Game Component ──────────────────────────────────────────────────────

export default function PlayGameJunior({
  encodedPuzzle,
  puzzleId,
  puzzleNumber,
}: {
  encodedPuzzle: string | null;
  puzzleId?: string;
  puzzleNumber?: number;
}) {
  const [puzzle, setPuzzle] = useState<JuniorPuzzle | null>(null);
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
  const completionTriggeredRef = useRef(false); // prevents re-opening modal after "Keep Playing"
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const addToast = useCallback((message: string, type: Toast["type"], duration = 1800) => {
    const id = ++toastCounterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  // Progress persistence
  const progressKey = puzzleNumber != null
    ? `jr_progress_${puzzleNumber}`
    : encodedPuzzle ? `jr_progress_url_${encodedPuzzle.slice(0, 40)}` : null;

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
    } catch { /* storage full */ }
  }, [progressKey]);

  const clearProgress = useCallback(() => {
    if (!progressKey) return;
    try { localStorage.removeItem(progressKey); } catch { /* ignore */ }
  }, [progressKey]);

  // Load puzzle + word list
  useEffect(() => {
    if (!encodedPuzzle) {
      setError("No puzzle found. Ask the creator to share the link again.");
      setLoading(false);
      return;
    }
    const decoded = decodeJuniorPuzzle(encodedPuzzle);
    if (!decoded) {
      setError("This puzzle link doesn't work. Please check the URL.");
      setLoading(false);
      return;
    }
    setPuzzle(decoded);

    const savedKey = puzzleNumber != null
      ? `jr_progress_${puzzleNumber}`
      : `jr_progress_url_${encodedPuzzle.slice(0, 40)}`;
    let restored = false;
    try {
      const raw = localStorage.getItem(savedKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.discoveredWords?.length > 0) {
          setDiscoveredWords(saved.discoveredWords);
          setScore(saved.discoveredWords.reduce((sum: number, w: ValidatedWord) => sum + w.points, 0));
          setInvalidGuesses(saved.invalidGuesses ?? []);
          if (typeof saved.elapsedSeconds === "number") setElapsedSeconds(saved.elapsedSeconds);
          const savedIds = new Set((saved.tileOrder as Tile[]).map((t) => t.id));
          const puzzleIds = new Set(decoded.tiles.map((t) => t.id));
          const orderValid = savedIds.size === puzzleIds.size && [...savedIds].every((id) => puzzleIds.has(id));
          setTileOrder(orderValid ? saved.tileOrder : shuffleArray([...decoded.tiles]));
          restored = true;
        }
      }
    } catch { /* corrupted */ }

    if (!restored) setTileOrder(shuffleArray([...decoded.tiles]));

    loadKidsWordSet()
      .then((ws) => {
        setWordSet(ws);
        setTimeout(() => {
          const stats = computeJuniorPuzzleStats(decoded, ws);
          setPuzzleStats(stats);
        }, 0);
      })
      .catch(() => setError("Failed to load word list. Please refresh."))
      .finally(() => {
        setLoading(false);
        setTimerRunning(true);
      });
  }, [encodedPuzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived: found 3tiles set
  const found3Tiles = puzzle ? getFound3Tiles(discoveredWords, puzzle) : new Set<number>();

  // Words by letter hint (unlocked after all 5 3tiles found)
  const wordsByLetter = useMemo<Record<string, number> | null>(() => {
    if (!puzzle || !wordSet || found3Tiles.size < 5) return null;
    const allWords = findAllValidJuniorWords(puzzle, wordSet);
    const counts: Record<string, number> = {};
    for (const word of allWords.keys()) {
      const letter = word[0].toUpperCase();
      counts[letter] = (counts[letter] ?? 0) + 1;
    }
    return counts;
  }, [puzzle, wordSet, found3Tiles.size]);

  // Auto-finish: trigger once when 15 words are hit.
  // Using a ref so this never re-fires after the player clicks "Keep Playing".
  useEffect(() => {
    if (
      discoveredWords.length > 0 &&
      isJuniorComplete(discoveredWords) &&
      !completionTriggeredRef.current
    ) {
      completionTriggeredRef.current = true;
      setTimerRunning(false);
      setShowCompletion(true);
    }
  }, [discoveredWords.length]);

  // Persist progress
  useEffect(() => {
    if (puzzle && discoveredWords.length > 0) {
      saveProgress(discoveredWords, tileOrder, invalidGuesses, elapsedSeconds);
    }
  }, [discoveredWords, tileOrder, invalidGuesses, elapsedSeconds, puzzle, saveProgress]);

  const selectedTiles = selectedIds
    .map((id) => tileOrder.find((t) => t.id === id))
    .filter(Boolean) as Tile[];

  const handleTileTap = useCallback((tile: Tile) => {
    setSelectedIds((prev) => {
      if (prev.includes(tile.id)) return prev.filter((id) => id !== tile.id);
      if (prev.length >= 3) return prev; // max 3 tiles
      return [...prev, tile.id];
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!puzzle || !wordSet || selectedIds.length === 0) return;

    const result = evaluateJuniorSelection(selectedIds, puzzle, wordSet);

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
      isQuartile: result.is3Tile,
    };
    setDiscoveredWords((prev) => [...prev, newWord]);
    setScore((prev) => prev + result.points);
    setSelectedIds([]);

    if (result.is3Tile) {
      const seedIdx = selectedTiles[0].seedIndex;
      setTileOrder((prev) => {
        const lockBoundary = found3Tiles.size * 3;
        const seedTiles = puzzle.seedTiles[seedIdx];
        const seedTileIds = new Set(seedTiles.map((t) => t.id));
        const rest = prev.filter((t) => !seedTileIds.has(t.id));
        return [
          ...rest.slice(0, lockBoundary),
          ...seedTiles,
          ...rest.slice(lockBoundary),
        ];
      });
      addToast(`⭐ 3TILE! "${result.word}" +${result.points}pts`, "tile3", 2500);
    } else {
      addToast(`✓ "${result.word}" +${result.points}pt${result.points !== 1 ? "s" : ""}`, "success");
    }
  }, [puzzle, wordSet, selectedIds, selectedTiles, discoveredWords, found3Tiles, addToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && selectedIds.length > 0) handleSubmit();
      if (e.key === "Escape") setSelectedIds([]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSubmit, selectedIds.length]);

  // Tab visibility + timer
  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => {
    const handleVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
  useEffect(() => {
    if (!timerRunning || !tabVisible) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning, tabVisible]);

  // Shuffle (free tiles only)
  const handleShuffle = useCallback(() => {
    setTileOrder((prev) => {
      const lockCount = found3Tiles.size * 3;
      return [
        ...prev.slice(0, lockCount),
        ...shuffleArray([...prev.slice(lockCount)]),
      ];
    });
  }, [found3Tiles]);

  // ── Render guards ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#f0f9ff" }}>
        <p className="text-sm tracking-widest animate-pulse text-slate-600">Loading puzzle…</p>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 text-center" style={{ background: "#f0f9ff" }}>
        <p className="text-sm text-red-500 max-w-xs">{error || "Unknown error"}</p>
        <Link
          href="/junior/create"
          className="text-xs px-4 py-2 border-2 border-sky-300 text-sky-600 rounded-xl font-mono tracking-widest hover:bg-sky-50 transition-colors"
        >
          CREATE A PUZZLE
        </Link>
      </div>
    );
  }

  // Word count progress toward 15
  const wordsToGoal = Math.max(0, JUNIOR_WORD_GOAL - discoveredWords.length);

  return (
    <>
      <ToastList toasts={toasts} />

      {showCompletion && (
        <CompletionModal
          score={score}
          words={discoveredWords}
          puzzle={puzzle}
          puzzleStats={puzzleStats}
          elapsedSeconds={elapsedSeconds}
          onDismiss={() => { clearProgress(); setShowCompletion(false); }}
          onKeepPlaying={() => setShowCompletion(false)}
        />
      )}

      <div
        className="max-w-sm mx-auto"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          overflow: "hidden",
          padding: "12px",
          gap: "8px",
          boxSizing: "border-box",
          background: "#f0f9ff",
        }}
      >
        {/* Top section */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>

          {/* Header */}
          <header style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Link
              href="/junior"
              className="text-xs tracking-widest opacity-50 hover:opacity-100 transition-opacity font-mono flex-none text-slate-700"
            >
              ← JR
            </Link>

            {/* Word count + timer */}
            <div className="flex-1 flex items-baseline justify-center gap-2">
              <span className="text-base font-bold font-mono tabular-nums text-sky-700">
                {discoveredWords.length}
                <span className="text-xs font-normal text-slate-600">/{JUNIOR_WORD_GOAL} words</span>
              </span>
              {wordsToGoal > 0 && (
                <span className="text-xs font-mono text-slate-600">
                  {wordsToGoal} to go
                </span>
              )}
            </div>

            <span className="text-xs font-mono tabular-nums flex-none text-slate-600">
              ⏱ {formatElapsedTime(elapsedSeconds)}
            </span>

            {/* 3tile progress dots */}
            <div className="flex gap-1 items-center flex-none">
              {SEED_COLORS.map((c, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 ${
                    found3Tiles.has(i)
                      ? `${c.dot} border-transparent scale-125`
                      : "border-slate-300 bg-transparent"
                  }`}
                  title={`${c.label} ${found3Tiles.has(i) ? "✓" : "○"}`}
                />
              ))}
            </div>
          </header>

          {/* Score bar */}
          {puzzleStats && puzzleStats.maxScore > 0 && (
            <div className="px-1">
              <ScoreBar score={score} maxScore={puzzleStats.maxScore} />
            </div>
          )}

          {/* Staging chips */}
          <StagingChips
            selectedTiles={selectedTiles}
            onDeselect={(id) => setSelectedIds((prev) => prev.filter((x) => x !== id))}
            shaking={shaking}
          />

          {/*
            3×5 TILE GRID — 3 columns, 5 rows = 15 tiles.
            Each locked 3tile occupies a full row of 3.
          */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(5, minmax(0, 60px))",
              gap: "10px",
            }}
          >
            {tileOrder.map((tile) => (
              <TileCell
                key={tile.id}
                tile={tile}
                isSelected={selectedIds.includes(tile.id)}
                seedIndex3Tile={found3Tiles.has(tile.seedIndex) ? tile.seedIndex : null}
                shake={shaking && selectedIds.includes(tile.id)}
                onClick={() => handleTileTap(tile)}
              />
            ))}
          </div>

          {/* Action bar */}
          <ActionBar
            onShuffle={handleShuffle}
            onSubmit={handleSubmit}
            onClear={() => setSelectedIds([])}
            canSubmit={selectedIds.length >= 1 && !!wordSet}
            shaking={shaking}
            selectedCount={selectedTiles.length}
          />
        </div>

        {/* Bottom strip */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            width: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <CollapsibleWordsDrawer words={discoveredWords} invalidGuesses={invalidGuesses} />

          {/* Words by letter hint — unlocked after all 5 3tiles found */}
          {found3Tiles.size === 5 && wordsByLetter && (
            <details style={{ width: "100%", minWidth: 0 }}>
              <summary className="text-xs tracking-widest cursor-pointer select-none list-none flex items-center gap-1.5 py-1 text-slate-600">
                <span style={{ fontSize: "10px" }}>▸</span>
                WORDS BY LETTER
                <span className="ml-1 text-[9px] opacity-60 tracking-widest">· hint</span>
              </summary>
              <div className="pt-2 pb-1">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {Object.entries(wordsByLetter).sort(([a], [b]) => a.localeCompare(b)).map(([letter, count]) => (
                    <span key={letter} className="font-mono text-xs inline-flex items-baseline gap-1">
                      <span className="font-bold uppercase text-slate-600">{letter}</span>
                      <span className="text-slate-700">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            </details>
          )}

          {/* Finish / See Results button:
              - Before 15 words: show after all 5 3tiles are found ("Finish Puzzle")
              - After 15 words + modal dismissed: always available ("See Results")
              Neither shows while the modal is already open. */}
          {!showCompletion && (
            <>
              {isJuniorComplete(discoveredWords) ? (
                <button
                  onClick={() => setShowCompletion(true)}
                  className="w-full py-2 border-2 border-sky-300 text-xs font-mono tracking-widest uppercase rounded-xl transition-colors hover:bg-sky-50 text-sky-600"
                  style={{ flexShrink: 0 }}
                >
                  🎉 [ SEE RESULTS ]
                </button>
              ) : found3Tiles.size === 5 ? (
                <button
                  onClick={() => { setTimerRunning(false); setShowCompletion(true); }}
                  className="w-full py-2 border-2 border-amber-300 text-xs font-mono tracking-widest uppercase rounded-xl transition-colors hover:bg-amber-50 text-amber-600"
                  style={{ flexShrink: 0 }}
                >
                  ⭐ [ FINISH PUZZLE ]
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
