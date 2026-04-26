"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";
import {
  authBackdropGlowClass,
  authCardClass,
  authCheckboxInputClass,
  authCheckboxRowClass,
  authCloseButtonClass,
  authDialogCardClass,
  authDialogInnerClass,
  authDialogOverlayClass,
  authErrorTextClass,
  authHelperTextClass,
  authInfoPanelClass,
  authInnerShellClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authNoticeClass,
  authPageShellClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
  authTabClass,
  authTabsRailClass,
  authTextButtonClass,
  authTitleClass
} from "../../components/authTheme";

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
    <div className={authPageShellClass}>
      <div className={`${authBackdropGlowClass} -right-20 top-[-5rem] h-72 w-72 bg-white/35`} />
      <div className={`${authBackdropGlowClass} -left-16 bottom-[-7rem] h-80 w-80 bg-[#fdf2e9]/70`} />

      <div className="w-full max-w-[32rem]">
        <form className={authCardClass} onSubmit={handleSubmitEvent}>
          <div className={authInnerShellClass}>
            <div className={authTabsRailClass}>
              <button
                type="button"
                onClick={() => setMode("login")}
                className={authTabClass(mode === "login")}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={authTabClass(mode === "register")}
              >
                Регистрация
              </button>
            </div>

            <div className="mt-5">
              <h1 className={authTitleClass}>
                {mode === "login" ? "Вход" : "Регистрация"}
              </h1>
            </div>

            <div className="mt-5 grid gap-4">
              {mode === "login" ? (
                <>
                  <label className={authLabelClass}>
                    Email или логин
                    <input
                      className={authInputClass}
                      value={identifier}
                      onChange={(event) => {
                        setIdentifier(event.target.value);
                        setEmailError(null);
                      }}
                      placeholder="user@example.com"
                    />
                  </label>
                  <label className={authLabelClass}>
                    Пароль
                    <input
                      type="password"
                      className={authInputClass}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className={authLabelClass}>
                    Логин
                    <input
                      className={authInputClass}
                      value={login}
                      onChange={(event) => {
                        setLogin(event.target.value);
                        setLoginError(null);
                      }}
                      placeholder="pet_friend_01"
                    />
                    {loginError ? <span className={authErrorTextClass}>{loginError}</span> : null}
                  </label>
                  <label className={authLabelClass}>
                    Email
                    <input
                      className={authInputClass}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setEmailError(null);
                      }}
                      placeholder="user@example.com"
                    />
                    {emailError ? <span className={authErrorTextClass}>{emailError}</span> : null}
                  </label>
                  <label className={authLabelClass}>
                    Пароль
                    <input
                      type="password"
                      className={authInputClass}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••"
                    />
                  </label>
                  <label className={authLabelClass}>
                    Подтверждение пароля
                    <input
                      type="password"
                      className={authInputClass}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="••••••"
                    />
                  </label>
                  <div className="grid gap-3">
                    <label className={authCheckboxRowClass}>
                      <input
                        type="checkbox"
                        className={authCheckboxInputClass}
                        checked={acceptTerms}
                        onChange={(event) => setAcceptTerms(event.target.checked)}
                      />
                      <span>
                        Я принимаю{" "}
                        <a href="/about#agreement" className={authLinkClass}>
                          пользовательское соглашение
                        </a>
                      </span>
                    </label>
                    <label className={authCheckboxRowClass}>
                      <input
                        type="checkbox"
                        className={authCheckboxInputClass}
                        checked={acceptOffer}
                        onChange={(event) => setAcceptOffer(event.target.checked)}
                      />
                      <span>
                        Я принимаю{" "}
                        <a href="/about#offer" className={authLinkClass}>
                          публичную оферту
                        </a>
                      </span>
                    </label>
                  </div>
                </>
              )}

              <button type="submit" className={authPrimaryButtonClass} disabled={loading}>
                {loading
                  ? "Подождите..."
                  : mode === "login"
                    ? "Войти"
                    : "Создать аккаунт"}
              </button>

              {notice ? <div className={authNoticeClass}>{notice}</div> : null}
              <ErrorToast message={error} onClose={() => setError(null)} />
            </div>

            {mode === "login" ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setForgotPopupOpen(true)}
                  className={authTextButtonClass}
                >
                  Забыли пароль?
                </button>
              </div>
            ) : null}
          </div>
        </form>
      </div>

      {forgotPopupOpen ? (
        <div className={authDialogOverlayClass}>
          <div className={authDialogCardClass}>
            <div className={authDialogInnerClass}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className={authTitleClass}>Восстановление пароля</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotPopupOpen(false)}
                  className={authCloseButtonClass}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <div className={`mt-4 ${authInfoPanelClass}`}>
                Напишите на почту memorial@gamil.com письмо с адресом почты, на который был
                зарегистрирован аккаунт. Мы вышлем новый пароль в ответном письме.
              </div>
              <button
                type="button"
                onClick={() => setForgotPopupOpen(false)}
                className={`mt-5 ${authSecondaryButtonClass}`}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {consentOpen ? (
        <div className={authDialogOverlayClass}>
          <div className={authDialogCardClass}>
            <div className={authDialogInnerClass}>
              <h3 className={authTitleClass}>Подтвердите согласие с условиями</h3>
              <p className={`mt-3 ${authHelperTextClass}`}>
                Чтобы продолжить, примите пользовательское соглашение и публичную оферту.
              </p>
              <div className="mt-4 grid gap-3">
                <label className={authCheckboxRowClass}>
                  <input
                    type="checkbox"
                    className={authCheckboxInputClass}
                    checked={consentTerms}
                    onChange={(event) => setConsentTerms(event.target.checked)}
                  />
                  <span>
                    Я принимаю{" "}
                    <a href="/about#agreement" className={authLinkClass}>
                      пользовательское соглашение
                    </a>
                  </span>
                </label>
                <label className={authCheckboxRowClass}>
                  <input
                    type="checkbox"
                    className={authCheckboxInputClass}
                    checked={consentOffer}
                    onChange={(event) => setConsentOffer(event.target.checked)}
                  />
                  <span>
                    Я принимаю{" "}
                    <a href="/about#offer" className={authLinkClass}>
                      публичную оферту
                    </a>
                  </span>
                </label>
              </div>
              <button
                type="button"
                onClick={handleAcceptTerms}
                disabled={consentLoading || !consentTerms || !consentOffer}
                className={`mt-5 ${authPrimaryButtonClass}`}
              >
                {consentLoading ? "Подождите..." : "Согласен"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
