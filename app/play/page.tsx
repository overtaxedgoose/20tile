// Server Component — reads searchParams and passes the encoded puzzle string
// to the client PlayGame component. No Suspense/useSearchParams needed.
import PlayGame from "./PlayGame";

interface PageProps {
  searchParams: Promise<{ p?: string }>;
}

export default async function PlayPage({ searchParams }: PageProps) {
  const { p } = await searchParams;
  return <PlayGame encodedPuzzle={p ?? null} />;
}
