/**
 * 20Tile Junior Word Engine
 * 3-tile variant: seeds are 6–10 letters split into 3 tiles (2–4 letters each).
 * Scoring: 1pt / 2pt / 3pt for 1 / 2 / 3 tiles.
 * Completion: triggered when 15 words have been discovered.
 */

// ─── Imports & re-exports ─────────────────────────────────────────────────────

import { shuffleArray, formatElapsedTime } from "./word-engine";
import type { Tile, ValidatedWord } from "./word-engine";

export type { Tile, ValidatedWord };
export { shuffleArray, formatElapsedTime };

// ─── Junior-specific Puzzle type ──────────────────────────────────────────────

export interface JuniorPuzzle {
  tiles: Tile[];        // All 15 tiles (shuffled for gameplay)
  seedWords: string[];  // The 5 original seed words
  seedTiles: Tile[][];  // [5][3] tile groups per seed
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const JUNIOR_TILES_PER_SEED = 3;
export const JUNIOR_MIN_SEED_LENGTH = 6;
export const JUNIOR_MAX_SEED_LENGTH = 10;
export const JUNIOR_WORD_GOAL = 15;

// ─── Scoring ──────────────────────────────────────────────────────────────────

export function juniorScoreForTileCount(count: number): number {
  switch (count) {
    case 1: return 1;
    case 2: return 2;
    case 3: return 3;
    default: return 0;
  }
}

// ─── Split a word into exactly 3 tiles (2–4 letters each) ────────────────────

export function autoSplitWord3(word: string): string[] | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  const len = w.length;

  if (len < JUNIOR_MIN_SEED_LENGTH || len > JUNIOR_MAX_SEED_LENGTH) return null;

  const splits = findAllSplits3(w);
  if (splits.length === 0) return null;

  return pickBalancedSplit(splits);
}

