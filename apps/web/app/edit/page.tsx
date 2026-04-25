import PetClient from "../pets/[id]/PetClient";

type EditPageProps = {
  searchParams: Promise<{
    id?: string | string[];
  }>;
};

export default async function EditPage({ searchParams }: EditPageProps) {
  const resolved = await searchParams;
  const rawId = resolved.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Мемориал не выбран</h1>
          <p className="mt-3 text-slate-600">
            Для редактирования откройте страницу мемориала и перейдите по кнопке
            {" "}
            «Редактировать домик».
          </p>
        </div>
      </main>
    );
  }

  return <PetClient id={id} mode="edit" />;
}
