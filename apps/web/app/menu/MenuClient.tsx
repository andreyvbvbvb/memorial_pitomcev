"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/config";
import { canAccessAdmin, type AuthUser } from "../../lib/access";
import AuthModal from "../../components/AuthModal";
import ErrorToast from "../../components/ErrorToast";

type MenuIconKind =
  | "login"
  | "profile"
  | "pets"
  | "map"
  | "about"
  | "charity"
  | "news"
  | "admin"
  | "logout";

function MenuIcon({ kind }: { kind: MenuIconKind }) {
  const common = "h-5 w-5";
  switch (kind) {
    case "login":
    case "profile":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>
      );
    case "pets":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11.5c0-3.6 2.9-6.5 6.5-6.5H12c4.4 0 8 3.6 8 8v3.5A2.5 2.5 0 0 1 17.5 19h-9A4.5 4.5 0 0 1 4 14.5v-3Z" />
          <path d="M8 10h.01M15 10h.01" />
          <path d="M10 14c.7.5 1.3.5 2 0" />
        </svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
          <path d="M9 3v15M15 6v15" />
        </svg>
      );
    case "about":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5.5C4 4.12 5.12 3 6.5 3H19a2 2 0 0 1 2 2v13.5a2.5 2.5 0 0 0-2.5-2.5H6.5C5.12 16 4 14.88 4 13.5V5.5Z" />
          <path d="M6 7.5h9M6 10.5h9" />
        </svg>
      );
    case "charity":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-6.7-4.35-9-8.28A5.35 5.35 0 0 1 12 6.2a5.35 5.35 0 0 1 9 6.52C18.7 16.65 12 21 12 21Z" />
        </svg>
      );
    case "news":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4h14a1 1 0 0 1 1 1v14l-3-2-3 2-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1Z" />
          <path d="M8 8h8M8 12h8" />
        </svg>
      );
    case "admin":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 7 4v5c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4Z" />
          <path d="m9.5 12 1.7 1.7L14.8 10" />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
  }
}

