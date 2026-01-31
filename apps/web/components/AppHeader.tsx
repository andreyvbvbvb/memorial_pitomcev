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
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const openAuth = () => {
    setAuthOpen(true);
    requestAnimationFrame(() => setAuthVisible(true));
  };

  const closeAuth = () => {
    setAuthVisible(false);
    setTimeout(() => setAuthOpen(false), 200);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${apiUrl}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
      setMenuOpen(false);
      router.push("/");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[rgba(215,230,242,0.6)] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="chip">
            Memorial
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-label="Открыть меню"
                  onClick={() => setMenuOpen((prev) => !prev)}
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
                  <div className="absolute right-0 mt-3 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="px-3 pb-2 text-xs text-slate-500">
                      {user.login ?? user.email}
                    </div>
                    <div className="grid gap-1 text-sm text-slate-700">
                      <Link className="rounded-xl px-3 py-2 hover:bg-slate-100" href="/profile">
                        Профиль
                      </Link>
                      <Link className="rounded-xl px-3 py-2 hover:bg-slate-100" href="/create">
                        Создать мемориал
                      </Link>
                      <Link className="rounded-xl px-3 py-2 hover:bg-slate-100" href="/my-pets">
                        Мои питомцы
                      </Link>
                      <Link className="rounded-xl px-3 py-2 hover:bg-slate-100" href="/map">
                        Карта мемориалов
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
            ) : (
              <button type="button" className="btn btn-outline" onClick={openAuth}>
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
    </>
  );
}
