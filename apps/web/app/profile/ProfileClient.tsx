"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";

type Profile = {
  id: string;
  login: string | null;
  email: string | null;
  coinBalance: number;
};

export default function ProfileClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();

  useEffect(() => {
    const loadMe = async () => {
      try {
        setLoadingProfile(true);
        const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
        if (!response.ok) {
          router.replace("/auth");
          return;
        }
        const data = (await response.json()) as Profile;
        setProfile(data);
        setLogin(data.login ?? "");
        setEmail(data.email ?? "");
        setEditing(false);
      } catch {
        router.replace("/auth");
      } finally {
        setLoadingProfile(false);
      }
    };
    loadMe();
  }, [apiUrl, router]);

  const handleSave = async () => {
    if (!profile) {
      setError("Сначала загрузите профиль");
      return;
    }
    const trimmedLogin = login.trim();
    if (trimmedLogin && !/^[a-z0-9_]+$/.test(trimmedLogin)) {
      setError("Логин может содержать только a-z, 0-9 и подчёркивание");
      return;
    }
    if ((currentPassword.trim() || newPassword.trim()) && newPassword.trim().length < 6) {
      setError("Новый пароль должен быть минимум 6 символов");
      return;
    }
    if (newPassword.trim() && !currentPassword.trim()) {
      setError("Введите текущий пароль");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload: {
        login: string | null;
        email: string | null;
        currentPassword?: string;
        newPassword?: string;
      } = {
        login: login.trim() || null,
        email: email.trim() || null
      };
      if (currentPassword.trim() || newPassword.trim()) {
        payload.currentPassword = currentPassword.trim();
        payload.newPassword = newPassword.trim();
      }
      const response = await fetch(`${apiUrl}/users/${encodeURIComponent(profile.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
      setCurrentPassword("");
      setNewPassword("");
      setEditing(false);
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
      <div className="flex flex-col gap-2" />

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
          <div className="grid gap-4">
            {loadingProfile ? (
              <p className="text-sm text-slate-500">Загружаем профиль...</p>
            ) : null}
            <label className="grid gap-1 text-sm text-slate-700">
              Логин
              <input
                className="rounded-2xl border border-slate-200 px-4 py-2"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="login"
                disabled={!profile || !editing}
              />
              <span className="text-xs text-slate-500">
                Можно менять. Допустимы a-z, 0-9 и подчёркивание.
              </span>
            </label>

            <label className="grid gap-1 text-sm text-slate-700">
              Email
              <input
                className="rounded-2xl border border-slate-200 px-4 py-2"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                disabled={!profile || !editing}
              />
            </label>

            {editing ? (
              <>
                <label className="grid gap-1 text-sm text-slate-700">
                  Текущий пароль
                  <input
                    type="password"
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="••••••"
                    disabled={!profile}
                  />
                </label>
                <label className="grid gap-1 text-sm text-slate-700">
                  Новый пароль
                  <input
                    type="password"
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="••••••"
                    disabled={!profile}
                  />
                </label>
              </>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {!editing ? (
                <button
                  type="button"
                  onClick={() => {
                    if (profile) {
                      setEditing(true);
                      setError(null);
                      setNotice(null);
                    }
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                  disabled={!profile}
                >
                  Редактировать профиль
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    disabled={!profile || saving}
                  >
                    {saving ? "Сохранение..." : "Сохранить изменения"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setLogin(profile?.login ?? "");
                      setEmail(profile?.email ?? "");
                      setCurrentPassword("");
                      setNewPassword("");
                    }}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                    disabled={!profile || saving}
                  >
                    Отменить
                  </button>
                </>
              )}
            </div>

            {profile ? (
              <button
                type="button"
                onClick={async () => {
                  await fetch(`${apiUrl}/auth/logout`, {
                    method: "POST",
                    credentials: "include"
                  });
                  setProfile(null);
                  setLogin("");
                  setEmail("");
                  router.replace("/auth");
                }}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                Выйти
              </button>
            ) : null}

            {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
            <ErrorToast message={error} onClose={() => setError(null)} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
