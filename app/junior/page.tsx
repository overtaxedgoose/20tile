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
              className="text-xs tracking-widest text-slate-600 hover:text-slate-900 transition-colors font-mono"
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
          <p className="mt-3 text-sm tracking-wide text-slate-700 font-mono">
            FIND WORDS · BUILD TILES · HAVE FUN
          </p>
        </div>

        <div className="border-t border-slate-300" />

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
            className="block w-full py-4 px-6 border-2 border-slate-300 text-center tracking-widest uppercase text-sm font-mono font-bold transition-all hover:bg-white rounded-xl text-slate-700 bg-white/80 shadow-sm"
          >
            [ CREATE A PUZZLE ]
          </Link>
        </div>

        <div className="border-t border-slate-300" />

        <p className="text-xs leading-relaxed text-slate-600">
          Junior puzzles use 3-tile seed words (instead of 4). Find all the words to complete
          a puzzle. Tiles are shorter and easier to combine!
        </p>

      </div>
    </main>
  );
}
