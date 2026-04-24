"use client";

import { useEffect, useState } from "react";

type Props = {
  message?: string | null;
  onClose?: () => void;
  durationMs?: number;
  offset?: number;
  variant?: "error" | "success";
};

export default function ErrorToast({
  message,
  onClose,
  durationMs = 4000,
  offset = 0,
  variant = "error"
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs]);

  useEffect(() => {
    if (!message) {
      return;
    }
    if (visible) {
      return;
    }
    const timer = window.setTimeout(() => onClose?.(), 220);
    return () => window.clearTimeout(timer);
  }, [visible, message, onClose]);

  if (!message) {
    return null;
  }

  const shellClass =
    variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-red-200 bg-red-50 text-red-700";
  const closeClass =
    variant === "success"
      ? "text-emerald-600 hover:bg-emerald-100"
      : "text-red-600 hover:bg-red-100";

  return (
    <div
      className={`fixed right-6 z-[999] max-w-[320px] transition-all duration-200 ${
        visible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
      }`}
      style={{ bottom: 24 + offset }}
    >
      <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ${shellClass}`}>
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className={`flex h-6 w-6 items-center justify-center rounded-full ${closeClass}`}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
    </div>
  );
}
