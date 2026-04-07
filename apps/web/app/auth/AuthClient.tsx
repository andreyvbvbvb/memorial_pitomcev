"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";

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
  const [forgotPopupOpen, setForgotPopupOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptOffer, setAcceptOffer] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentOffer, setConsentOffer] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);

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
    if (mode === "register" && (!acceptTerms || !acceptOffer)) {
      setError("Нужно принять пользовательское соглашение и публичную оферту");
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
      const data = (await response.json()) as {
        termsAccepted?: boolean;
        offerAccepted?: boolean;
      };
      if (
        mode === "login" &&
        (!data?.termsAccepted || !data?.offerAccepted)
      ) {
        setConsentOpen(true);
        setConsentTerms(false);
        setConsentOffer(false);
        setNotice(null);
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
      setConsentOpen(false);
      setNotice("Готово! Перенаправляем...");
      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка подтверждения");
    } finally {
      setConsentLoading(false);
    }
  };

  const handleSubmitEvent = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSubmit();
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
                      <a href="/about#agreement" className="text-slate-900 underline">
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
                      <a href="/about#offer" className="text-slate-900 underline">
                        публичную оферту
                      </a>
                    </span>
                  </label>
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              disabled={loading}
            >
              {loading
                ? "Подождите..."
                : mode === "login"
                  ? "Войти"
                  : "Создать аккаунт"}
            </button>

            {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
            <ErrorToast message={error} onClose={() => setError(null)} />
          </div>

          {mode === "login" ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setForgotPopupOpen(true)}
                className="text-sm text-slate-600 underline-offset-4 hover:underline"
              >
                Забыли пароль?
              </button>
            </div>
          ) : null}
        </form>
      </div>
      {forgotPopupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Восстановление пароля</h3>
              <button
                type="button"
                onClick={() => setForgotPopupOpen(false)}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Напишите на почту memorial@gamil.com письмо с адресом почты, на который был
              зарегистрирован аккаунт. Мы вышлем новый пароль в ответном письме.
            </p>
            <button
              type="button"
              onClick={() => setForgotPopupOpen(false)}
              className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}
      {consentOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
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
                  <a href="/about#agreement" className="text-slate-900 underline">
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
                  <a href="/about#offer" className="text-slate-900 underline">
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
