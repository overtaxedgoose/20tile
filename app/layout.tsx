import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "20Tile — Quartile Puzzle Builder",
  description:
    "Build and share custom quartile word puzzles for free. Pick 5 words, split them into tiles, and challenge friends to solve them — like NYT Quartile or Apple Quartile, but made by you.",
  keywords: [
    "quartile puzzle builder",
    "custom quartile game",
    "NYT quartile",
    "Apple quartile",
    "make your own quartile puzzle",
    "quartile puzzle maker",
    "quartile word game",
    "word puzzle maker",
    "create word puzzle",
    "tile word game",
    "share word puzzle",
    "puzzle creator",
  ],
  metadataBase: new URL("https://20tile.app"),
  alternates: {
    canonical: "https://20tile.app",
  },
  openGraph: {
    title: "20Tile — Build Your Own Quartile Puzzle",
    description:
      "Make a custom quartile word puzzle in seconds and share it with friends. Free, no account needed.",
    url: "https://20tile.app",
    siteName: "20Tile",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "20Tile — Build Your Own Quartile Puzzle",
    description:
      "Make a custom quartile word puzzle in seconds and share it with friends. Free, no account needed.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "20Tile",
  url: "https://20tile.app",
  description:
    "A free quartile puzzle builder. Pick 5 seed words, split them into tiles, and share a custom word puzzle with anyone.",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-black text-green-400 font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
