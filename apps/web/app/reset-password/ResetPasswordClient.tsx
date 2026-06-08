"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggle
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={authLabelClass}>
      {label}
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          className={`${authInputClass} pr-12`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="••••••"
          autoComplete="new-password"
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#8d6e63] transition hover:bg-white hover:text-[#5d4037]"
          onClick={onToggle}
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 3 18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 4.24A10.7 10.7 0 0 1 12 4c5 0 8.7 3.2 10 8a11.5 11.5 0 0 1-2.2 4.06" />
              <path d="M6.6 6.6A11.1 11.1 0 0 0 2 12c1.3 4.8 5 8 10 8a10.8 10.8 0 0 0 4.2-.82" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

const parseErrorMessage = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return "Не удалось изменить пароль";
  }
  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(", ");
    }
    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // Use raw text below.
  }
  return text;
};

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const apiUrl = useMemo(() => API_BASE, []);
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || done) {
      return;
    }
    setError(null);
    setNotice(null);
    if (!token) {
      setError("В ссылке нет токена сброса пароля");
      return;
    }
    if (password.trim().length < 6) {
      setError("Пароль должен быть минимум 6 символов");
      return;
    }
    if (password.trim() !== confirmPassword.trim()) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: password.trim() })
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      setDone(true);
      setPassword("");
      setConfirmPassword("");
      setNotice("Пароль изменён. Теперь можно войти с новым паролем.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={authPageShellClass}>
      <div className={`${authBackdropGlowClass} -right-20 top-[-5rem] h-72 w-72 bg-white/35`} />
      <div className={`${authBackdropGlowClass} -left-16 bottom-[-7rem] h-80 w-80 bg-[#fdf2e9]/70`} />

      <div className="w-full max-w-[32rem]">
        <form className={authCardClass} onSubmit={handleSubmit}>
          <div className={authInnerShellClass}>
            <h1 className={authTitleClass}>Новый пароль</h1>
            <p className={`mt-3 ${authHelperTextClass}`}>
              Задайте новый пароль для аккаунта. Ссылка из письма действует 1 час и работает один раз.
            </p>

            <div className="mt-5 grid gap-4">
              {!token ? (
                <div className={authNoticeClass}>
                  В ссылке нет токена сброса. Запросите восстановление пароля ещё раз.
                </div>
              ) : null}
              <PasswordInput
                label="Новый пароль"
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
              <PasswordInput
                label="Повторите пароль"
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((prev) => !prev)}
              />
              <button
                type="submit"
                className={authPrimaryButtonClass}
                disabled={loading || done || !token}
              >
                {loading ? "Сохраняем..." : done ? "Пароль изменён" : "Сохранить пароль"}
              </button>
              <Link href="/auth" className={authSecondaryButtonClass}>
                Перейти ко входу
              </Link>
              {notice ? <div className={authNoticeClass}>{notice}</div> : null}
              <ErrorToast message={error} onClose={() => setError(null)} />
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