/** Find all ways to split `word` into exactly 3 pieces of 2–4 letters each */
function findAllSplits3(word: string): string[][] {
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

  recurse(0, 3, []);
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

// ─── Alternative splits (for boundary shifting in create mode) ────────────────

export function getAlternativeSplits3(tiles: string[]): string[][] {
  const word = tiles.join("");
  return findAllSplits3(word);
}

// ─── Build a JuniorPuzzle from 5 seed words ───────────────────────────────────

export function buildJuniorPuzzle(seedWords: string[]): JuniorPuzzle | { error: string } {
  if (seedWords.length !== 5) {
    return { error: "Exactly 5 seed words are required." };
  }

  const seedTiles: Tile[][] = [];

  for (let si = 0; si < seedWords.length; si++) {
    const word = seedWords[si].toLowerCase().replace(/[^a-z]/g, "");
    const split = autoSplitWord3(word);
    if (!split) {
      return {
        error: `"${seedWords[si]}" can't be split into 3 tiles. Try a word with 6–10 letters.`,
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

  const allTiles = seedTiles.flat();
  const shuffled = shuffleArray([...allTiles]);

  return { tiles: shuffled, seedWords, seedTiles };
}

// ─── Word path finding ────────────────────────────────────────────────────────

export function evaluateJuniorSelection(
  selectedTileIds: string[],
  puzzle: JuniorPuzzle,
  wordSet: Set<string>
): { word: string; valid: boolean; is3Tile: boolean; points: number } {
  const tiles = selectedTileIds
    .map((id) => puzzle.tiles.find((t) => t.id === id))
    .filter(Boolean) as Tile[];

  if (tiles.length === 0) {
    return { word: "", valid: false, is3Tile: false, points: 0 };
  }

  const perms = permutations(tiles);
  let bestWord = "";
  let bestIs3Tile = false;

  for (const perm of perms) {
    const word = perm.map((t) => t.letters).join("");
    if (wordSet.has(word)) {
      bestWord = word;
      // Check if this is a 3tile: all 3 tiles from the same seed in any order
      if (perm.length === 3) {
        const seedIdx = perm[0].seedIndex;
        const allSameSeed = perm.every((t) => t.seedIndex === seedIdx);
        const allTilesUsed =
          puzzle.seedTiles[seedIdx]?.every((st) =>
            perm.some((t) => t.id === st.id)
          ) ?? false;
        if (allSameSeed && allTilesUsed) {
          bestIs3Tile = true;
          break;
        }
      }
    }
  }

  const valid = bestWord.length > 0;
  const points = valid ? juniorScoreForTileCount(tiles.length) : 0;

  return { word: bestWord, valid, is3Tile: bestIs3Tile, points };
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

// ─── All valid words (brute-force, used by creator validation) ────────────────

export function findAllValidJuniorWords(
  puzzle: JuniorPuzzle,
  wordSet: Set<string>
): Map<string, string[][]> {
  const result = new Map<string, string[][]>();
  const tiles = puzzle.tiles;

  for (let size = 1; size <= 3; size++) {
    for (const subset of combinations(tiles, size)) {
      for (const perm of permutations(subset)) {
        const word = perm.map((t) => t.letters).join("");
        if (wordSet.has(word)) {
          const ids = perm.map((t) => t.id);
          if (!result.has(word)) result.set(word, []);
          const existing = result.get(word)!;
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

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// ─── Puzzle stats ─────────────────────────────────────────────────────────────

export function computeJuniorPuzzleStats(
  puzzle: JuniorPuzzle,
  wordSet: Set<string>
): { totalWords: number; maxScore: number } {
  const allWords = findAllValidJuniorWords(puzzle, wordSet);
  let maxScore = 0;
  for (const [, paths] of allWords) {
    if (paths.length > 0) {
      maxScore += juniorScoreForTileCount(paths[0].length);
    }
  }
  return { totalWords: allWords.size, maxScore };
}

// ─── Completion check ─────────────────────────────────────────────────────────

export function getFound3Tiles(
  discoveredWords: ValidatedWord[],
  puzzle: JuniorPuzzle
): Set<number> {
  const found = new Set<number>();
  for (const dw of discoveredWords) {
    if (dw.isQuartile) { // isQuartile field reused for is3Tile
      const tile = puzzle.tiles.find((t) => dw.tileIds.includes(t.id));
      if (tile) found.add(tile.seedIndex);
    }
  }
  return found;
}

/** Junior puzzle is "complete" when 15 words have been discovered */
export function isJuniorComplete(discoveredWords: ValidatedWord[]): boolean {
  return discoveredWords.length >= JUNIOR_WORD_GOAL;
}

// ─── URL encoding / decoding ──────────────────────────────────────────────────

export function encodeJuniorPuzzle(puzzle: JuniorPuzzle): string {
  const encoded = puzzle.seedTiles
    .map((group) => group.map((t) => t.letters).join("|"))
    .join(",");
  return encodeURIComponent(encoded);
}

export function decodeJuniorPuzzle(param: string): JuniorPuzzle | null {
  try {
    const decoded = decodeURIComponent(param);
    const groups = decoded.split(",");
    if (groups.length !== 5) return null;

    const seedTiles: Tile[][] = [];
    const seedWords: string[] = [];

    for (let si = 0; si < groups.length; si++) {
      const tileParts = groups[si].split("|");
      if (tileParts.length !== 3) return null;
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

// ─── Kids word set loader ─────────────────────────────────────────────────────

let cachedKidsWordSet: Set<string> | null = null;

export async function loadKidsWordSet(): Promise<Set<string>> {
  if (cachedKidsWordSet) return cachedKidsWordSet;

  const res = await fetch("/kids_dictionary.txt");
  if (!res.ok) throw new Error("Failed to load kids word list");
  const text = await res.text();
  const words = text.split("\n").filter((w) => w.length > 0);
  cachedKidsWordSet = new Set(words.map((w) => w.toLowerCase()));
  return cachedKidsWordSet;
}

// (formatElapsedTime re-exported at top of file)
