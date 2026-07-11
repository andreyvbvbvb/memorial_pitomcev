"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import HomeCreateButton from "./HomeCreateButton";
import HomeHeroVideoLayer from "./HomeHeroVideoLayer";
import { useLanguage } from "./LanguageProvider";

export default function HomeHero() {
  const { t } = useLanguage();

  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-[calc(var(--app-header-height,64px)+2.5rem)] text-center sm:px-6 lg:min-h-[100dvh]">
      <div className="pointer-events-none absolute inset-0 z-0">
        <HomeHeroVideoLayer />
      </div>

      <div className="hero-stagger relative z-10 flex w-full max-w-[66rem] flex-col items-center gap-7">
        <p
          className="animate-fade-up max-w-5xl text-balance text-[clamp(1.32rem,4.8vw,2.8rem)] font-black leading-[1.12] text-[#5d4037] drop-shadow-[0_10px_24px_rgba(255,255,255,0.7)]"
          style={{ "--delay": "0.11s" } as CSSProperties}
        >
          {t("home.hero")}
        </p>
        <div
          className="animate-fade-up flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row"
          style={{ "--delay": "0.18s" } as CSSProperties}
        >
          <HomeCreateButton className="inline-flex items-center justify-center rounded-[18px] bg-[#111827] px-7 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[0_5px_0_0_#000] transition-[transform,box-shadow,background-color] duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_6px_0_0_#000] active:translate-y-[4px] active:scale-[0.96] active:shadow-none disabled:cursor-wait disabled:bg-[#111827]/80">
            {t("home.createMemorial")}
          </HomeCreateButton>
          <Link
            href="/map"
            className="inline-flex items-center justify-center rounded-[18px] border-[3px] border-white bg-white/[0.82] px-7 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#5d4037] shadow-[0_16px_34px_-24px_rgba(93,64,55,0.55)] backdrop-blur transition-[transform,box-shadow,background-color] duration-150 ease-out hover:-translate-y-[1px] hover:bg-white active:scale-[0.96]"
          >
            {t("home.openMap")}
          </Link>
        </div>
      </div>
    </section>
  );
}
