"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { API_BASE } from "../lib/config";
import ErrorToast from "./ErrorToast";
import {
  authInfoPanelClass,
  authInputClass,
  authLabelClass,
  authNoticeClass,
  authPrimaryButtonClass,
  authTextButtonClass
} from "./authTheme";

type ForgotPasswordRequestProps = {
  onBack: () => void;
};

const parseErrorMessage = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return "Не удалось отправить письмо";
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
    // Use the raw response text below.
  }
  return text;
};

export default function ForgotPasswordRequest({ onBack }: ForgotPasswordRequestProps) {
  const apiUrl = useMemo(() => API_BASE, []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) {
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    setNotice(null);
    setError(null);
    if (!normalizedEmail) {
      setError("Введите email аккаунта");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Укажите корректный email");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: normalizedEmail })
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      setNotice(
        "Если аккаунт с такой почтой есть, мы отправили ссылку для сброса пароля. Проверьте входящие и спам."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить письмо");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mt-4 grid gap-3 sm:mt-5 sm:gap-4" onSubmit={handleSubmit}>
      <div className={authInfoPanelClass}>
        Введите email аккаунта. Мы отправим ссылку, по которой можно задать новый пароль.
        Ссылка действует 1 час.
      </div>
      <label className={authLabelClass}>
        Email аккаунта
        <input
          className={authInputClass}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="user@example.com"
        />
      </label>
      <button type="submit" className={authPrimaryButtonClass} disabled={loading}>
        {loading ? "Отправляем..." : "Отправить ссылку"}
      </button>
      <button type="button" onClick={onBack} className={`text-left ${authTextButtonClass}`}>
        Назад к входу
      </button>
      {notice ? <div className={authNoticeClass}>{notice}</div> : null}
      <ErrorToast message={error} onClose={() => setError(null)} />
    </form>
  );
}
