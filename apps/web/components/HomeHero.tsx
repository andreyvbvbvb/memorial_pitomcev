import Link from "next/link";
import type { CSSProperties } from "react";
import HomeHeroBackground from "./HomeHeroBackground";

export default function HomeHero() {
  return (
    <section className="relative flex min-h-[calc(100dvh_-_var(--app-header-height,64px)_-_4rem)] flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-10 text-center sm:px-6 lg:min-h-[calc(100dvh_-_var(--app-header-height,64px)_-_5rem)]">
      <div className="pointer-events-none absolute inset-0 z-0">
        <HomeHeroBackground />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 48%, rgba(252,248,245,0.96) 0%, rgba(252,248,245,0.78) 30%, rgba(252,248,245,0.2) 58%, rgba(252,248,245,0) 74%), linear-gradient(180deg, rgba(252,248,245,0.78) 0%, rgba(252,248,245,0.46) 42%, rgba(252,248,245,0.9) 100%)"
          }}
        />
      </div>

      <div className="hero-stagger relative z-10 flex w-full max-w-[46rem] flex-col items-center gap-5">
        <div
          className="animate-fade-up rounded-full border border-white/80 bg-white/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#8d6e63] shadow-[0_12px_26px_-18px_rgba(93,64,55,0.5)] backdrop-blur"
          style={{ "--delay": "0.02s" } as CSSProperties}
        >
          3D-мемориалы для питомцев
        </div>
        <h1
          className="animate-fade-up text-[clamp(3.4rem,11vw,7.25rem)] font-black uppercase leading-[0.9] tracking-normal text-[#5d4037] drop-shadow-[0_10px_24px_rgba(255,255,255,0.55)]"
          style={{ "--delay": "0.05s" } as CSSProperties}
        >
          МяуГав
        </h1>
        <p
          className="animate-fade-up max-w-2xl text-base font-semibold leading-relaxed text-[#6f6360] sm:text-lg"
          style={{ "--delay": "0.11s" } as CSSProperties}
        >
          Создавайте тёплые 3D-мемориалы, сохраняйте фотографии и истории, отмечайте
          любимцев на общей карте памяти.
        </p>
        <div
          className="animate-fade-up flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row"
          style={{ "--delay": "0.18s" } as CSSProperties}
        >
          <Link
            href="/create"
            className="inline-flex items-center justify-center rounded-[18px] bg-[#111827] px-7 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[0_5px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_0_0_#000] active:translate-y-[4px] active:shadow-none"
          >
            Создать мемориал
          </Link>
          <Link
            href="/map"
            className="inline-flex items-center justify-center rounded-[18px] border-[3px] border-white bg-white/[0.82] px-7 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#5d4037] shadow-[0_16px_34px_-24px_rgba(93,64,55,0.55)] backdrop-blur transition hover:bg-white"
          >
            Открыть карту
          </Link>
        </div>
      </div>
    </section>
  );
}
