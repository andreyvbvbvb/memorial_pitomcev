"use client";

import Link from "next/link";
import { useMemo, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE } from "../lib/config";
import AuthModal from "./AuthModal";

type AuthUser = {
  id: string;
  login?: string | null;
  email: string;
  coinBalance?: number;
};

export default function AppHeader() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpVisible, setTopUpVisible] = useState(false);
  const [topUpCurrency, setTopUpCurrency] = useState<"RUB" | "USD">("RUB");
  const [topUpPlan, setTopUpPlan] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();
  const pathname = usePathname();

  const fetchMe = async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = (await response.json()) as AuthUser;
      setUser(data);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    fetchMe();
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) {
        return;
      }
      closeMenu();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const openMenu = () => {
    setMenuOpen(true);
    requestAnimationFrame(() => setMenuVisible(true));
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setTimeout(() => setMenuOpen(false), 160);
  };

  const openAuth = () => {
    setAuthOpen(true);
    requestAnimationFrame(() => setAuthVisible(true));
  };

  const closeAuth = () => {
    setAuthVisible(false);
    setTimeout(() => setAuthOpen(false), 200);
  };

  const openTopUp = () => {
    setTopUpOpen(true);
    requestAnimationFrame(() => setTopUpVisible(true));
  };

  const closeTopUp = () => {
    setTopUpVisible(false);
    setTimeout(() => setTopUpOpen(false), 180);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${apiUrl}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
      setMenuVisible(false);
      setMenuOpen(false);
      router.push("/");
    }
  };

  const topUpOptions = [
    { coins: 100, rub: 100, usd: 1 },
    { coins: 200, rub: 200, usd: 2 },
    { coins: 500, rub: 500, usd: 500 },
    { coins: 1000, rub: 1000, usd: 10 }
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[rgba(215,230,242,0.6)] bg-white/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2">
          <Link href="/" className="chip">
            Memorial
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/create"
                  className="group relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base text-slate-700 transition hover:bg-slate-50"
                  aria-label="Создать мемориал"
                >
                  <span className="absolute inset-0 rounded-full bg-slate-900/10 opacity-0 transition group-hover:opacity-70 group-hover:animate-ping" />
                  <span className="relative z-10">+</span>
                  <span className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100">
                    Создать мемориал
                  </span>
                </Link>
                <Link className="btn btn-ghost !px-3 !py-2 text-sm" href="/my-pets">
                  Мои питомцы
                </Link>
                <Link className="btn btn-ghost !px-3 !py-2 text-sm" href="/map">
                  Карта
                </Link>
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    className="btn btn-ghost !px-3 !py-2 text-sm"
                    aria-label="Открыть меню"
                    onClick={() => (menuOpen ? closeMenu() : openMenu())}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none">
                      <path
                        d="M4 5.5C4 4.12 5.12 3 6.5 3H19a2 2 0 0 1 2 2v13.5a2.5 2.5 0 0 0-2.5-2.5H6.5C5.12 16 4 14.88 4 13.5V5.5Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M6 7.5h9M6 10.5h9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  {menuOpen ? (
                    <div
                      className={`absolute right-0 mt-3 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl transition-all duration-150 ${
                        menuVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
                      }`}
                    >
                    <div className="px-3 pb-1 text-xs text-slate-500">
                      {user.login ?? user.email}
                    </div>
                    <div className="flex items-center justify-between px-3 pb-2 text-xs text-slate-500">
                      <span>
                        Баланс:{" "}
                        <strong className="text-slate-700">{user.coinBalance ?? 0}</strong>
                      </span>
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-sm text-slate-700"
                        onClick={() => {
                          closeMenu();
                          openTopUp();
                        }}
                        aria-label="Пополнить баланс"
                      >
                        +
                      </button>
                    </div>
                      <div className="grid gap-1 text-sm text-slate-700">
                        <Link className="rounded-xl px-3 py-2 hover:bg-slate-100" href="/profile">
                          Профиль
                        </Link>
                        <Link className="rounded-xl px-3 py-2 hover:bg-slate-100" href="/about">
                          О проекте
                        </Link>
                        <button
                          type="button"
                          className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          onClick={handleLogout}
                        >
                          Выйти
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <button type="button" className="btn btn-outline !px-4 !py-2 text-sm" onClick={openAuth}>
                Войти
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        open={authOpen}
        visible={authVisible}
        onClose={closeAuth}
        onSuccess={(payload) => {
          setUser(payload);
          closeAuth();
        }}
      />

      {topUpOpen ? (
        <div
          className={`fixed inset-0 z-[999] flex items-center justify-center px-4 transition-opacity duration-200 ${
            topUpVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={closeTopUp}
          />
          <div
            className={`relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-transform duration-200 ${
              topUpVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Пополнение баланса</h3>
              <button type="button" className="btn btn-ghost px-3 py-2" onClick={closeTopUp}>
                Закрыть
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Баланс: {user?.coinBalance ?? 0} монет
            </p>
            <div className="mt-4 flex gap-2 rounded-full bg-slate-100 p-1">
              {(["RUB", "USD"] as const).map((currency) => {
                const isActive = topUpCurrency === currency;
                return (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => setTopUpCurrency(currency)}
                    className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold ${
                      isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {currency}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid gap-2">
              {topUpOptions.map((option) => {
                const isSelected = topUpPlan === option.coins;
                const price = topUpCurrency === "RUB" ? `${option.rub} ₽` : `${option.usd} USD`;
                return (
                  <button
                    key={option.coins}
                    type="button"
                    onClick={() => setTopUpPlan(option.coins)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                      isSelected
                        ? "border-sky-400 bg-sky-50 text-slate-900"
                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-semibold">{option.coins} монет</span>
                    <span className="text-slate-500">{price}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              onClick={() => {
                if (!topUpPlan) {
                  return;
                }
                router.push(`/payment?coins=${topUpPlan}&currency=${topUpCurrency}`);
                closeTopUp();
              }}
              disabled={!topUpPlan}
            >
              Продолжить
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
