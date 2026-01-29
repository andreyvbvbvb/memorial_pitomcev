"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/config";

type Profile = {
  id: string;
  login: string | null;
  email: string | null;
  coinBalance: number;
};

export default function ProfileClient() {
  const [ownerId, setOwnerId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const apiUrl = useMemo(() => API_BASE, []);

  const handleLoad = async () => {
    const trimmed = ownerId.trim();
    if (!trimmed) {
      setError("Введите Owner ID");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiUrl}/users/${encodeURIComponent(trimmed)}`, {
        credentials: "include"
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось загрузить профиль");
      }
      const data = (await response.json()) as Profile;
      setProfile(data);
      setLogin(data.login ?? "");
      setEmail(data.email ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки профиля");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadMe = async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as Profile;
        setProfile(data);
        setOwnerId(data.id);
        setLogin(data.login ?? "");
        setEmail(data.email ?? "");
      } catch {
        return;
      }
    };
    loadMe();
  }, [apiUrl]);

  const handleSave = async () => {
    if (!profile) {
      setError("Сначала загрузите профиль");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiUrl}/users/${encodeURIComponent(profile.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login: login.trim() || null, email: email.trim() || null }),
          credentials: "include"
        }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось сохранить профиль");
      }
      const data = (await response.json()) as Profile;
      setProfile(data);
      setLogin(data.login ?? "");
      setEmail(data.email ?? "");
      setNotice("Профиль обновлён");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения профиля");
    } finally {
      setSaving(false);
    }
  };

  const handleTopUp = async () => {
    if (!profile) {
      setError("Сначала загрузите профиль");
      return;
    }
    setWalletLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiUrl}/wallet/top-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: profile.id, amount: 100 }),
        credentials: "include"
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Ошибка пополнения");
      }
      const data = (await response.json()) as { coinBalance: number };
      setProfile((prev) => (prev ? { ...prev, coinBalance: data.coinBalance } : prev));
      setNotice("Баланс пополнен (+100)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка пополнения");
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Личный кабинет</p>
        <h1 className="text-3xl font-semibold text-slate-900">Профиль</h1>
        <p className="text-slate-600">
          Пока без авторизации — указываем Owner ID вручную.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/my-pets"
          className="rounded-2xl border border-slate-200 px-5 py-2 text-sm text-slate-700"
        >
          Мои питомцы
        </Link>
        <Link
          href="/create"
          className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          Создать мемориал
        </Link>
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Основные данные</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm text-slate-700">
              Owner ID
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-2"
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                  placeholder="user_123"
                />
                <button
                  type="button"
                  onClick={handleLoad}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                  disabled={loading}
                >
                  {loading ? "Загрузка..." : "Загрузить"}
                </button>
              </div>
            </label>

            <label className="grid gap-1 text-sm text-slate-700">
              Логин
              <input
                className="rounded-2xl border border-slate-200 px-4 py-2"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="login"
                disabled={!profile}
              />
              <span className="text-xs text-slate-500">
                Можно менять. Допустимы a-z, 0-9, точка и подчёркивание.
              </span>
            </label>

            <label className="grid gap-1 text-sm text-slate-700">
              Email
              <input
                className="rounded-2xl border border-slate-200 px-4 py-2"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                disabled={!profile}
              />
            </label>

            <button
              type="button"
              onClick={handleSave}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              disabled={!profile || saving}
            >
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </button>

            {profile ? (
              <button
                type="button"
                onClick={async () => {
                  await fetch(`${apiUrl}/auth/logout`, {
                    method: "POST",
                    credentials: "include"
                  });
                  setProfile(null);
                  setOwnerId("");
                  setLogin("");
                  setEmail("");
                }}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                Выйти
              </button>
            ) : null}

            {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Кошелёк</h2>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Баланс монет</p>
              <span className="text-sm text-slate-700">
                {profile ? `${profile.coinBalance} монет` : "—"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Пока тестовое пополнение — позже подключим оплату.
            </p>
            <button
              type="button"
              onClick={handleTopUp}
              className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
              disabled={!profile || walletLoading}
            >
              {walletLoading ? "Пополнение..." : "Пополнить +100 (тест)"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
