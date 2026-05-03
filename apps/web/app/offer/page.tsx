import Link from "next/link";

export default function OfferPage() {
  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,0px))] bg-[#fcf8f5] px-6 py-10">
      <article className="mx-auto w-full max-w-3xl rounded-[34px] border-[4px] border-white bg-white/90 p-5 shadow-[0_24px_60px_-34px_rgba(93,64,55,0.55)] sm:p-8">
        <Link
          href="/about"
          className="inline-flex items-center justify-center rounded-[16px] border-[3px] border-white bg-[#f7f1ee] px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#5d4037] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] transition hover:-translate-y-0.5 hover:bg-white"
        >
          Назад к проекту
        </Link>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-[#d3a27f]">
          Документ
        </p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-[#5d4037]">
          Публичная оферта
        </h1>
        <div className="mt-6 space-y-4 text-base font-semibold leading-relaxed text-[#6f6360]">
          <p>Настоящая оферта определяет условия оказания платных услуг сервиса Memorial.</p>
          <p>
            Оплачивая услуги, Пользователь соглашается с описанием тарифов, сроками и
            порядком предоставления доступа.
          </p>
          <p>
            Возврат средств и изменение условий предоставления услуг регулируются
            законодательством и дополнительными правилами сервиса.
          </p>
        </div>
        <Link
          href="/about"
          className="mt-7 inline-flex items-center justify-center rounded-[18px] bg-[#111827] px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_4px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_5px_0_0_#000] active:translate-y-[3px] active:shadow-none"
        >
          Вернуться на /about
        </Link>
      </article>
    </main>
  );
}
