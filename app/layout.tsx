import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "20Tile — Word Puzzle Game",
  description: "Tap tiles. Build words. Find the quartiles.",
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
