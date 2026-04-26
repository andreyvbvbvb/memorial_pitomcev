import CreateMemorialClient from "./CreateMemorialClient";

type CreatePageProps = {
  searchParams: Promise<{
    edit?: string | string[];
  }>;
};

export default async function CreateMemorialPage({ searchParams }: CreatePageProps) {
  const resolved = await searchParams;
  const rawEditId = resolved.edit;
  const editId = Array.isArray(rawEditId) ? rawEditId[0] : rawEditId;

  return <CreateMemorialClient editId={editId ?? null} />;
}
