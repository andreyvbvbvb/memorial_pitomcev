import Link from "next/link";
import HomeHero from "../components/HomeHero";

const steps = [
  {
    title: "Анкета питомца",
    text: "Имя, вид, даты, история и фотографии собираются в аккуратный профиль."
  },
  {
    title: "Место на карте",
    text: "Публичный мемориал можно разместить на общей карте памяти."
  },
  {
    title: "3D-пространство",
    text: "Домик, окружение, детали и цвета настраиваются в визуальном редакторе."
  },
  {
    title: "Подарки",
    text: "Близкие могут оставить свечу, цветы, игрушку или другой знак внимания."
  }
];

const features = [
  {
    title: "Личный архив",
    text: "Фотографии, эпитафия и история питомца хранятся в одном месте.",
    image: "/markers/cat_1.png"
  },
  {
    title: "Общая карта",
    text: "Мемориалы можно искать по карте и открывать в 3D-режиме.",
    image: "/markers/dog_1.png"
  },
  {
    title: "Живые знаки памяти",
    text: "Подарки отображаются в мемориале и помогают поддерживать страницу.",
    image: "/gifts_icons/candle_1.png"
  }
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden bg-[#fcf8f5] text-[#5d4037]">
      <HomeHero />

      <section className="relative border-y border-white/80 bg-[#f7f1ee] px-4 py-10 sm:px-6 lg:py-14">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="grid gap-3">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d3a27f]">
              Как это работает
            </p>
            <h2 className="max-w-md text-3xl font-black leading-tight text-[#5d4037] sm:text-4xl">
              Мемориал создаётся как спокойный пошаговый конструктор
            </h2>
            <p className="max-w-lg text-sm font-semibold leading-relaxed text-[#7b6b65]">
              Сначала вы заполняете данные, затем выбираете место, собираете 3D-сцену и
              публикуете страницу. В любой момент мемориал можно открыть, дополнить или
              оставить приватным.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-[28px] border-[3px] border-white bg-white/[0.82] p-5 shadow-[0_18px_42px_-28px_rgba(93,64,55,0.42)] backdrop-blur"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8d6e63]">
                    Шаг {index + 1}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111827] text-sm font-black text-white shadow-[0_3px_0_0_#000]">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-black text-[#5d4037]">{step.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-[#7b6b65]">
                  {step.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:py-16">
        <div className="mx-auto grid max-w-6xl gap-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="grid gap-2">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d3a27f]">
                Возможности
              </p>
              <h2 className="text-3xl font-black text-[#5d4037] sm:text-4xl">
                Всё важное рядом
              </h2>
            </div>
            <Link
              href="/map"
              className="inline-flex w-full items-center justify-center rounded-[18px] border-[3px] border-white bg-white px-6 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#5d4037] shadow-[0_16px_34px_-24px_rgba(93,64,55,0.55)] transition hover:bg-[#fff7f2] sm:w-auto"
            >
              Посмотреть карту
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="grid min-h-[15rem] content-between overflow-hidden rounded-[28px] border-[3px] border-white bg-white/[0.84] p-5 shadow-[0_18px_42px_-28px_rgba(93,64,55,0.42)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid gap-2">
                    <h3 className="text-lg font-black text-[#5d4037]">{feature.title}</h3>
                    <p className="text-sm font-semibold leading-relaxed text-[#7b6b65]">
                      {feature.text}
                    </p>
                  </div>
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[24px] bg-[#f7f1ee]">
                    <img
                      src={feature.image}
                      alt=""
                      className="h-20 w-20 object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="mt-8 h-2 rounded-full bg-[#f1e7e0]">
                  <div className="h-full w-2/3 rounded-full bg-[#3bceac]" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#111827] px-4 py-10 text-white sm:px-6 lg:py-12">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="grid gap-3">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#3bceac]">
              Начать
            </p>
            <h2 className="max-w-2xl text-3xl font-black leading-tight text-white sm:text-4xl">
              Создайте первый мемориал и сохраните историю питомца
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/create"
              className="inline-flex items-center justify-center rounded-[18px] bg-white px-7 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#111827] shadow-[0_5px_0_0_#d9d9d9] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_0_0_#d9d9d9] active:translate-y-[4px] active:shadow-none"
            >
              Создать мемориал
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center rounded-[18px] border-[2px] border-white/35 px-7 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/10"
            >
              О проекте
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
