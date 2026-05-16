"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/config";
import type { AuthUser } from "../lib/access";
import AuthHelpHint from "./AuthHelpHint";
import ErrorToast from "./ErrorToast";
import {
  authCardClass,
  authCheckboxInputClass,
  authCheckboxRowClass,
  authCloseButtonClass,
  authDialogCardClass,
  authDialogInnerClass,
  authErrorTextClass,
  authHelperTextClass,
  authInfoPanelClass,
  authInnerShellClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authNoticeClass,
  authPrimaryButtonClass,
  authTabClass,
  authTabsRailClass,
  authTextButtonClass,
  authTitleClass
} from "./authTheme";

type AuthMode = "login" | "register";

type AuthModalProps = {
  open: boolean;
  visible: boolean;
  onClose: () => void;
  onSuccess?: (user: AuthUser) => void;
  title?: string;
  helperText?: string;
  successRedirect?: string | null;
  showGuestCreate?: boolean;
  onGuestCreate?: () => void;
};

export default function AuthModal({
  open,
  visible,
  onClose,
  onSuccess,
  title,
  helperText,
  successRedirect = "/profile",
  showGuestCreate = false,
  onGuestCreate
}: AuthModalProps) {
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
    if (loading) {
      return;
    }
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
      if (!/^[A-Za-z0-9_]+$/.test(login.trim())) {
        setLoginError("Логин: только A-Z, a-z, 0-9 и _");
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
                  login: login.trim(),
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
      if (successRedirect) {
        router.push(successRedirect);
      }
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
      if (successRedirect) {
        router.push(successRedirect);
      }
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
      className={`fixed inset-0 z-[1000] flex items-center justify-center px-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 cursor-default bg-[#111827]/30 backdrop-blur-md"
        onClick={handleClose}
      />
      <div
        className={`relative w-full max-w-[32rem] transition-transform duration-200 ${
          visible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
        }`}
      >
        <div className={authCardClass}>
          <div className={authInnerShellClass}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className={authTitleClass}>
                  {forgotMode ? "Восстановление пароля" : title ?? "Вход и регистрация"}
                </h2>
                {!forgotMode && helperText ? (
                  <p className={`mt-2 ${authHelperTextClass}`}>{helperText}</p>
                ) : null}
              </div>
              <button
                type="button"
                className={authCloseButtonClass}
                onClick={handleClose}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            {!forgotMode ? (
              <>
                <div className={`mt-5 ${authTabsRailClass}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setForgotMode(false);
                    }}
                    className={authTabClass(mode === "login")}
                  >
                    Вход
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setForgotMode(false);
                    }}
                    className={authTabClass(mode === "register")}
                  >
                    Регистрация
                  </button>
                </div>

                <form className="mt-5 grid gap-4" onSubmit={handleSubmitEvent}>
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
                        <span className="flex items-center justify-between gap-3">
                          <span>Логин</span>
                          <AuthHelpHint text="От 3 до 30 символов. Можно использовать латинские буквы A-Z и a-z, цифры 0-9 и подчёркивание _." />
                        </span>
                        <input
                          className={authInputClass}
                          value={login}
                          onChange={(event) => {
                            setLogin(event.target.value);
                            setLoginError(null);
                          }}
                          placeholder="Pet_Friend_01"
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
                        <span className="flex items-center justify-between gap-3">
                          <span>Пароль</span>
                          <AuthHelpHint text="Минимум 6 символов. Пароль чувствителен к регистру, поэтому заглавные и строчные буквы считаются разными." />
                        </span>
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
                            <a href="/terms" className={authLinkClass}>
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
                            <a href="/offer" className={authLinkClass}>
                              публичную оферту
                            </a>
                          </span>
                        </label>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    className={authPrimaryButtonClass}
                    disabled={loading}
                  >
                    {loading
                      ? "Подождите..."
                      : mode === "login"
                        ? "Войти"
                        : "Зарегистрироваться"}
                  </button>

                  {mode === "login" ? (
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className={`text-left ${authTextButtonClass}`}
                    >
                      Забыли пароль?
                    </button>
                  ) : null}
                </form>
                {showGuestCreate ? (
                  <div className="mt-4 grid gap-3 rounded-[22px] border-[3px] border-white bg-[#f7f1ee] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-white text-[11px] font-black text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)]">
                        ?
                      </span>
                      <p className="text-xs font-bold leading-relaxed text-[#6f6360]">
                        Можно собрать мемориал без входа. Сохранить и опубликовать его получится в конце после входа или регистрации.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center rounded-[18px] border-[3px] border-white bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#5d4037] shadow-[0_12px_26px_-18px_rgba(93,64,55,0.55)] transition hover:-translate-y-0.5 hover:bg-[#fffaf6]"
                      onClick={onGuestCreate}
                    >
                      Создать без входа
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-5 grid gap-4">
                <div className={authInfoPanelClass}>
                  Напишите на почту memorial@gamil.com письмо с адресом почты, на который был
                  зарегистрирован аккаунт. Мы вышлем новый пароль в ответном письме.
                </div>
                <button
                  type="button"
                  onClick={() => setForgotMode(false)}
                  className={`text-left ${authTextButtonClass}`}
                >
                  Назад к входу
                </button>
              </div>
            )}

            {notice ? <div className={`mt-4 ${authNoticeClass}`}>{notice}</div> : null}
            <ErrorToast message={error} onClose={() => setError(null)} />
          </div>
        </div>
      </div>
      {consentOpen ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#111827]/30 px-4 py-6 backdrop-blur-md">
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
                    <a href="/terms" className={authLinkClass}>
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
                    <a href="/offer" className={authLinkClass}>
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
