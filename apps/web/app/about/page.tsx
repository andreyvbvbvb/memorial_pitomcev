export default function AboutPage() {
  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,0px))] bg-[#fcf8f5] px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-900">Документы</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ниже представлены примеры пользовательского соглашения и публичной оферты.
        </p>

        <section id="agreement" className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Пользовательское соглашение</h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
            <p>
              Настоящее соглашение регулирует порядок использования сервиса Memorial и
              устанавливает правила взаимодействия Пользователя и Администрации.
            </p>
            <p>
              Регистрируясь, Пользователь подтверждает, что предоставляет достоверные данные,
              соблюдает нормы закона и принимает правила сервиса.
            </p>
            <p>
              Администрация предоставляет доступ к функционалу сервиса «как есть» и вправе
              обновлять условия, уведомляя Пользователя через сайт.
            </p>
          </div>
        </section>

        <section id="offer" className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Публичная оферта</h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
            <p>
              Настоящая оферта определяет условия оказания платных услуг сервиса Memorial.
            </p>
            <p>
              Оплачивая услуги, Пользователь соглашается с описанием тарифов, сроками и
              порядком предоставления доступа.
            </p>
            <p>
              Возврат средств и изменение условий предоставления услуг регулируются
              законодательством и дополнительными правилами сервиса.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
