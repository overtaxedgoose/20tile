import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen px-4 py-16 text-center">
      <div className="max-w-md w-full space-y-8">

        {/* Logo */}
        <div>
          <h1 className="text-6xl font-bold tracking-widest text-glow" style={{ color: "var(--green)" }}>
            20TILE
          </h1>
          <p className="mt-2 text-sm tracking-wider" style={{ color: "var(--green-muted)" }}>
            CHOOSE WORDS · SHIFT TILES · CREATE PUZZLES
          </p>
        </div>

        <div className="border-t" style={{ borderColor: "var(--border)" }} />

        {/* Two paths */}
        <div className="flex flex-col gap-4">
          <Link
            href="/create"
            className="block w-full py-4 px-6 border text-center tracking-widest uppercase text-sm font-mono font-bold transition-all hover:bg-green-950 hover:text-glow"
            style={{ borderColor: "var(--green)", color: "var(--green)" }}
          >
            [ CREATE PUZZLE ]
          </Link>
          <Link
            href="/archive"
            className="block w-full py-4 px-6 border text-center tracking-widest uppercase text-sm font-mono transition-all hover:bg-green-950"
            style={{ borderColor: "var(--border)", color: "var(--green-muted)" }}
          >
            [ PLAY ]
          </Link>
        </div>

      </div>
    </main>
  );
}
