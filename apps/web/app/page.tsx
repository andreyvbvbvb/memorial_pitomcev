import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-40 top-16 h-96 w-96 rounded-full bg-[radial-gradient(circle,#ffffff_0%,rgba(255,255,255,0)_70%)]" />
      <div className="pointer-events-none absolute -right-52 top-[-120px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,#d9ecff_0%,rgba(217,236,255,0)_70%)]" />
      <div className="pointer-events-none absolute bottom-[-200px] left-[20%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,#f7d9b8_0%,rgba(247,217,184,0)_70%)]" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16 lg:py-24">
        <header className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6">
            <span className="chip">Memorial</span>
            <h1 className="text-4xl font-semibold lg:text-5xl">
              Сохраняйте тёплую память о ваших питомцах
            </h1>
            <p className="text-lg text-[var(--muted)]">
              Создавайте персональные мемориалы, размещайте их на карте и принимайте заботливые подарки от
              других людей.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/create" className="btn btn-primary">
                Создать мемориал
              </Link>
              <Link href="/map" className="btn btn-outline">
                Смотреть мемориалы
              </Link>
            </div>
            <div className="grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-3">
              <div className="card flex flex-col gap-1 px-4 py-3">
                <strong className="text-base text-[var(--text)]">Публично или приватно</strong>
                Мемориал виден только вам или всему миру.
              </div>
              <div className="card flex flex-col gap-1 px-4 py-3">
                <strong className="text-base text-[var(--text)]">Подарки</strong>
                Друзья могут оставить знак внимания.
              </div>
              <div className="card flex flex-col gap-1 px-4 py-3">
                <strong className="text-base text-[var(--text)]">3D‑оформление</strong>
                Соберите уютный домик и окружение.
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="card overflow-hidden">
              <div className="h-40 bg-gradient-to-br from-[#dff0ff] via-white to-[#fef3df]" />
              <div className="grid gap-3 p-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-[rgba(58,124,165,0.15)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">Мемориал питомца</p>
                    <p className="text-xs text-[var(--muted)]">Луг • Будка • Подарки</p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-[var(--muted)]">
                  <p>Эпитафия и история жизни</p>
                  <p>Фотоальбом и карта</p>
                </div>
              </div>
            </div>
            <div className="card grid gap-4 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text)]">Карта мемориалов</p>
                <span className="text-xs text-[var(--muted)]">Живые истории</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-16 rounded-2xl bg-[rgba(58,124,165,0.12)]" />
                <div className="h-16 rounded-2xl bg-[rgba(116,198,157,0.18)]" />
                <div className="h-16 rounded-2xl bg-[rgba(242,184,128,0.25)]" />
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-8">
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
              Как это работает
            </p>
            <h2 className="text-3xl font-semibold">Пять шагов, чтобы создать мемориал</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            {[
              "Заполните данные питомца",
              "Выберите точку на карте",
              "Соберите 3D‑мемориал",
              "Добавьте фото и историю",
              "Проверьте и опубликуйте"
            ].map((label, index) => (
              <div key={label} className="card flex flex-col gap-3 p-5">
                <span className="text-xs font-semibold text-[var(--primary)]">
                  0{index + 1}
                </span>
                <p className="text-sm text-[var(--text)]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card grid gap-4 px-6 py-8 lg:grid-cols-[1.4fr_0.6fr] lg:items-center">
          <div className="grid gap-3">
            <h2 className="text-2xl font-semibold">Готовы создать первый мемориал?</h2>
            <p className="text-sm text-[var(--muted)]">
              Это займёт всего несколько минут — и память о вашем любимце будет сохранена.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/create" className="btn btn-primary">
              Начать сейчас
            </Link>
            <Link href="/map" className="btn btn-outline">
              Перейти к карте
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
