"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE_NOTICE_STORAGE_KEY = "meowgav-cookie-notice-accepted";

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) !== "true");
    } catch {
      setVisible(true);
    }
  }, []);

  const acceptNotice = () => {
    try {
      localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, "true");
    } catch {
      // If localStorage is unavailable, hide the notice for the current session.
    }
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <section
      aria-label="Уведомление об использовании cookie"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[1300] mx-auto grid max-w-3xl gap-3 rounded-[24px] border-[3px] border-white bg-[#fffcf9]/95 p-4 text-[#6f6360] shadow-[0_22px_60px_-28px_rgba(93,64,55,0.6)] backdrop-blur-xl sm:inset-x-auto sm:right-5 sm:max-w-md"
    >
      <div className="grid gap-1.5">
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#5d4037]">
          Cookie
        </h2>
        <p className="text-xs font-semibold leading-relaxed">
          Мы используем только необходимые cookie для входа в аккаунт и
          защиты сессии. Аналитические и рекламные cookie сейчас не
          используются.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={acceptNotice}
          className="rounded-full bg-[#111827] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_3px_0_0_#000] transition hover:-translate-y-0.5"
        >
          Понятно
        </button>
        <Link
          href="/politics"
          className="rounded-full border border-[#eadfd9] bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#5d4037] transition hover:border-[#d3a27f]"
        >
          Политика
        </Link>
      </div>
    </section>
  );
}
