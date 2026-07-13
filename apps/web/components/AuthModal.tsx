"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/config";
import type { AuthUser } from "../lib/access";
import AuthHelpHint from "./AuthHelpHint";
import ErrorToast from "./ErrorToast";
import ForgotPasswordRequest from "./ForgotPasswordRequest";
import { useLanguage } from "./LanguageProvider";
import {
  authCardClass,
  authCheckboxInputClass,
  authCheckboxRowClass,
  authCloseButtonClass,
  authDialogCardClass,
  authDialogInnerClass,
  authDialogOverlayClass,
  authHelperTextClass,
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
const PASSWORD_REQUIREMENTS_PATTERN = /^(?=.*[A-Z])(?=.*[0-9])[A-Za-z0-9]+$/;

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

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggle,
  hint
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  hint?: ReactNode;
}) {
  return (
    <label className={authLabelClass}>
      {hint ? (
        <span className="flex items-center justify-between gap-3">
          <span>{label}</span>
          {hint}
        </span>
      ) : (
        label
      )}
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          className={`${authInputClass} pr-12`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="••••••"
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

function LegalConsentText() {
  return (
    <span>
      Я ознакомлен(а) с{" "}
      <a href="/politics" className={authLinkClass} target="_blank" rel="noreferrer">
        Политикой конфиденциальности
      </a>{" "}
      и даю согласие на обработку моих персональных данных в соответствии с
      ней. Также принимаю{" "}
      <a href="/offer" className={authLinkClass} target="_blank" rel="noreferrer">
        Публичную оферту
      </a>
      .
    </span>
  );
}

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
  const { t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCodeLoading, setEmailCodeLoading] = useState(false);
  const [emailCodeDialogOpen, setEmailCodeDialogOpen] = useState(false);
  const [emailCodeCooldown, setEmailCodeCooldown] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setEmailError] = useState<string | null>(null);
  const [, setLoginError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptOffer, setAcceptOffer] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentOffer, setConsentOffer] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setMode("login");
      setForgotMode(false);
      setIdentifier("");
      setLogin("");
      setEmail("");
      setEmailCode("");
      setEmailCodeSent(false);
      setEmailCodeLoading(false);
      setEmailCodeDialogOpen(false);
      setEmailCodeCooldown(0);
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
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
    if (consentOpen || emailCodeDialogOpen) {
      return;
    }
    onClose();
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !consentOpen && !emailCodeDialogOpen) {
        handleClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, consentOpen, emailCodeDialogOpen]);

  useEffect(() => {
    if (!emailCodeDialogOpen || emailCodeCooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setEmailCodeCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailCodeDialogOpen, emailCodeCooldown]);

  const parseApiError = async (response: Response) => {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(parsed?.message)) {
        message = parsed.message.join(", ");
      } else if (parsed?.message) {
        message = parsed.message;
      }
    } catch {
      // ignore
    }
    return message;
  };

  const validateRegisterFields = (requireCode: boolean) => {
    if (!login.trim()) {
      const message = "Введите логин";
      setLoginError(message);
      setError(message);
      return false;
    }
    if (!email.trim()) {
      const message = "Введите email";
      setEmailError(message);
      setError(message);
      return false;
    }
    if (!/^[A-Za-z0-9_]+$/.test(login.trim())) {
      const message = "Логин: только A-Z, a-z, 0-9 и _";
      setLoginError(message);
      setError(message);
      return false;
    }
    if (!email.includes("@")) {
      const message = "Укажите корректный email";
      setEmailError(message);
      setError(message);
      return false;
    }
    if (!acceptTerms || !acceptOffer) {
      setError("Нужно принять политику обработки персональных данных и публичную оферту");
      return false;
    }
    if (password.trim().length < 6) {
      setError("Пароль должен быть минимум 6 символов");
      return false;
    }
    if (!PASSWORD_REQUIREMENTS_PATTERN.test(password.trim())) {
      setError("Пароль: только латинские буквы и цифры, минимум одна заглавная буква и одна цифра");
      return false;
    }
    if (password.trim() !== confirmPassword.trim()) {
      setError("Пароли не совпадают");
      return false;
    }
    if (requireCode && !/^[0-9]{6}$/.test(emailCode.trim())) {
      setError(
        emailCodeSent
          ? "Введите 6 цифр из письма"
          : "Сначала отправьте код подтверждения на email",
      );
      return false;
    }
    return true;
  };

  const handleSendEmailCode = async () => {
    if (emailCodeLoading || loading) {
      return;
    }
    setError(null);
    setEmailError(null);
    setLoginError(null);
    setNotice(null);
    if (!validateRegisterFields(false)) {
      return;
    }
    setEmailCodeLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          login: login.trim(),
          email: email.trim()
        })
      });
      if (!response.ok) {
        const message = await parseApiError(response);
        if (message.toLowerCase().includes("логин")) {
          setLoginError(message);
        } else if (message.toLowerCase().includes("email")) {
          setEmailError(message);
        }
        setError(message || "Не удалось отправить код");
        return;
      }
      setEmailCodeSent(true);
      setEmailCode("");
      setEmailCodeCooldown(60);
      setNotice("Код подтверждения отправлен на email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код");
    } finally {
      setEmailCodeLoading(false);
    }
  };

  const handleRegisterWithCode = async () => {
    if (loading || !validateRegisterFields(true)) {
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          login: login.trim(),
          email: email.trim(),
          password: password.trim(),
          emailCode: emailCode.trim(),
          acceptTerms,
          acceptOffer
        })
      });

      if (!response.ok) {
        const message = await parseApiError(response);
        if (message.toLowerCase().includes("логин")) {
          setLoginError(message);
        } else if (message.toLowerCase().includes("email")) {
          setEmailError(message);
        }
        setError(message || "Ошибка регистрации");
        return;
      }

      const payload = (await response.json()) as AuthUser;
      setEmailCodeDialogOpen(false);
      window.dispatchEvent(new Event("memorial-auth-changed"));
      setNotice(successRedirect ? "Готово! Перенаправляем..." : "Готово!");
      onSuccess?.(payload);
      if (successRedirect) {
        router.push(successRedirect);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

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
      if (password.trim().length < 6) {
        setError("Пароль должен быть минимум 6 символов");
        return;
      }
    } else {
      if (!validateRegisterFields(false)) {
        return;
      }
      setEmailCodeDialogOpen(true);
      if (!emailCodeSent && emailCodeCooldown === 0) {
        void handleSendEmailCode();
      }
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: identifier.trim(),
          password: password.trim(),
        }),
      });

      if (!response.ok) {
        const message = await parseApiError(response);
        setError(message || "Ошибка авторизации");
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
      window.dispatchEvent(new Event("memorial-auth-changed"));
      setNotice(successRedirect ? "Готово! Перенаправляем..." : "Готово!");
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

  const setRegisterConsent = (checked: boolean) => {
    setAcceptTerms(checked);
    setAcceptOffer(checked);
  };

  const setLoginConsent = (checked: boolean) => {
    setConsentTerms(checked);
    setConsentOffer(checked);
  };

  const handleAcceptTerms = async () => {
    if (!consentTerms || !consentOffer) {
      setError("Нужно принять политику обработки персональных данных и публичную оферту");
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
      window.dispatchEvent(new Event("memorial-auth-changed"));
      setNotice(successRedirect ? "Готово! Перенаправляем..." : "Готово!");
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

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto px-2 py-2 transition-opacity duration-200 sm:px-4 sm:py-6 ${
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
        className={`relative max-h-[calc(100dvh-0.5rem)] w-full max-w-[min(30rem,calc(100vw-0.5rem))] overflow-y-auto overflow-x-visible overscroll-contain rounded-[24px] transition-transform duration-200 sm:max-h-[calc(100dvh-3rem)] sm:max-w-[min(32rem,calc(100vw-1rem))] sm:rounded-[38px] ${
          visible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
        }`}
      >
        <div className={authCardClass}>
          <div className={authInnerShellClass}>
            <div className="flex items-start justify-between gap-3 sm:gap-4">
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
                <div className={`mt-3 sm:mt-5 ${authTabsRailClass}`}>
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

                <form
                  className={`${
                    showGuestCreate
                      ? "mt-3 grid gap-2.5 sm:mt-4 sm:gap-3"
                      : "mt-4 grid gap-3 sm:mt-5 sm:gap-4"
                  }`}
                  onSubmit={handleSubmitEvent}
                >
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
                      <PasswordInput
                        label="Пароль"
                        value={password}
                        onChange={setPassword}
                        visible={showPassword}
                        onToggle={() => setShowPassword((prev) => !prev)}
                      />
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
                      </label>
                      <label className={authLabelClass}>
                        Email
                        <input
                          className={authInputClass}
	                          value={email}
	                          onChange={(event) => {
	                            setEmail(event.target.value);
		                            setEmailError(null);
		                            setEmailCode("");
		                            setEmailCodeSent(false);
		                            setEmailCodeCooldown(0);
		                          }}
                          placeholder="user@example.com"
                        />
                      </label>
                      <PasswordInput
                        label="Пароль"
                        value={password}
                        onChange={setPassword}
                        visible={showPassword}
                        onToggle={() => setShowPassword((prev) => !prev)}
	                        hint={<AuthHelpHint text="Минимум 6 символов. Только латинские буквы и цифры. Нужна хотя бы одна заглавная буква и одна цифра от 0 до 9." />}
                      />
                      <PasswordInput
                        label="Подтверждение пароля"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        visible={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword((prev) => !prev)}
                      />
                      <label className={authCheckboxRowClass}>
                        <input
                          type="checkbox"
                          className={authCheckboxInputClass}
                          checked={acceptTerms && acceptOffer}
                          onChange={(event) => setRegisterConsent(event.target.checked)}
	                        />
	                        <LegalConsentText />
		                      </label>
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
                  <div className="mt-2.5 rounded-[18px] border-2 border-white bg-[#f7f1ee] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:mt-3 sm:rounded-[20px] sm:border-[3px] sm:p-2.5">
	                    <div className="mb-2 flex items-center justify-center gap-2">
	                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8d6e63]">
	                        {t("auth.guestSection")}
	                      </p>
	                      <AuthHelpHint
	                        className="h-6 w-6 border-2 text-[10px]"
	                        placement="top"
	                        text={t("auth.guestHint")}
	                      />
                    </div>
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center rounded-[16px] border-[3px] border-white bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#5d4037] shadow-[0_12px_26px_-18px_rgba(93,64,55,0.55)] transition hover:-translate-y-0.5 hover:bg-[#fffaf6]"
                      onClick={onGuestCreate}
                    >
                      {t("home.createGuest")}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <ForgotPasswordRequest onBack={() => setForgotMode(false)} />
            )}

            {notice ? <div className={`mt-3 sm:mt-4 ${authNoticeClass}`}>{notice}</div> : null}
            <ErrorToast message={error} onClose={() => setError(null)} />
          </div>
        </div>
      </div>
      {emailCodeDialogOpen ? (
        <div className={authDialogOverlayClass}>
          <div className={authDialogCardClass}>
            <div className={authDialogInnerClass}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={authTitleClass}>Подтверждение email</h3>
                    <AuthHelpHint
                      placement="top"
                      className="[&>span]:!fixed [&>span]:!bottom-auto [&>span]:!right-auto [&>span]:!left-1/2 [&>span]:!top-[max(1rem,calc(env(safe-area-inset-top)+1rem))] [&>span]:!z-[3000] [&>span]:!w-[min(20rem,calc(100vw-2rem))] [&>span]:!-translate-x-1/2 [&>span]:!translate-y-0"
                      text="Код действует 10 минут. Если письмо не пришло во Входящие, проверьте папку Спам на почте."
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-[#8d6e63]">
                    Код отправлен на {email.trim() || "указанный email"}. Если
                    письма нет во Входящих, проверьте папку Спам.
                  </p>
                </div>
                <button
                  type="button"
                  className={authCloseButtonClass}
                  onClick={() => setEmailCodeDialogOpen(false)}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <form
                className="mt-4 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleRegisterWithCode();
                }}
              >
                <label className={authLabelClass}>
                  Код из письма
                  <input
                    className={`${authInputClass} text-center tracking-[0.3em]`}
                    value={emailCode}
                    onChange={(event) =>
                      setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                  />
                </label>
                <button type="submit" className={authPrimaryButtonClass} disabled={loading}>
                  {loading ? "Проверяем..." : "Подтвердить и создать"}
                </button>
                <button
                  type="button"
                  onClick={handleSendEmailCode}
                  disabled={emailCodeLoading || loading || emailCodeCooldown > 0}
                  className="inline-flex w-full items-center justify-center rounded-[15px] border-2 border-white bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#5d4037] shadow-[0_2px_0_0_#eadfd9] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                >
                  {emailCodeLoading
                    ? "Отправляем..."
                    : emailCodeCooldown > 0
                      ? `Отправить код через ${emailCodeCooldown} с`
                      : "Отправить код"}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
      {consentOpen ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#111827]/30 px-4 py-6 backdrop-blur-md">
          <div className={authDialogCardClass}>
            <div className={authDialogInnerClass}>
              <h3 className={authTitleClass}>Подтвердите согласие с условиями</h3>
              <p className={`mt-3 ${authHelperTextClass}`}>
                Чтобы продолжить, примите политику обработки персональных данных и публичную оферту.
              </p>
              <label className={`mt-4 ${authCheckboxRowClass}`}>
                <input
                  type="checkbox"
                  className={authCheckboxInputClass}
                  checked={consentTerms && consentOffer}
                  onChange={(event) => setLoginConsent(event.target.checked)}
                />
                <LegalConsentText />
              </label>
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
    </div>,
    document.body
  );
}
