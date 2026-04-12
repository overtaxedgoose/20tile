import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create a Quartile Puzzle — 20Tile",
  description:
    "Build a custom quartile word puzzle in seconds. Enter 5 seed words, review the tile splits, then share a link with anyone. Free quartile puzzle maker — no account needed.",
  keywords: [
    "quartile puzzle builder",
    "make quartile puzzle",
    "custom quartile game",
    "quartile puzzle maker",
    "NYT quartile creator",
    "Apple quartile maker",
    "create word puzzle online",
    "word tile puzzle builder",
  ],
  alternates: {
    canonical: "https://20tile.app/create",
  },
  openGraph: {
    title: "Create a Quartile Puzzle — 20Tile",
    description:
      "Pick 5 words, split them into tiles, and share your custom quartile puzzle with anyone. Free and instant.",
    url: "https://20tile.app/create",
    siteName: "20Tile",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Create a Quartile Puzzle — 20Tile",
    description:
      "Pick 5 words, split them into tiles, and share your custom quartile puzzle with anyone. Free and instant.",
  },
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
