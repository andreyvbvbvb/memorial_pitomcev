import PetClient from "./PetClient";

export default async function PetPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  return <PetClient id={resolved.id} />;
}