function MenuItem({
  href,
  icon,
  label,
  badge,
  onClick
}: {
  href?: string;
  icon: MenuIconKind;
  label: string;
  badge?: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[16px] border-2 border-white bg-[#f6efea] text-[#d3a27f] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
        <MenuIcon kind={icon} />
        {badge && badge > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#3bceac] text-[10px] font-black leading-none text-white shadow-[0_0_0_2px_white]">
            !
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1 text-left text-xs font-black uppercase tracking-[0.08em] text-[#5d4037]">
        {label}
      </span>
      <span className="text-xl font-black leading-none text-[#d3a27f]">›</span>
    </>
  );
  const className =
    "flex w-full items-center gap-3 rounded-[22px] border-2 border-white bg-[#fffcf9] px-3 py-3 shadow-[0_14px_34px_-26px_rgba(93,64,55,0.5)] transition hover:-translate-y-0.5 hover:bg-white active:translate-y-[2px]";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}

export default function MenuClient() {
  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpVisible, setTopUpVisible] = useState(false);
  const [topUpCurrency, setTopUpCurrency] = useState<"RUB" | "USD">("RUB");
  const [topUpPlan, setTopUpPlan] = useState<number | null>(null);
  const [newsUnreadCount, setNewsUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const topUpOptions = [
    { coins: 100, rub: 100, usd: 1 },
    { coins: 200, rub: 200, usd: 2 },
    { coins: 500, rub: 500, usd: 500 },
    { coins: 1000, rub: 1000, usd: 10 }
  ];

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
    } finally {
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    void fetchMe();
  }, [apiUrl]);

  useEffect(() => {
    const loadNewsStatus = async () => {
      try {
        const response = await fetch(`${apiUrl}/content/news/status`, {
          credentials: "include"
        });
        if (!response.ok) {
          setNewsUnreadCount(0);
          return;
        }
        const data = (await response.json()) as { unreadCount?: number };
        setNewsUnreadCount(Math.max(0, data.unreadCount ?? 0));
      } catch {
        setNewsUnreadCount(0);
      }
    };
    void loadNewsStatus();
    const handleNewsRead = () => setNewsUnreadCount(0);
    const handleAuthChanged = () => {
      void fetchMe();
      void loadNewsStatus();
    };
    window.addEventListener("memorial-news-read", handleNewsRead);
    window.addEventListener("memorial-auth-changed", handleAuthChanged);
    return () => {
      window.removeEventListener("memorial-news-read", handleNewsRead);
      window.removeEventListener("memorial-auth-changed", handleAuthChanged);
    };
  }, [apiUrl]);

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
      window.dispatchEvent(new Event("memorial-auth-changed"));
      router.push("/");
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#f7f1ee] px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 text-[#5d4037] sm:px-6 sm:pt-8">
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <div className="rounded-[28px] border-[3px] border-white bg-[#fffcf9] px-4 py-4 shadow-[0_20px_44px_-32px_rgba(93,64,55,0.55)] sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d3a27f]">МяуГав</p>
          <h1 className="mt-1 text-3xl font-black leading-none text-[#5d4037]">Меню</h1>
          <p className="mt-2 text-sm font-semibold leading-snug text-[#8d6e63]">
            Быстрый доступ к основным разделам сервиса.
          </p>
        </div>

        {authChecked && user ? (
          <div className="rounded-[28px] border-[3px] border-white bg-[#fffcf9] p-3 shadow-[0_20px_44px_-32px_rgba(93,64,55,0.55)]">
            <div className="rounded-[22px] bg-[#f7f1ee] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f]">Аккаунт</p>
              <p className="mt-1 truncate text-lg font-black text-[#5d4037]">{user.login ?? user.email}</p>
            </div>
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-between rounded-[22px] border-2 border-white bg-[#fcf8f5] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] transition hover:bg-white"
              onClick={openTopUp}
            >
              <span className="text-xs font-black uppercase tracking-[0.08em] text-[#8d6e63]">Баланс</span>
              <span className="text-lg font-black text-[#5d4037]">{user.coinBalance ?? 0} монет</span>
            </button>
          </div>
        ) : null}

        {!authChecked ? (
          <div className="rounded-[28px] border-[3px] border-white bg-[#fffcf9] p-5 text-sm font-bold text-[#8d6e63]">
            Проверяем аккаунт...
          </div>
        ) : (
          <div className="grid gap-2">
            {user ? (
              <>
                <MenuItem href="/my-pets" icon="pets" label="Мои питомцы" />
                <MenuItem href="/profile" icon="profile" label="Профиль" />
                <MenuItem href="/map" icon="map" label="Карта" />
              </>
            ) : (
              <>
                <MenuItem icon="login" label="Войти" onClick={openAuth} />
                <MenuItem href="/map" icon="map" label="Карта" />
              </>
            )}
            <MenuItem href="/about" icon="about" label="О проекте" />
            <MenuItem href="/charity" icon="charity" label="Благотворительность" />
            <MenuItem href="/news" icon="news" label="Новости" badge={newsUnreadCount} />
            {user && canAccessAdmin(user.accessLevel) ? (
              <MenuItem href="/admin/sql" icon="admin" label="Админ-панель" />
            ) : null}
            {user ? (
              <button
                type="button"
                className="mt-1 flex w-full items-center gap-3 rounded-[22px] border-2 border-white bg-[#fff7f7] px-3 py-3 text-left text-[#ff4d4d] shadow-[0_14px_34px_-26px_rgba(93,64,55,0.5)] transition hover:bg-white"
                onClick={handleLogout}
              >
                <span className="grid h-11 w-11 place-items-center rounded-[16px] bg-white">
                  <MenuIcon kind="logout" />
                </span>
                <span className="text-xs font-black uppercase tracking-[0.08em]">Выйти</span>
              </button>
            ) : null}
          </div>
        )}
      </section>

      <AuthModal
        open={authOpen}
        visible={authVisible}
        onClose={closeAuth}
        successRedirect={null}
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
            className="absolute inset-0 bg-[#111827]/30 backdrop-blur-md"
            onClick={closeTopUp}
          />
          <div
            className={`relative w-full max-w-md rounded-[36px] border-[4px] border-white bg-[#efe6e2] p-3 shadow-[0_28px_70px_-24px_rgba(93,64,55,0.55)] transition-transform duration-200 ${
              topUpVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
            }`}
          >
            <div className="rounded-[28px] border border-white/80 bg-white/[0.86] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(126,102,93,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f]">
                    Баланс
                  </p>
                  <h3 className="mt-1 text-lg font-black text-[#5d4037]">
                    Пополнение баланса
                  </h3>
                </div>
                <button
                  type="button"
                  className="rounded-[16px] border-[3px] border-white bg-[#f1e7e0] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] transition hover:bg-white"
                  onClick={closeTopUp}
                >
                  Закрыть
                </button>
              </div>
              <p className="mt-3 rounded-[18px] bg-[#f7f1ee] px-4 py-3 text-sm font-semibold text-[#8d6e63]">
                Баланс: {user?.coinBalance ?? 0} монет
              </p>
              <div className="mt-4 flex gap-2 rounded-[20px] bg-[#f1e7e0] p-1.5">
                {(["RUB", "USD"] as const).map((currency) => {
                  const isActive = topUpCurrency === currency;
                  return (
                    <button
                      key={currency}
                      type="button"
                      onClick={() => setTopUpCurrency(currency)}
                      className={`flex-1 rounded-[15px] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                        isActive ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]" : "text-[#8d6e63] hover:bg-white/70"
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
                      className={`flex items-center justify-between rounded-[22px] border-[3px] px-4 py-3 text-sm transition ${
                        isSelected
                          ? "border-[#3bceac] bg-[#f0fffb] text-[#5d4037] shadow-[0_10px_24px_-18px_rgba(59,206,172,0.55)]"
                          : "border-white bg-white text-[#6f6360] hover:border-[#d3a27f]/40"
                      }`}
                    >
                      <span className="font-black">{option.coins} монет</span>
                      <span className="font-semibold text-[#8d6e63]">{price}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="mt-5 inline-flex w-full items-center justify-center rounded-[18px] bg-[#111827] px-6 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[0_5px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_0_0_#000] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:bg-[#c8d0da] disabled:text-white/85 disabled:shadow-none"
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
        </div>
      ) : null}
      {error ? <ErrorToast message={error} onClose={() => setError(null)} /> : null}
    </main>
  );
}
