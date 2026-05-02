import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,0px))] bg-[#fcf8f5] px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d3a27f]">
          О проекте
        </p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-[#5d4037] sm:text-4xl">
          МяуГав хранит память о питомцах в теплых 3D-мемориалах.
        </h1>
        <p className="mt-4 text-base font-semibold leading-relaxed text-[#7b6a63]">
          Здесь можно создать страницу любимца, добавить фотографии и историю, отметить
          мемориал на карте памяти и вернуться к нему в любой момент.
        </p>

        <section className="mt-8 rounded-[30px] border-[4px] border-white bg-white/90 p-5 shadow-[0_24px_60px_-34px_rgba(93,64,55,0.55)] sm:p-6">
          <h2 className="text-xl font-black text-[#5d4037]">Документы сервиса</h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-[#7b6a63]">
            Юридические документы вынесены на отдельные страницы, чтобы страница о проекте
            оставалась короткой и понятной.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/terms"
              className="rounded-[22px] border-[3px] border-white bg-[#f7f1ee] px-5 py-4 font-black uppercase tracking-[0.14em] text-[#5d4037] shadow-[inset_0_2px_6px_rgba(93,64,55,0.06)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              Пользовательское соглашение
            </Link>
            <Link
              href="/offer"
              className="rounded-[22px] border-[3px] border-white bg-[#f7f1ee] px-5 py-4 font-black uppercase tracking-[0.14em] text-[#5d4037] shadow-[inset_0_2px_6px_rgba(93,64,55,0.06)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              Публичная оферта
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
