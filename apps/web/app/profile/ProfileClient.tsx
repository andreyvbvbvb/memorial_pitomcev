"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";
import {
  authBackdropGlowClass,
  authCardClass,
  authHelperTextClass,
  authInnerShellClass,
  authInputClass,
  authLabelClass,
  authNoticeClass,
  authPageShellClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
  authTitleClass
} from "../../components/authTheme";

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
      const response = await fetch(`${apiUrl}/users/${encodeURIComponent(profile.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include"
      });
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

  const handleLogout = async () => {
    await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    setProfile(null);
    setLogin("");
    setEmail("");
    router.replace("/auth");
  };

  const handleCancelEditing = () => {
    setEditing(false);
    setLogin(profile?.login ?? "");
    setEmail(profile?.email ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setError(null);
  };

  return (
    <div className={`${authPageShellClass} px-6 py-10`}>
      <div className={`${authBackdropGlowClass} -right-20 top-[-5rem] h-72 w-72 bg-white/35`} />
      <div className={`${authBackdropGlowClass} -left-16 bottom-[-7rem] h-80 w-80 bg-[#fdf2e9]/70`} />

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
          <div className={authCardClass}>
            <div className={authInnerShellClass}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#d3a27f]">
                    Профиль
                  </p>
                  <h1 className={`mt-2 ${authTitleClass}`}>Настройки аккаунта</h1>
                  <p className={`mt-3 max-w-2xl ${authHelperTextClass}`}>
                    Здесь можно изменить логин, email и пароль аккаунта.
                  </p>
                </div>
                <div className="rounded-full bg-[#fdf2e9] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#8d6e63]">
                  {loadingProfile ? "Загрузка" : editing ? "Редактирование" : "Просмотр"}
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {loadingProfile ? (
                  <div className="rounded-[24px] border-[3px] border-white bg-[#f8f9fa] px-5 py-4 text-sm font-semibold text-[#8d6e63] shadow-[inset_0_2px_6px_rgba(93,64,55,0.08)]">
                    Загружаем профиль...
                  </div>
                ) : null}

                <label className={authLabelClass}>
                  Логин
                  <input
                    className={authInputClass}
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    placeholder="login"
                    disabled={!profile || !editing}
                  />
                  <span className={authHelperTextClass}>
                    Можно менять. Допустимы a-z, 0-9 и подчёркивание.
                  </span>
                </label>

                <label className={authLabelClass}>
                  Email
                  <input
                    className={authInputClass}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="user@example.com"
                    disabled={!profile || !editing}
                  />
                </label>

                {editing ? (
                  <>
                    <label className={authLabelClass}>
                      Текущий пароль
                      <input
                        type="password"
                        className={authInputClass}
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        placeholder="••••••"
                        disabled={!profile}
                      />
                    </label>
                    <label className={authLabelClass}>
                      Новый пароль
                      <input
                        type="password"
                        className={authInputClass}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="••••••"
                        disabled={!profile}
                      />
                    </label>
                  </>
                ) : null}

                {notice ? <div className={authNoticeClass}>{notice}</div> : null}
                <ErrorToast message={error} onClose={() => setError(null)} />

                <div className="flex flex-wrap gap-3 pt-2">
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
                      className="inline-flex min-w-[14rem] items-center justify-center rounded-[26px] bg-[#3bceac] px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_6px_0_0_#2a9b81] transition-all hover:bg-[#34c1a1] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:bg-[#9ddfce] disabled:text-white/80 disabled:shadow-none"
                      disabled={!profile}
                    >
                      Редактировать профиль
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleSave}
                        className="inline-flex min-w-[14rem] items-center justify-center rounded-[26px] bg-[#3bceac] px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_6px_0_0_#2a9b81] transition-all hover:bg-[#34c1a1] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:bg-[#9ddfce] disabled:text-white/80 disabled:shadow-none"
                        disabled={!profile || saving}
                      >
                        {saving ? "Сохранение..." : "Сохранить изменения"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditing}
                        className="inline-flex min-w-[11rem] items-center justify-center rounded-[24px] border-[3px] border-white bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] transition-all hover:bg-[#fff7f1]"
                        disabled={!profile || saving}
                      >
                        Отменить
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className={authCardClass}>
            <div className={authInnerShellClass}>
              <div className="rounded-[28px] border-[4px] border-white bg-[#fff7f1] p-5 shadow-[0_18px_32px_-24px_rgba(93,64,55,0.5)]">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d3a27f]">
                  Аккаунт
                </p>
                <div className="mt-3 rounded-[24px] border-[3px] border-white bg-white px-4 py-4 shadow-[inset_0_2px_6px_rgba(93,64,55,0.05)]">
                  <div className="text-sm font-black text-[#5d4037]">
                    {profile?.login?.trim() || "Без логина"}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#8d6e63]">
                    {profile?.email || "Email не указан"}
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/my-pets")}
                    className={authSecondaryButtonClass}
                  >
                    Мои мемориалы
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/create")}
                    className={authSecondaryButtonClass}
                  >
                    Создать мемориал
                  </button>
                  {profile ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex w-full items-center justify-center rounded-[24px] border-[3px] border-[#ffe0df] bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#c95454] shadow-[0_10px_24px_-18px_rgba(201,84,84,0.38)] transition-all hover:bg-[#fff4f4]"
                    >
                      Выйти
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
