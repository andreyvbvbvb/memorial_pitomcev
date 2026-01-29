import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Memorial</p>
        <h1 className="mt-4 text-4xl font-semibold text-slate-900">
          Сохраним память о любимых питомцах
        </h1>
        <p className="mt-4 text-base text-slate-600">
          Создавайте мемориалы, размещайте их на карте и принимайте подарки от других людей.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/create" className="rounded-full bg-slate-900 px-6 py-3 text-white">
            Создать мемориал
          </Link>
          <Link href="/map" className="rounded-full border border-slate-300 px-6 py-3 text-slate-800">
            Смотреть мемориалы
          </Link>
        </div>
      </div>
    </main>
  );
}
