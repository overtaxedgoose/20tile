import Link from "next/link";

export default function PuzzleNotFound() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 text-center">
      <div className="space-y-2">
        <p className="text-4xl font-bold font-mono text-glow" style={{ color: "var(--green)" }}>
          404
        </p>
        <p className="text-sm font-mono tracking-widest" style={{ color: "var(--green-muted)" }}>
          PUZZLE NOT FOUND
        </p>
        <p className="text-xs max-w-xs" style={{ color: "var(--green-dark)" }}>
          This puzzle number doesn&apos;t exist or has been hidden.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/archive"
          className="block w-full py-3 border text-xs font-mono tracking-widest uppercase rounded text-center transition-all hover:bg-green-950"
          style={{ borderColor: "var(--green)", color: "var(--green)" }}
        >
          ← PUZZLE ARCHIVE
        </Link>
        <Link
          href="/create"
          className="block w-full py-3 border text-xs font-mono tracking-widest uppercase rounded text-center transition-all hover:bg-green-950"
          style={{ borderColor: "var(--border)", color: "var(--green-muted)" }}
        >
          CREATE A PUZZLE
        </Link>
      </div>
    </main>
  );
}
