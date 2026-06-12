"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "../../lib/config";

type UserResponse = {
  id: string;
  email: string;
  login?: string | null;
  coinBalance?: number;
};

type PaymentOrderResponse = {
  ok: true;
  publicId: string;
  invoiceId: string;
  accountId: string;
  email: string;
  amount: number;
  currency: "RUB" | "USD";
  coins: number;
  description: string;
  receipt: Record<string, unknown>;
};

type PaymentStatusResponse = {
  invoiceId: string;
  status: string;
  coins: number;
  amount: number;
  currency: string;
  paidAt?: string | null;
};

type CloudPaymentsWidget = {
  oncomplete?: (result: unknown) => void;
  start: (options: Record<string, unknown>) => Promise<unknown>;
};

declare global {
  interface Window {
    cp?: {
      CloudPayments: new () => CloudPaymentsWidget;
    };
  }
}

const PAYMENT_PLANS = {
  RUB: {
    100: 99,
    300: 299,
    800: 699,
    2000: 1799,
  },
  USD: {
    100: 1.49,
    300: 4.49,
    800: 9.99,
    2000: 22.99,
  },
} as const;

const allowedCoins = [100, 300, 800, 2000] as const;
const allowedCurrencies = ["RUB", "USD"] as const;
const widgetUrl = "https://widget.cloudpayments.ru/bundles/cloudpayments.js";

function isAllowedCoins(value: number): value is (typeof allowedCoins)[number] {
  return allowedCoins.some((item) => item === value);
}

function isAllowedCurrency(
  value: string,
): value is (typeof allowedCurrencies)[number] {
  return allowedCurrencies.some((item) => item === value);
}

function loadCloudPaymentsWidget() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Widget is available only in browser"));
  }
  if (window.cp?.CloudPayments) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${widgetUrl}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Не удалось загрузить виджет оплаты")),
        {
          once: true,
        },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = widgetUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Не удалось загрузить виджет оплаты"));
    document.body.appendChild(script);
  });
}

