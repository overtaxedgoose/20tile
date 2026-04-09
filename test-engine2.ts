// Quick smoke-test for word-engine logic (runs via ts-node / tsx)
import {
  autoSplitWord,
  getAlternativeSplits,
  buildPuzzle,
  evaluateSelection,
  scoreForTileCount,
  encodePuzzle,
  decodePuzzle,
  findAllSplits,
} from "./lib/word-engine";

// We re-export the private fn for testing via a small wrapper at bottom

let pass = 0, fail = 0;
function assert(label: string, cond: boolean) {
  if (cond) { console.log(`  ✅ ${label}`); pass++; }
  else       { console.error(`  ❌ ${label}`); fail++; }
}

console.log("\n=== autoSplitWord ===");
const split1 = autoSplitWord("triangle");  // 8 letters
assert("triangle splits into 4", split1?.length === 4);
assert("triangle tiles all 2-4 chars", split1?.every(t => t.length >= 2 && t.length <= 4) ?? false);
assert("triangle tiles reassemble", split1?.join("") === "triangle");

const split2 = autoSplitWord("ab"); // too short
assert("'ab' returns null (too short)", split2 === null);

const split3 = autoSplitWord("abcdefghijklmnopq"); // too long (17)
assert("17-char word returns null", split3 === null);

const split4 = autoSplitWord("basketball"); // 10 letters
assert("basketball splits into 4", split4?.length === 4);
assert("basketball tiles reassemble", split4?.join("") === "basketball");

const split5 = autoSplitWord("strawberry"); // 10 letters
assert("strawberry splits", split5?.length === 4);

console.log("\n=== scoring ===");
assert("1 tile = 1pt", scoreForTileCount(1) === 1);
assert("2 tiles = 2pt", scoreForTileCount(2) === 2);
assert("3 tiles = 4pt", scoreForTileCount(3) === 4);
assert("4 tiles = 8pt", scoreForTileCount(4) === 8);

console.log("\n=== buildPuzzle ===");
const seeds = ["triangle", "basketball", "strawberry", "wonderful", "adventure"];
const puzzle = buildPuzzle(seeds);
if ("error" in puzzle) {
  console.error("  ❌ buildPuzzle errored:", puzzle.error); fail++;
} else {
  assert("puzzle has 20 tiles", puzzle.tiles.length === 20);
  assert("puzzle has 5 seed groups", puzzle.seedTiles.length === 5);
  assert("each seed has 4 tiles", puzzle.seedTiles.every(g => g.length === 4));
  assert("all tile IDs unique", new Set(puzzle.tiles.map(t=>t.id)).size === 20);
  assert("all letters 2-4", puzzle.tiles.every(t => t.letters.length >= 2 && t.letters.length <= 4));

  console.log("\n=== encodePuzzle / decodePuzzle ===");
  const encoded = encodePuzzle(puzzle);
  const decoded = decodePuzzle(encoded);
  assert("decode returns puzzle", decoded !== null);
  assert("decoded 20 tiles", decoded?.tiles.length === 20);
  assert("decoded seed words match", decoded?.seedWords.join(",") === puzzle.seedWords.join(","));
}

console.log("\n=== getAlternativeSplits ===");
const alts = getAlternativeSplits(["tri", "an", "gl", "es"]);
assert("alternatives array returned", Array.isArray(alts));
assert("alternatives reassemble correctly", alts.every(a => a.join("") === "triangles"));

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
