export default function OfferPage() {
  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,0px))] bg-[#fcf8f5] px-6 py-10">
      <article className="mx-auto w-full max-w-3xl rounded-[34px] border-[4px] border-white bg-white/90 p-5 shadow-[0_24px_60px_-34px_rgba(93,64,55,0.55)] sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d3a27f]">
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
      </article>
    </main>
  );
}
