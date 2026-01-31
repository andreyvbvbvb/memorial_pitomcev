import Link from "next/link";
import type { CSSProperties } from "react";

export default function HomeHero() {
  return (
    <section className="relative flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-6 pb-20 pt-16 text-center">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px circle at 20% 0%, rgba(255,255,255,0.95) 0%, rgba(238,246,255,0) 60%), radial-gradient(900px circle at 80% 10%, rgba(197,224,255,0.7) 0%, rgba(238,246,255,0) 55%)"
        }}
      />
      <div className="hero-stagger flex max-w-2xl flex-col items-center gap-6">
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
