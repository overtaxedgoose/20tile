import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "20Tile — Quartile Puzzle Builder",
  description:
    "Build and share your own quartile word puzzles. Choose 5 seed words, split them into tiles, and challenge friends to find every hidden word.",
  keywords: [
    "quartile puzzle",
    "quartile puzzle builder",
    "word puzzle maker",
    "create word puzzle",
    "quartile game",
    "tile word game",
    "puzzle creator",
  ],
  openGraph: {
    title: "20Tile — Quartile Puzzle Builder",
    description:
      "Build and share your own quartile word puzzles. Choose 5 seed words, split them into tiles, and challenge friends.",
    url: "https://20tile.app",
    siteName: "20Tile",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "20Tile — Quartile Puzzle Builder",
    description:
      "Build and share your own quartile word puzzles. Choose 5 seed words, split them into tiles, and challenge friends.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-black text-green-400 font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
