/**
 * 20Tile Word Engine
 * Core logic for tile splitting, validation, path-finding, and scoring.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Tile {
  id: string;      // e.g. "s0-t2"  (seed index, tile index within seed)
  letters: string; // 2–4 chars
  seedIndex: number;
  tileIndex: number;
}

export interface Puzzle {
  tiles: Tile[];           // All 20 tiles (shuffled for gameplay)
  seedWords: string[];     // The 5 original seed words
  seedTiles: Tile[][];     // [5][4] tile groups per seed
}

export interface ValidatedWord {
  word: string;
  tileIds: string[];
  points: number;
  isQuartile: boolean;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export function scoreForTileCount(count: number): number {
  switch (count) {
    case 1: return 1;
    case 2: return 2;
    case 3: return 4;
    case 4: return 8;
    default: return 0;
  }
}

// ─── Auto-split a word into exactly 4 tiles (2–4 letters each) ───────────────

/**
 * Splits a word into exactly 4 tiles where each tile is 2–4 letters.
 * Returns null if the word cannot be split (word length < 8 or > 16).
 * Greedy algorithm that balances tile lengths.
 */
export function autoSplitWord(word: string): string[] | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  const len = w.length;

  // Word must be splittable into 4 tiles of 2–4 letters → length 8–16
  if (len < 8 || len > 16) return null;

  // Use dynamic programming to find all valid 4-tile splits
  const splits = findAllSplits(w, 4);
  if (splits.length === 0) return null;

  // Pick the most balanced split (minimise variance in tile lengths)
  return pickBalancedSplit(splits);
}

/** Find all ways to split `word` into exactly `k` pieces of 2–4 letters each */
function findAllSplits(word: string, k: number): string[][] {
  const results: string[][] = [];

  function recurse(start: number, remaining: number, current: string[]): void {
    if (remaining === 0) {
      if (start === word.length) results.push([...current]);
      return;
    }
    const charsLeft = word.length - start;
    const minNeeded = remaining * 2;
    const maxNeeded = remaining * 4;
    if (charsLeft < minNeeded || charsLeft > maxNeeded) return;

    for (let len = 2; len <= 4; len++) {
      if (start + len > word.length) break;
      current.push(word.slice(start, start + len));
      recurse(start + len, remaining - 1, current);
      current.pop();
    }
  }

  recurse(0, k, []);
  return results;
}

/** Choose the split with lowest variance (most balanced tile lengths) */
function pickBalancedSplit(splits: string[][]): string[] {
  let best = splits[0];
  let bestVariance = Infinity;

  for (const split of splits) {
    const avg = split.reduce((s, t) => s + t.length, 0) / split.length;
    const variance = split.reduce((s, t) => s + Math.pow(t.length - avg, 2), 0);
    if (variance < bestVariance) {
      bestVariance = variance;
      best = split;
    }
  }
  return best;
}

// ─── Tile rebalancing within a seed group ────────────────────────────────────

/**
 * Given 4 tile strings for one seed word, try to shift letters between
 * adjacent tiles to produce a different valid 4-tile split.
 * Returns all valid alternative splits for the concatenated word.
 */
export function getAlternativeSplits(tiles: string[]): string[][] {
  const word = tiles.join("");
  return findAllSplits(word, 4);
}

// ─── Build a Puzzle from 5 seed words ────────────────────────────────────────

