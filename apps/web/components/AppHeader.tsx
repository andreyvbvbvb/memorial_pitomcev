"use client";

import Link from "next/link";
import { useMemo, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE } from "../lib/config";
import { canAccessAdmin, type AuthUser } from "../lib/access";
import AuthModal from "./AuthModal";

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
  const [createSpin, setCreateSpin] = useState({ key: 0, reverse: false });
  const headerRef = useRef<HTMLElement | null>(null);
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
    if (typeof window === "undefined") {
      return;
    }
    const updateHeaderHeight = () => {
      const height = headerRef.current?.getBoundingClientRect().height;
      if (height) {
        document.documentElement.style.setProperty(
          "--app-header-height",
          `${Math.round(height)}px`
        );
      }
    };
    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);
    return () => {
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, []);

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

  const pillClass =
    "group relative rounded-[14px] border border-white/80 bg-white/75 px-4 py-2 text-sm text-[#7c6b63] shadow-[0_10px_24px_-14px_rgba(93,64,55,0.65),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur transition hover:bg-[#d3a27f] hover:text-white";
  const iconPillClass =
    "group relative flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/80 bg-white/75 text-base text-[#7c6b63] shadow-[0_10px_24px_-14px_rgba(93,64,55,0.65),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur transition hover:bg-[#d3a27f] hover:text-white";
  const createButtonClass =
    "inline-flex h-10 items-center gap-1 rounded-[14px] bg-[#111827] px-3 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-[0_5px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_0_0_#000] active:translate-y-[4px] active:shadow-none";
  const authButtonClass =
    "rounded-[24px] border border-[#e7dbd3] bg-[#f6efea] px-5 py-2 text-sm font-semibold text-[#5d4037] shadow-[0_12px_24px_-16px_rgba(93,64,55,0.75),inset_0_1px_0_rgba(255,255,255,0.95)] transition hover:bg-[#fff7f2]";
  const menuPanelClass =
    `absolute right-0 mt-3 w-72 overflow-hidden rounded-[32px] border-[4px] border-white bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-200 origin-top-right ${
      menuVisible ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0"
    }`;
  const menuItemClass =
    "flex w-full items-center gap-4 rounded-2xl px-5 py-3.5 text-left text-[#5d4037] transition-all hover:bg-[#fdf2e9]";

  const triggerCreateSpin = (reverse: boolean) => {
    setCreateSpin((prev) => ({ key: prev.key + 1, reverse }));
  };

  const renderMenuIcon = (kind: "profile" | "about" | "charity" | "admin" | "logout") => {
    switch (kind) {
      case "profile":
        return (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="8" r="4" />
          </svg>
        );
      case "about":
        return (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5.5C4 4.12 5.12 3 6.5 3H19a2 2 0 0 1 2 2v13.5a2.5 2.5 0 0 0-2.5-2.5H6.5C5.12 16 4 14.88 4 13.5V5.5Z" />
            <path d="M6 7.5h9M6 10.5h9" />
          </svg>
        );
      case "charity":
        return (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6.7-4.35-9-8.28A5.35 5.35 0 0 1 12 6.2a5.35 5.35 0 0 1 9 6.52C18.7 16.65 12 21 12 21Z" />
          </svg>
        );
      case "admin":
        return (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3 7 4v5c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4Z" />
            <path d="m9.5 12 1.7 1.7L14.8 10" />
          </svg>
        );
      case "logout":
        return (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        );
    }
  };

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-40 bg-transparent"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="rounded-[24px] border border-white/80 bg-white/75 px-6 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-[#7c6b63] shadow-[0_12px_26px_-16px_rgba(93,64,55,0.75),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur transition hover:bg-white/90"
          >
            МяуГав
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/create"
                  className={createButtonClass}
                  aria-label="Создать мемориал"
                  onMouseEnter={() => triggerCreateSpin(false)}
                  onMouseLeave={() => triggerCreateSpin(true)}
                >
                  <span
                    key={createSpin.key}
                    className={`inline-flex text-sm leading-none ${
                      createSpin.reverse
                        ? "animate-[createPlusSpinReverse_0.45s_ease-in-out]"
                        : "animate-[createPlusSpin_0.45s_ease-in-out]"
                    }`}
                  >
                    +
                  </span>
                  <span>создать</span>
                </Link>
                <Link className={pillClass} href="/my-pets">
                  Мои питомцы
                </Link>
                <Link className={pillClass} href="/map">
                  Карта
                </Link>
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    className={`${iconPillClass}`}
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
                    <div className={menuPanelClass}>
                      <div className="p-6 pb-4">
                        <div className="mb-4 flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#adb5bd]">Аккаунт</span>
                            <span className="text-sm font-black text-[#5d4037]">{user.login ?? user.email}</span>
                          </div>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fdf2e9] text-[#d3a27f] transition-transform hover:scale-110"
                            onClick={() => {
                              closeMenu();
                              openTopUp();
                            }}
                            aria-label="Пополнить баланс"
                          >
                            <span className="text-base leading-none">+</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border-2 border-[#fdf2e9] bg-[#fcf8f5] p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm text-[#d3a27f]">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 7h12M6 12h12M6 17h12" />
                              </svg>
                            </div>
                            <span className="text-xs font-black uppercase text-[#8d6e63]">Баланс:</span>
                          </div>
                          <span className="text-lg font-black text-[#5d4037]">{user.coinBalance ?? 0}</span>
                        </div>
                      </div>
                      <div className="px-2 pb-2 text-sm text-slate-700">
                        <Link className={menuItemClass} href="/profile">
                          <span className="text-[#d3a27f]">{renderMenuIcon("profile")}</span>
                          <span className="text-xs font-black uppercase tracking-tight">Профиль</span>
                        </Link>
                        <Link className={menuItemClass} href="/about">
                          <span className="text-[#d3a27f]">{renderMenuIcon("about")}</span>
                          <span className="text-xs font-black uppercase tracking-tight">О проекте</span>
                        </Link>
                        <Link className={menuItemClass} href="/charity">
                          <span className="text-[#d3a27f]">{renderMenuIcon("charity")}</span>
                          <span className="text-xs font-black uppercase tracking-tight">Благотворительность</span>
                        </Link>
                        {canAccessAdmin(user.accessLevel) ? (
                          <Link className={menuItemClass} href="/admin/sql">
                            <span className="text-[#d3a27f]">{renderMenuIcon("admin")}</span>
                            <span className="text-xs font-black uppercase tracking-tight">Админ</span>
                          </Link>
                        ) : null}
                        <div className="mx-4 my-2 h-px bg-[#f8f9fa]" />
                        <button
                          type="button"
                          className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left text-[#ff4d4d] transition-all hover:bg-red-50"
                          onClick={handleLogout}
                        >
                          {renderMenuIcon("logout")}
                          <span className="text-xs font-black uppercase tracking-tight">Выйти</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <Link
                  className={pillClass}
                  href="/about"
                >
                  О проекте
                </Link>
                {pathname === "/auth" ? null : (
                  <button
                    type="button"
                    className={authButtonClass}
                    onClick={openAuth}
                  >
                    Войти
                  </button>
                )}
              </>
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
