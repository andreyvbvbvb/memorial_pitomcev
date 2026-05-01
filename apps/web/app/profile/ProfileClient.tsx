"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";
import {
  authBackdropGlowClass,
  authCardClass,
  authInnerShellClass,
  authInputClass,
  authLabelClass,
  authNoticeClass,
  authPageShellClass,
  authTitleClass
} from "../../components/authTheme";

type Profile = {
  id: string;
  login: string | null;
  email: string | null;
  coinBalance: number;
};

function HelpHint({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span
      className={`group/hint relative inline-flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-[#f1e7e0] text-xs font-black text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] outline-none transition hover:bg-white hover:text-[#5d4037] focus:bg-white focus:text-[#5d4037] ${className}`}
      tabIndex={0}
      aria-label={text}
    >
      ?
      <span className="pointer-events-none absolute right-0 top-[calc(100%+0.55rem)] z-30 w-64 rounded-[18px] border-[3px] border-white bg-white/[0.96] px-4 py-3 text-left text-[11px] font-bold normal-case leading-snug tracking-normal text-[#6f6360] opacity-0 shadow-[0_18px_38px_-22px_rgba(93,64,55,0.55)] backdrop-blur transition-all duration-200 group-hover/hint:opacity-100 group-focus/hint:opacity-100">
        {text}
      </span>
    </span>
  );
}

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

      <div className="relative z-10 mx-auto w-full max-w-3xl">
        <section>
          <div className={authCardClass}>
            <div className={`${authInnerShellClass} relative`}>
              <span className="absolute right-4 top-4">
                <HelpHint text="Здесь можно изменить логин, email и пароль аккаунта." />
              </span>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="pr-12">
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#d3a27f]">
                    Профиль
                  </p>
                  <h1 className={`mt-2 ${authTitleClass}`}>Настройки аккаунта</h1>
                </div>
                {loadingProfile || editing ? (
                  <div className="mr-11 rounded-full bg-[#fdf2e9] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#8d6e63]">
                    {loadingProfile ? "Загрузка" : "Редактирование"}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4">
                {loadingProfile ? (
                  <div className="rounded-[24px] border-[3px] border-white bg-[#f8f9fa] px-5 py-4 text-sm font-semibold text-[#8d6e63] shadow-[inset_0_2px_6px_rgba(93,64,55,0.08)]">
                    Загружаем профиль...
                  </div>
                ) : null}

                <label className={authLabelClass}>
                  <span className="flex items-center justify-between gap-3">
                    <span>Логин</span>
                    <HelpHint
                      text="Можно менять. Допустимы a-z, 0-9 и подчёркивание."
                      className="h-7 w-7 text-[11px]"
                    />
                  </span>
                  <input
                    className={authInputClass}
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    placeholder="login"
                    disabled={!profile || !editing}
                  />
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
                    <>
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
                      {profile ? (
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="inline-flex min-w-[11rem] items-center justify-center rounded-[24px] border-[3px] border-[#ffe0df] bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#c95454] shadow-[0_10px_24px_-18px_rgba(201,84,84,0.38)] transition-all hover:bg-[#fff4f4]"
                        >
                          Выйти
                        </button>
                      ) : null}
                    </>
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
        </section>
      </div>
    </div>
  );
}
