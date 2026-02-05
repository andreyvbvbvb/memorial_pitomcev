"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/config";

export default function AuthClient() {
  const [mode, setMode] = useState<"login" | "register">("login");
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
    if (mode === "register" && password.trim().length < 6) {
      setError("Пароль должен быть минимум 6 символов");
      return;
    }
    if (mode === "register" && password.trim() !== confirmPassword.trim()) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/${mode === "register" ? "register" : "login"}`,
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
      setNotice("Готово! Перенаправляем...");
      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEvent = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSubmit();
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

  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <form
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={handleSubmitEvent}
        >
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-2xl px-4 py-2 text-sm ${
                mode === "login" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700"
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-2xl px-4 py-2 text-sm ${
                mode === "register" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700"
              }`}
            >
              Регистрация
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            {mode === "login" ? (
              <>
                <label className="grid gap-1 text-sm text-slate-700">
                  Email или логин
                  <input
                    className="rounded-2xl border border-slate-200 px-4 py-2"
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
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="grid gap-1 text-sm text-slate-700">
                  Логин
                  <input
                    className="rounded-2xl border border-slate-200 px-4 py-2"
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
                    className="rounded-2xl border border-slate-200 px-4 py-2"
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
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••"
                  />
                </label>
                <label className="grid gap-1 text-sm text-slate-700">
                  Подтверждение пароля
                  <input
                    type="password"
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••"
                  />
                </label>
              </>
            )}

            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              disabled={loading}
            >
              {loading
                ? "Подождите..."
                : mode === "login"
                  ? "Войти"
                  : "Создать аккаунт"}
            </button>

            {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setForgotMode((prev) => !prev)}
              className="text-sm text-slate-600 underline-offset-4 hover:underline"
            >
              Забыли пароль?
            </button>
            {forgotMode ? (
              <div className="mt-3 grid gap-2">
                <input
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="Email или логин"
                  value={forgotIdentifier}
                  onChange={(event) => setForgotIdentifier(event.target.value)}
                />
                <button
                  type="button"
                  onClick={handleForgot}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                  disabled={loading}
                >
                  Отправить новый пароль
                </button>
                {forgotNotice ? (
                  <p className="text-xs text-emerald-600">{forgotNotice}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
