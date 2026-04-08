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
  termsAccepted?: boolean;
  offerAccepted?: boolean;
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
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptOffer, setAcceptOffer] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentOffer, setConsentOffer] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);

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
      setForgotMode(false);
      setAcceptTerms(false);
      setAcceptOffer(false);
      setConsentOpen(false);
      setConsentTerms(false);
      setConsentOffer(false);
      setConsentLoading(false);
    }
  }, [open]);

  const handleClose = () => {
    if (consentOpen) {
      return;
    }
    onClose();
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !consentOpen) {
        handleClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, consentOpen]);

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

    if (mode === "register" && (!acceptTerms || !acceptOffer)) {
      setError("Нужно принять пользовательское соглашение и публичную оферту");
      return;
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
              ? {
                  login: login.trim().toLowerCase(),
                  email: email.trim(),
                  password: password.trim(),
                  acceptTerms,
                  acceptOffer
                }
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
      if (
        mode === "login" &&
        (!payload?.termsAccepted || !payload?.offerAccepted)
      ) {
        setConsentOpen(true);
        setConsentTerms(false);
        setConsentOffer(false);
        setNotice(null);
        return;
      }
      setNotice("Готово! Перенаправляем...");
      onSuccess?.(payload);
      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!consentTerms || !consentOffer) {
      setError("Нужно принять пользовательское соглашение и публичную оферту");
      return;
    }
    setConsentLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/auth/accept-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ acceptTerms: true, acceptOffer: true })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось подтвердить согласие");
      }
      const payload = (await response.json()) as AuthUser;
      setConsentOpen(false);
      setNotice("Готово! Перенаправляем...");
      onSuccess?.(payload);
      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка подтверждения");
    } finally {
      setConsentLoading(false);
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
        onClick={handleClose}
      />
      <div
        className={`relative w-full max-w-md rounded-3xl border border-[rgba(215,230,242,0.8)] bg-white p-6 shadow-2xl transition-transform duration-200 ${
          visible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--text)]">Вход и регистрация</h2>
          <button type="button" className="btn btn-ghost px-3 py-2" onClick={handleClose}>
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
                <div className="grid gap-2 text-sm text-slate-700">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={acceptTerms}
                      onChange={(event) => setAcceptTerms(event.target.checked)}
                    />
                    <span>
                      Я принимаю{" "}
                      <a href="/about#agreement" className="underline">
                        пользовательское соглашение
                      </a>
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={acceptOffer}
                      onChange={(event) => setAcceptOffer(event.target.checked)}
                    />
                    <span>
                      Я принимаю{" "}
                      <a href="/about#offer" className="underline">
                        публичную оферту
                      </a>
                    </span>
                  </label>
                </div>
                <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={loading}>
                  {loading ? "Подождите..." : "Зарегистрироваться"}
                </button>
              </>
            )
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Напишите на почту memorial@gamil.com письмо с адресом почты, на который был
                зарегистрирован аккаунт. Мы вышлем новый пароль в ответном письме.
              </div>
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
        </div>
      </div>
      {consentOpen ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Подтвердите согласие с условиями
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Чтобы продолжить, примите пользовательское соглашение и публичную оферту.
            </p>
            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={consentTerms}
                  onChange={(event) => setConsentTerms(event.target.checked)}
                />
                <span>
                  Я принимаю{" "}
                  <a href="/about#agreement" className="underline">
                    пользовательское соглашение
                  </a>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={consentOffer}
                  onChange={(event) => setConsentOffer(event.target.checked)}
                />
                <span>
                  Я принимаю{" "}
                  <a href="/about#offer" className="underline">
                    публичную оферту
                  </a>
                </span>
              </label>
            </div>
            <button
              type="button"
              onClick={handleAcceptTerms}
              disabled={consentLoading || !consentTerms || !consentOffer}
              className={`mt-5 w-full rounded-2xl px-4 py-2 text-sm font-semibold ${
                consentLoading || !consentTerms || !consentOffer
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-slate-900 text-white"
              }`}
            >
              {consentLoading ? "Подождите..." : "Согласен"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
