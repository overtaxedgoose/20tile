import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "20Tile Jr — Create a Puzzle",
  description: "Build a kids word puzzle with 3-tile seed words.",
};

export default function JuniorCreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