export function buildPuzzle(seedWords: string[]): Puzzle | { error: string } {
  if (seedWords.length !== 5) {
    return { error: "Exactly 5 seed words are required." };
  }

  const seedTiles: Tile[][] = [];

  for (let si = 0; si < seedWords.length; si++) {
    const word = seedWords[si].toLowerCase().replace(/[^a-z]/g, "");
    const split = autoSplitWord(word);
    if (!split) {
      return {
        error: `"${seedWords[si]}" cannot be split into 4 tiles of 2–4 letters. Word must be 8–16 letters long.`,
      };
    }
    const tiles: Tile[] = split.map((letters, ti) => ({
      id: `s${si}-t${ti}`,
      letters,
      seedIndex: si,
      tileIndex: ti,
    }));
    seedTiles.push(tiles);
  }

  // Flatten and shuffle all 20 tiles
  const allTiles = seedTiles.flat();
  const shuffled = shuffleArray([...allTiles]);

  return {
    tiles: shuffled,
    seedWords,
    seedTiles,
  };
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Puzzle validation ────────────────────────────────────────────────────────

export interface PuzzleValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePuzzle(puzzle: Puzzle): PuzzleValidationResult {
  const errors: string[] = [];

  // 1. Exactly 20 tiles
  if (puzzle.tiles.length !== 20) {
    errors.push(`Expected 20 tiles, found ${puzzle.tiles.length}.`);
  }

  // 2. All tiles are 2–4 letters
  for (const tile of puzzle.tiles) {
    if (tile.letters.length < 2 || tile.letters.length > 4) {
      errors.push(`Tile ${tile.id} has ${tile.letters.length} letters (must be 2–4).`);
    }
  }

  // 3. Exactly 5 seed groups of 4 tiles each
  if (puzzle.seedTiles.length !== 5) {
    errors.push(`Expected 5 seed groups, found ${puzzle.seedTiles.length}.`);
  } else {
    for (let si = 0; si < puzzle.seedTiles.length; si++) {
      if (puzzle.seedTiles[si].length !== 4) {
        errors.push(`Seed ${si} has ${puzzle.seedTiles[si].length} tiles (must be 4).`);
      }
    }
  }

  // 4. Structural quartile check — each of the 5 seeds must supply exactly 4 tiles.
  //    (Already enforced by check #3 above; this is a belt-and-suspenders guard.)
  //    The word-list check — that exactly 5 quartile words exist and no additional
  //    4-tile words are discoverable — requires a loaded word set and is performed
  //    in handleValidate() in app/create/page.tsx.

  return { valid: errors.length === 0, errors };
}

// ─── Word path finding ────────────────────────────────────────────────────────

/**
 * Given a set of selected tile IDs and the puzzle, check whether
 * the concatenated letters form a valid word.
 * Returns the word string and whether it's a quartile.
 */
export function evaluateSelection(
  selectedTileIds: string[],
  puzzle: Puzzle,
  wordSet: Set<string>
): { word: string; valid: boolean; isQuartile: boolean; points: number } {
  const tiles = selectedTileIds
    .map((id) => puzzle.tiles.find((t) => t.id === id))
    .filter(Boolean) as Tile[];

  if (tiles.length === 0) {
    return { word: "", valid: false, isQuartile: false, points: 0 };
  }

  // Tiles must be selected in the correct order — no permutation checking.
  // "NG" + "KI" stays "NGKI", not "KING". Players must tap tiles in the right order.
  const word = tiles.map((t) => t.letters).join("");

  if (!wordSet.has(word)) {
    return { word: "", valid: false, isQuartile: false, points: 0 };
  }

  // Check if this is a quartile (all 4 tiles from same seed, in selection order)
  let isQuartile = false;
  if (tiles.length === 4) {
    const seedIdx = tiles[0].seedIndex;
    const allSameSeed = tiles.every((t) => t.seedIndex === seedIdx);
    const allTilesUsed =
      puzzle.seedTiles[seedIdx]?.every((st) =>
        tiles.some((t) => t.id === st.id)
      ) ?? false;
    if (allSameSeed && allTilesUsed) {
      isQuartile = true;
    }
  }

  const points = scoreForTileCount(tiles.length);
  return { word, valid: true, isQuartile, points };
}

/**
 * Check whether a given selection of tile IDs spells a word in any tile order.
 * Returns the word string (using the best permutation found) or null.
 */
export function findWordFromTiles(
  tileIds: string[],
  puzzle: Puzzle,
  wordSet: Set<string>
): string | null {
  const { word, valid } = evaluateSelection(tileIds, puzzle, wordSet);
  return valid ? word : null;
}

/** Generate all permutations of an array */
function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

// ─── Duplicate path detection ─────────────────────────────────────────────────

/**
 * Given a puzzle and a word set, find all valid words (by brute-forcing
 * tile subsets). Used by the creator to surface issues.
 * Returns a map of word → list of tile-id arrays that produce it.
 */
export function findAllValidWords(
  puzzle: Puzzle,
  wordSet: Set<string>
): Map<string, string[][]> {
  const result = new Map<string, string[][]>();
  const tiles = puzzle.tiles;

  // Check subsets of size 1–4
  for (let size = 1; size <= 4; size++) {
    for (const subset of combinations(tiles, size)) {
      for (const perm of permutations(subset)) {
        const word = perm.map((t) => t.letters).join("");
        if (wordSet.has(word)) {
          const ids = perm.map((t) => t.id);
          const key = word;
          if (!result.has(key)) result.set(key, []);
          // Store only unique id combinations
          const existing = result.get(key)!;
          const sortedIds = [...ids].sort().join(",");
          if (!existing.some((e) => [...e].sort().join(",") === sortedIds)) {
            existing.push(ids);
          }
        }
      }
    }
  }

  return result;
}

/** Generate all combinations of size k from array */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// ─── URL encoding / decoding for shareable puzzles ───────────────────────────

export function encodePuzzle(puzzle: Puzzle): string {
  // Encode as: seedWords joined by comma, each seed's tiles by pipe
  // Format: s0t0|s0t1|s0t2|s0t3,s1t0|...
  const encoded = puzzle.seedTiles
    .map((group) => group.map((t) => t.letters).join("|"))
    .join(",");
  return encodeURIComponent(encoded);
}

export function decodePuzzle(param: string): Puzzle | null {
  try {
    const decoded = decodeURIComponent(param);
    const groups = decoded.split(",");
    if (groups.length !== 5) return null;

    const seedTiles: Tile[][] = [];
    const seedWords: string[] = [];

    for (let si = 0; si < groups.length; si++) {
      const tileParts = groups[si].split("|");
      if (tileParts.length !== 4) return null;
      if (tileParts.some((t) => t.length < 2 || t.length > 4 || !/^[a-z]+$/i.test(t)))
        return null;

      const tiles: Tile[] = tileParts.map((letters, ti) => ({
        id: `s${si}-t${ti}`,
        letters: letters.toLowerCase(),
        seedIndex: si,
        tileIndex: ti,
      }));
      seedTiles.push(tiles);
      seedWords.push(tileParts.map((t) => t.toLowerCase()).join(""));
    }

    const allTiles = seedTiles.flat();
    const shuffled = shuffleArray([...allTiles]);

    return { tiles: shuffled, seedWords, seedTiles };
  } catch {
    return null;
  }
}

// ─── Word set loader ──────────────────────────────────────────────────────────

let cachedWordSet: Set<string> | null = null;

export async function loadWordSet(): Promise<Set<string>> {
  if (cachedWordSet) return cachedWordSet;

  const res = await fetch("/dictionary.txt");
  if (!res.ok) throw new Error("Failed to load word list");
  const text = await res.text();
  const words = text.split("\n").filter((w) => w.length > 0);
  cachedWordSet = new Set(words.map((w) => w.toLowerCase()));
  return cachedWordSet;
}

// ─── Puzzle stats (total discoverable words + max score) ──────────────────────

/**
 * Finds all valid words discoverable from the puzzle tiles, then returns
 * the total word count and the maximum achievable score.
 * Called once after the word set loads; results are cached in component state.
 */
export function computePuzzleStats(
  puzzle: Puzzle,
  wordSet: Set<string>
): { totalWords: number; maxScore: number } {
  const allWords = findAllValidWords(puzzle, wordSet);
  let maxScore = 0;
  for (const [, paths] of allWords) {
    if (paths.length > 0) {
      maxScore += scoreForTileCount(paths[0].length);
    }
  }
  return { totalWords: allWords.size, maxScore };
}

// ─── Completion check ─────────────────────────────────────────────────────────

/**
 * Returns the set of seed indices whose quartile has been found.
 */
export function getFoundQuartiles(
  discoveredWords: ValidatedWord[],
  puzzle: Puzzle
): Set<number> {
  const found = new Set<number>();
  for (const dw of discoveredWords) {
    if (dw.isQuartile) {
      // Find which seed this corresponds to
      const tile = puzzle.tiles.find((t) => dw.tileIds.includes(t.id));
      if (tile) found.add(tile.seedIndex);
    }
  }
  return found;
}

export function isPuzzleComplete(
  discoveredWords: ValidatedWord[],
  puzzle: Puzzle
): boolean {
  return getFoundQuartiles(discoveredWords, puzzle).size === 5;
}

// ─── Share card generation ────────────────────────────────────────────────────

export function formatElapsedTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function generateShareCard(
  discoveredWords: ValidatedWord[],
  puzzle: Puzzle,
  score: number,
  puzzleUrl?: string,
  puzzleStats?: { totalWords: number; maxScore: number },
  elapsedSeconds?: number
): string {
  const quartileEmojis = ["🟩", "🟦", "🟨", "🟧", "🟥"];
  const foundQuartiles = getFoundQuartiles(discoveredWords, puzzle);

  const scoreStr = puzzleStats
    ? `Score: ${score}/${puzzleStats.maxScore} pts`
    : `Score: ${score} pts`;

  const lines: string[] = [
    "20TILE",
    scoreStr,
    "",
    foundQuartiles.size === 5 ? "🏆 All quartiles found!" : `${foundQuartiles.size}/5 quartiles`,
    "",
  ];

  // Emoji row for quartiles found
  const emojiRow = puzzle.seedTiles
    .map((_, si) => (foundQuartiles.has(si) ? quartileEmojis[si] : "⬛"))
    .join(" ");
  lines.push(emojiRow);
  lines.push("");

  const wordsStr = puzzleStats
    ? `${discoveredWords.length}/${puzzleStats.totalWords} words found`
    : `${discoveredWords.length} words found`;
  lines.push(wordsStr);

  if (elapsedSeconds != null) {
    lines.push(`⏱ ${formatElapsedTime(elapsedSeconds)}`);
  }

  lines.push(puzzleUrl ?? "20tile.app");

  return lines.join("\n");
}
