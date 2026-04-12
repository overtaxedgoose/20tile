import Link from "next/link";

export default function JuniorHome() {
  return (
    <main
      className="flex flex-1 flex-col items-center justify-center min-h-screen px-4 py-16 text-center"
      style={{ background: "#f0f9ff" }}
    >
      <div className="max-w-md w-full space-y-8">

        {/* Logo */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Link
              href="/"
              className="text-xs tracking-widest text-slate-400 hover:text-slate-600 transition-colors font-mono"
            >
              ← 20TILE
            </Link>
          </div>
          <h1 className="text-6xl font-bold tracking-widest" style={{ color: "#0369a1" }}>
            20TILE
          </h1>
          <div
            className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold tracking-widest font-mono"
            style={{ background: "#bae6fd", color: "#0369a1" }}
          >
            JUNIOR
          </div>
          <p className="mt-3 text-sm tracking-wide text-slate-500">
            FIND WORDS · BUILD TILES · HAVE FUN
          </p>
        </div>

        <div className="border-t border-slate-200" />

        {/* Two paths */}
        <div className="flex flex-col gap-4">
          <Link
            href="/junior/archive"
            className="block w-full py-4 px-6 border-2 border-sky-400 text-center tracking-widest uppercase text-sm font-mono font-bold transition-all hover:bg-sky-50 rounded-xl text-sky-700 bg-white shadow-sm"
          >
            [ PLAY A PUZZLE ]
          </Link>
          <Link
            href="/junior/create"
            className="block w-full py-4 px-6 border-2 border-slate-200 text-center tracking-widest uppercase text-sm font-mono transition-all hover:bg-white rounded-xl text-slate-500 bg-white/60 shadow-sm"
          >
            [ CREATE A PUZZLE ]
          </Link>
        </div>

        <div className="border-t border-slate-200" />

        <p className="text-xs leading-relaxed text-slate-400">
          Junior puzzles use 3-tile seed words (instead of 4). Find 15 words to complete
          a puzzle. Tiles are shorter and easier to combine!
        </p>

      </div>
    </main>
  );
}