export default function PaymentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiUrl = useMemo(() => API_BASE, []);
  const coins = Number(searchParams.get("coins") ?? "0");
  const currencyParam = (searchParams.get("currency") ?? "RUB").toUpperCase();
  const currency = isAllowedCurrency(currencyParam) ? currencyParam : "RUB";
  const validPlan = isAllowedCoins(coins);
  const amount = validPlan ? PAYMENT_PLANS[currency][coins] : null;

  const [user, setUser] = useState<UserResponse | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Подготовьте оплату, затем подтвердите её в окне банка.",
  );
  const [error, setError] = useState<string | null>(null);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) {
          if (!cancelled) {
            setUser(null);
          }
          return;
        }
        const data = (await response.json()) as UserResponse;
        if (!cancelled) {
          setUser(data);
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    }
    loadUser();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const pollPaymentStatus = async (invoiceId: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(
        `${apiUrl}/wallet/payments/${encodeURIComponent(invoiceId)}`,
        {
          credentials: "include",
        },
      );
      if (response.ok) {
        const data = (await response.json()) as PaymentStatusResponse;
        if (data.status === "paid") {
          window.dispatchEvent(new Event("memorial-auth-changed"));
          setMessage(`Баланс пополнен на ${data.coins} монет.`);
          return true;
        }
        if (data.status === "failed") {
          setError(
            "Платёж отклонён. Попробуйте ещё раз или выберите другой способ оплаты.",
          );
          return false;
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
    }
    setError(
      "Платёж не завершён. Если вы закрыли окно оплаты, деньги не списаны и баланс не изменился.",
    );
    setMessage("Можно открыть оплату ещё раз или выбрать другой способ.");
    return false;
  };

  const startPayment = async () => {
    if (!validPlan || loading) {
      return;
    }
    if (!user) {
      setError("Для пополнения баланса нужно войти");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage("Создаем платеж и открываем защищенное окно оплаты.");
    try {
      const orderResponse = await fetch(
        `${apiUrl}/wallet/payments/cloudpayments`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coins, currency }),
        },
      );
      const orderData = await orderResponse.json().catch(() => null);
      if (!orderResponse.ok) {
        throw new Error(orderData?.message ?? "Не удалось создать платеж");
      }
      const order = orderData as PaymentOrderResponse;
      setCurrentInvoiceId(order.invoiceId);
      await loadCloudPaymentsWidget();
      if (!window.cp?.CloudPayments) {
        throw new Error("Виджет CloudPayments не загрузился");
      }
      const widget = new window.cp.CloudPayments();
      await widget.start({
        publicId: order.publicId,
        publicTerminalId: order.publicId,
        description: order.description,
        paymentSchema: "Single",
        amount: order.amount,
        currency: order.currency,
        culture: "ru-RU",
        skin: "classic",
        invoiceId: order.invoiceId,
        externalId: order.invoiceId,
        accountId: order.accountId,
        email: order.email,
        receiptEmail: order.email,
        receipt: order.receipt,
        userInfo: {
          accountId: order.accountId,
          email: order.email,
        },
        metadata: {
          userId: order.accountId,
          coins: order.coins,
        },
        data: {
          CloudPayments: {
            CustomerReceipt: order.receipt,
          },
          userId: order.accountId,
          coins: order.coins,
        },
        retryPayment: false,
        emailBehavior: "Optional",
      });
      setMessage("Окно оплаты закрыто. Проверяем статус платежа.");
      setError(null);
      void pollPaymentStatus(order.invoiceId);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Не удалось открыть оплату",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!validPlan) {
    return (
      <PaymentShell>
        <h1 className="text-3xl font-black text-[#5d4037]">Тариф не найден</h1>
        <p className="mt-4 text-[#8d6e63]">
          Выберите пополнение из окна баланса.
        </p>
        <button
          className="mt-8 rounded-full bg-[#111827] px-8 py-4 text-sm font-black uppercase tracking-[0.22em] text-white"
          onClick={() => router.back()}
        >
          Назад
        </button>
      </PaymentShell>
    );
  }

  if (!authChecked) {
    return (
      <PaymentShell>
        <div className="text-sm font-black uppercase tracking-[0.22em] text-[#8d6e63]">
          Проверяем вход
        </div>
      </PaymentShell>
    );
  }

  if (!user) {
    const next = `/payment?coins=${coins}&currency=${currency}`;
    return (
      <PaymentShell>
        <h1 className="text-3xl font-black text-[#5d4037]">Нужно войти</h1>
        <p className="mt-4 text-[#8d6e63]">
          Пополнение баланса доступно только авторизованным пользователям.
        </p>
        <button
          className="mt-8 rounded-full bg-[#111827] px-8 py-4 text-sm font-black uppercase tracking-[0.22em] text-white"
          onClick={() => router.push(`/auth?next=${encodeURIComponent(next)}`)}
        >
          Войти
        </button>
      </PaymentShell>
    );
  }

  return (
    <PaymentShell>
      <div className="mx-auto max-w-xl text-center">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#8d6e63]">
          Пополнение баланса
        </p>
        <h1 className="mt-3 text-4xl font-black text-[#5d4037]">
          {coins} монет
        </h1>
        <div className="mt-5 rounded-[26px] border border-white bg-[#f7f1ee] px-5 py-4 text-[#6d4c41]">
          <div className="text-sm font-bold">К оплате</div>
          <div className="mt-1 text-3xl font-black">
            {amount} {currency}
          </div>
        </div>
        <p className="mt-5 text-sm font-bold leading-relaxed text-[#8d6e63]">
          {message}
        </p>
        {error ? (
          <div className="mt-4 rounded-2xl border border-[#f2c6bd] bg-[#fff5f2] px-4 py-3 text-sm font-bold text-[#9a5a4c]">
            {error}
          </div>
        ) : null}
        <button
          className="mt-7 w-full rounded-full bg-[#111827] px-8 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-[0_10px_0_rgba(17,24,39,0.22)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
          onClick={startPayment}
          disabled={loading}
        >
          {loading ? "Открываем оплату" : "Оплатить"}
        </button>
        {currentInvoiceId ? (
          <div className="mt-5 text-xs font-bold text-[#b0a29c]">
            Номер платежа: {currentInvoiceId}
          </div>
        ) : null}
      </div>
    </PaymentShell>
  );
}

function PaymentShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f1ee] px-4 py-10 text-[#5d4037]">
      <section className="w-full max-w-2xl rounded-[34px] border-[6px] border-white bg-white/88 p-5 shadow-[0_24px_70px_rgba(93,64,55,0.18)] sm:p-8">
        {children}
      </section>
    </main>
  );
}
