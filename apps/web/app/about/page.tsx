export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="grid gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">О проекте</p>
        <h1 className="text-3xl font-semibold text-slate-900">Memorial для питомцев</h1>
        <p className="text-slate-600">
          Мы создаём бережное пространство, где можно сохранить память о любимых питомцах,
          разместить мемориал на карте и принять тёплые знаки внимания от других людей.
        </p>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Личная история</h2>
          <p className="mt-2 text-sm text-slate-600">
            Добавляйте фотографии, эпитафию и историю жизни питомца — всё сохраняется в одном месте.
          </p>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Сообщество</h2>
          <p className="mt-2 text-sm text-slate-600">
            Делитесь мемориалами публично или оставляйте их приватными — вы решаете.
          </p>
        </div>
      </div>
    </main>
  );
}
