import Link from "next/link";
import type { CSSProperties } from "react";
import HomeHeroBackground from "./HomeHeroBackground";

export default function HomeHero() {
  return (
    <section className="relative flex min-h-[calc(100vh-80px)] flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-16 text-center">
      <div className="pointer-events-none absolute inset-0 z-0">
        <HomeHeroBackground />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(251,247,245,0.65) 0%, rgba(251,247,245,0.5) 45%, rgba(255,255,255,0.82) 100%)"
          }}
        />
      </div>

      <div className="hero-stagger relative z-10 flex max-w-2xl flex-col items-center gap-6">
        <h1
          className="text-4xl font-semibold leading-tight lg:text-5xl lg:leading-tight animate-fade-up"
          style={{ "--delay": "0.05s" } as CSSProperties}
        >
          Сохраняйте тёплую память о ваших питомцах
        </h1>
        <div
          className="flex flex-wrap justify-center gap-4 animate-fade-up"
          style={{ "--delay": "0.18s" } as CSSProperties}
        >
          <Link href="/create" className="btn btn-primary">
            Создать мемориал
          </Link>
          <Link href="/map" className="btn btn-outline">
            Смотреть мемориалы
          </Link>
        </div>
      </div>
    </section>
  );
}
