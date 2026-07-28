"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "../../lib/config";
import {
  isWalletCurrencyDisabled,
  useWalletPaymentMode,
} from "../../components/useWalletPaymentMode";

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
    800: 399,
    2000: 1799,
  },
  USD: {
    100: 1.49,
    300: 3.99,
    800: 4.99,
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
  const walletPaymentMode = useWalletPaymentMode(apiUrl);
  const coins = Number(searchParams.get("coins") ?? "0");
  const currencyParam = (searchParams.get("currency") ?? "RUB").toUpperCase();
  const currency = isAllowedCurrency(currencyParam) ? currencyParam : "RUB";
  const validPlan = isAllowedCoins(coins);
  const amount = validPlan ? PAYMENT_PLANS[currency][coins] : null;
  const currencyDisabled = isWalletCurrencyDisabled(currency, walletPaymentMode);

  const [user, setUser] = useState<UserResponse | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [successDialog, setSuccessDialog] = useState<{
    coins: number;
    balance: number | null;
  } | null>(null);

  const refreshUser = useCallback(async () => {
    const response = await fetch(`${apiUrl}/auth/me`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as UserResponse;
    setUser(data);
    return data;
  }, [apiUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store",
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
          const refreshedUser = await refreshUser().catch(() => null);
          const refreshedBalance =
            typeof refreshedUser?.coinBalance === "number"
              ? refreshedUser.coinBalance
              : typeof user?.coinBalance === "number"
                ? user.coinBalance + data.coins
                : null;
          window.dispatchEvent(new Event("memorial-auth-changed"));
          setSuccessDialog({ coins: data.coins, balance: refreshedBalance });
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
    return false;
  };

  const startPayment = async () => {
    if (!validPlan || loading) {
      return;
    }
    if (currencyDisabled) {
      setError("Платежи в USD временно в разработке.");
      return;
    }
    if (!user) {
      setError("Для пополнения баланса нужно войти");
      return;
    }
    setLoading(true);
    setError(null);
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

  if (currency === "USD" && !walletPaymentMode.loaded) {
    return (
      <PaymentShell>
        <div className="text-sm font-black uppercase tracking-[0.22em] text-[#8d6e63]">
          Проверяем доступность валюты
        </div>
      </PaymentShell>
    );
  }

  if (currencyDisabled) {
    return (
      <PaymentShell>
        <h1 className="text-3xl font-black text-[#5d4037]">
          USD в разработке
        </h1>
        <p className="mt-4 text-[#8d6e63]">
          Оплата в долларах временно недоступна. Сейчас можно пополнить баланс
          в рублях.
        </p>
        <button
          className="mt-8 rounded-full bg-[#111827] px-8 py-4 text-sm font-black uppercase tracking-[0.22em] text-white"
          onClick={() => router.replace(`/payment?coins=${coins}&currency=RUB`)}
        >
          Перейти на RUB
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
        {error ? (
          <div className="mt-5 rounded-2xl border border-[#f2c6bd] bg-[#fff5f2] px-4 py-3 text-sm font-bold text-[#9a5a4c]">
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
      {successDialog ? (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center bg-[#3b2a24]/35 px-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-success-title"
        >
          <section className="w-full max-w-sm rounded-[30px] bg-white p-3 shadow-[0_32px_90px_-36px_rgba(17,24,39,0.7)]">
            <div className="rounded-[22px] bg-[#f7f1ee] px-5 py-6 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3bceac]">
                Оплата прошла
              </p>
              <h2
                id="payment-success-title"
                className="mt-2 text-balance text-2xl font-black leading-tight text-[#5d4037]"
              >
                Баланс успешно пополнен
              </h2>
              <div className="mt-5 rounded-[20px] bg-white px-4 py-4 shadow-[0_14px_32px_-26px_rgba(93,64,55,0.55)]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8d6e63]">
                  Текущий баланс
                </p>
                <p className="mt-1 text-4xl font-black tabular-nums text-[#111827]">
                  {successDialog.balance ?? "—"}
                </p>
                <p className="mt-1 text-sm font-bold text-[#8d6e63]">
                  монет
                </p>
              </div>
              <p className="mt-4 text-sm font-bold text-[#8d6e63]">
                Пополнение: +{successDialog.coins} монет
              </p>
              <button
                type="button"
                onClick={() => setSuccessDialog(null)}
                className="mt-6 min-h-11 w-full rounded-full bg-[#111827] px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_8px_0_rgba(17,24,39,0.18)] transition-transform active:scale-[0.96]"
              >
                Закрыть
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
