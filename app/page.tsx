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
            TAP TILES · BUILD WORDS · FIND QUARTILES
          </p>
        </div>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: "var(--border)" }} />

        {/* Nav */}
        <div className="flex flex-col gap-4">
          <Link
            href="/create"
            className="block w-full py-4 px-6 border text-center tracking-widest uppercase text-sm transition-all hover:bg-green-950 hover:text-glow"
            style={{ borderColor: "var(--green)", color: "var(--green)" }}
          >
            [ CREATE PUZZLE ]
          </Link>
          <p className="text-xs" style={{ color: "var(--green-muted)" }}>
            Share a puzzle link to play
          </p>
        </div>

        {/* Footer */}
        <div className="text-xs pt-8" style={{ color: "var(--green-dark)" }}>
          MVP — Phase 1
        </div>
      </div>
    </main>
  );
}
