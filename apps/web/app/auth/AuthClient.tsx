"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/config";
import AuthHelpHint from "../../components/AuthHelpHint";
import ErrorToast from "../../components/ErrorToast";
import ForgotPasswordRequest from "../../components/ForgotPasswordRequest";
import {
  authBackdropGlowClass,
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
  authPageShellClass,
  authPrimaryButtonClass,
  authTabClass,
  authTabsRailClass,
  authTextButtonClass,
  authTitleClass
} from "../../components/authTheme";

const PASSWORD_REQUIREMENTS_PATTERN = /^(?=.*[A-Z])(?=.*[0-9])[A-Za-z0-9]+$/;

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

export default function AuthClient() {
  const [mode, setMode] = useState<"login" | "register">("login");
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
  const [forgotPopupOpen, setForgotPopupOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptOffer, setAcceptOffer] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentOffer, setConsentOffer] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/profile");

  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      setRedirectPath(next);
    }
  }, []);

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
    if (!acceptTerms || !acceptOffer) {
      setError("Нужно принять политику обработки персональных данных и публичную оферту");
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

      setEmailCodeDialogOpen(false);
      setNotice("Готово! Перенаправляем...");
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

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
        body: JSON.stringify({ email: identifier.trim(), password: password.trim() })
      });
      if (!response.ok) {
        const message = await parseApiError(response);
        setError(message || "Ошибка авторизации");
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
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
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
      setConsentOpen(false);
      setNotice("Готово! Перенаправляем...");
      router.push(redirectPath);
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

  const setRegisterConsent = (checked: boolean) => {
    setAcceptTerms(checked);
    setAcceptOffer(checked);
  };

  const setLoginConsent = (checked: boolean) => {
    setConsentTerms(checked);
    setConsentOffer(checked);
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
              <ForgotPasswordRequest onBack={() => setForgotPopupOpen(false)} />
            </div>
          </div>
        </div>
	      ) : null}

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
	                      text="Код действует 10 минут. Если письмо не пришло во Входящие, проверьте папку Спам на почте."
	                    />
	                  </div>
	                  <p className="mt-2 text-xs font-semibold leading-relaxed text-[#8d6e63]">
	                    Код отправлен на {email.trim() || "указанный email"}.
	                  </p>
	                </div>
	                <button
	                  type="button"
	                  onClick={() => setEmailCodeDialogOpen(false)}
	                  className={authCloseButtonClass}
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
        <div className={authDialogOverlayClass}>
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
    </div>
  );
}
