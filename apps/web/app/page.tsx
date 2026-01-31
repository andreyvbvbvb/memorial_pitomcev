import HomeHero from "../components/HomeHero";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-52 top-12 h-80 w-80 rounded-full bg-[radial-gradient(circle,#ffffff_0%,rgba(255,255,255,0)_70%)]" />
      <div className="pointer-events-none absolute -right-72 top-[-160px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,#d9ecff_0%,rgba(217,236,255,0)_70%)]" />
      <div className="pointer-events-none absolute bottom-[-260px] left-[30%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,#f7d9b8_0%,rgba(247,217,184,0)_70%)]" />

      <HomeHero />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-20 px-6 pb-20 pt-6 lg:pb-28">
        <section className="grid gap-6">
          <div className="grid gap-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
              Особенности
            </p>
            <h2 className="text-3xl font-semibold">Что можно делать в Memorial</h2>
          </div>
          <div className="grid gap-4 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Публично или приватно", text: "Мемориал виден только вам или всему миру." },
              { title: "Подарки", text: "Друзья могут оставить знак внимания." },
              { title: "3D‑оформление", text: "Соберите уютный домик и окружение." }
            ].map((item) => (
              <div key={item.title} className="card flex flex-col gap-2 px-5 py-5">
                <strong className="text-sm text-[var(--text)]">{item.title}</strong>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-8">
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
              Как это работает
            </p>
            <h2 className="text-3xl font-semibold">Пять шагов, чтобы создать мемориал</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              "Заполните данные питомца",
              "Выберите точку на карте",
              "Соберите 3D‑мемориал",
              "Добавьте фото и историю",
              "Проверьте и опубликуйте"
            ].map((label, index) => (
              <div key={label} className="card flex flex-col gap-3 p-5">
                <span className="text-xs font-semibold text-[var(--primary)]">0{index + 1}</span>
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
            <a href="/create" className="btn btn-primary">
              Начать сейчас
            </a>
            <a href="/map" className="btn btn-outline">
              Перейти к карте
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
