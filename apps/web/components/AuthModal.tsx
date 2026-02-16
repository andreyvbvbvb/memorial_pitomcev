"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/config";
import ErrorToast from "./ErrorToast";

type AuthMode = "login" | "register";

type AuthUser = {
  id: string;
  login?: string | null;
  email: string;
  coinBalance?: number;
};

type AuthModalProps = {
  open: boolean;
  visible: boolean;
  onClose: () => void;
  onSuccess?: (user: AuthUser) => void;
};

export default function AuthModal({ open, visible, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotNotice, setForgotNotice] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setMode("login");
      setForgotMode(false);
      setIdentifier("");
      setLogin("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError(null);
      setEmailError(null);
      setLoginError(null);
      setNotice(null);
      setForgotNotice(null);
      setForgotIdentifier("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const handleSubmit = async () => {
    setError(null);
    setEmailError(null);
    setLoginError(null);
    setNotice(null);

    if (mode === "login") {
      if (!identifier.trim() || !password.trim()) {
        setError("Введите email (или логин) и пароль");
        return;
      }
    } else {
      if (!login.trim()) {
        setLoginError("Введите логин");
        return;
      }
      if (!email.trim()) {
        setEmailError("Введите email");
        return;
      }
      if (!/^[a-z0-9_]+$/.test(login.trim())) {
        setLoginError("Логин: только a-z, 0-9 и _");
        return;
      }
      if (!email.includes("@")) {
        setEmailError("Укажите корректный email");
        return;
      }
    }

    if (password.trim().length < 6) {
      setError("Пароль должен быть минимум 6 символов");
      return;
    }
    if (mode === "register" && password.trim() !== confirmPassword.trim()) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${apiUrl}/auth/${mode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            mode === "register"
              ? { login: login.trim().toLowerCase(), email: email.trim(), password: password.trim() }
              : { email: identifier.trim(), password: password.trim() }
          )
        }
      );

      if (!response.ok) {
        const text = await response.text();
        let message = text;
        try {
          const parsed = JSON.parse(text) as { message?: string };
          if (parsed?.message) {
            message = parsed.message;
          }
        } catch {
          // ignore
        }
        if (mode === "register" && message.toLowerCase().includes("логин")) {
          setLoginError(message);
        } else if (mode === "register" && message.toLowerCase().includes("email")) {
          setEmailError(message);
        } else {
          setError(message || "Ошибка авторизации");
        }
        return;
      }

      const payload = (await response.json()) as AuthUser;
      setNotice("Готово! Перенаправляем...");
      onSuccess?.(payload);
      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError(null);
    setForgotNotice(null);
    if (!forgotIdentifier.trim()) {
      setError("Укажите email или логин");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() })
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || "Не удалось сбросить пароль");
      }
      setForgotNotice("Если аккаунт существует, на почту отправлено письмо.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сброса пароля");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 cursor-default bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-md rounded-3xl border border-[rgba(215,230,242,0.8)] bg-white p-6 shadow-2xl transition-transform duration-200 ${
          visible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--text)]">Вход и регистрация</h2>
          <button type="button" className="btn btn-ghost px-3 py-2" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setForgotMode(false);
            }}
            className={`rounded-2xl px-4 py-2 text-sm ${
              mode === "login" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700"
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setForgotMode(false);
            }}
            className={`rounded-2xl px-4 py-2 text-sm ${
              mode === "register" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700"
            }`}
          >
            Регистрация
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          {!forgotMode ? (
            mode === "login" ? (
              <>
                <label className="grid gap-1 text-sm text-slate-700">
                  Email или логин
                  <input
                    className="input"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      setEmailError(null);
                    }}
                    placeholder="user@example.com"
                  />
                </label>
                <label className="grid gap-1 text-sm text-slate-700">
                  Пароль
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••"
                  />
                </label>
                <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={loading}>
                  {loading ? "Подождите..." : "Войти"}
                </button>
                <button
                  type="button"
                  onClick={() => setForgotMode(true)}
                  className="text-left text-xs text-slate-500 underline"
                >
                  Забыли пароль?
                </button>
              </>
            ) : (
              <>
                <label className="grid gap-1 text-sm text-slate-700">
                  Логин
                  <input
                    className="input"
                    value={login}
                    onChange={(event) => {
                      setLogin(event.target.value);
                      setLoginError(null);
                    }}
                    placeholder="pet_friend_01"
                  />
                  {loginError ? <span className="text-xs text-red-600">{loginError}</span> : null}
                </label>
                <label className="grid gap-1 text-sm text-slate-700">
                  Email
                  <input
                    className="input"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError(null);
                    }}
                    placeholder="user@example.com"
                  />
                  {emailError ? <span className="text-xs text-red-600">{emailError}</span> : null}
                </label>
                <label className="grid gap-1 text-sm text-slate-700">
                  Пароль
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••"
                  />
                </label>
                <label className="grid gap-1 text-sm text-slate-700">
                  Подтверждение пароля
                  <input
                    type="password"
                    className="input"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••"
                  />
                </label>
                <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={loading}>
                  {loading ? "Подождите..." : "Зарегистрироваться"}
                </button>
              </>
            )
          ) : (
            <>
              <label className="grid gap-1 text-sm text-slate-700">
                Email или логин
                <input
                  className="input"
                  value={forgotIdentifier}
                  onChange={(event) => setForgotIdentifier(event.target.value)}
                  placeholder="user@example.com"
                />
              </label>
              <button type="button" onClick={handleForgot} className="btn btn-primary" disabled={loading}>
                {loading ? "Подождите..." : "Отправить новый пароль"}
              </button>
              <button
                type="button"
                onClick={() => setForgotMode(false)}
                className="text-left text-xs text-slate-500 underline"
              >
                Назад к входу
              </button>
            </>
          )}

          <ErrorToast message={error} onClose={() => setError(null)} />
          {notice ? <div className="rounded-2xl bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</div> : null}
          {forgotNotice ? (
            <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-700">{forgotNotice}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
