// Server Component — renders a junior puzzle from a ?p= encoded URL param.
import { redirect } from "next/navigation";
import PlayGameJunior from "./PlayGameJunior";

interface PageProps {
  searchParams: Promise<{ p?: string }>;
}

export default async function JuniorPlayPage({ searchParams }: PageProps) {
  const { p } = await searchParams;

  if (!p) {
    redirect("/junior/archive");
  }

  return <PlayGameJunior encodedPuzzle={p} />;
}
