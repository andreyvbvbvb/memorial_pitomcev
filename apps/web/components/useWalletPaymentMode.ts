import { useEffect, useState } from "react";
import { API_BASE } from "../lib/config";

export type WalletPaymentMode = {
  usdEnabled: boolean;
};

export type WalletTopUpCurrency = "RUB" | "USD";

const DEFAULT_WALLET_PAYMENT_MODE: WalletPaymentMode = {
  usdEnabled: false,
};

export const WALLET_TOP_UP_CURRENCIES = ["RUB", "USD"] as const;

export const isWalletCurrencyDisabled = (
  currency: WalletTopUpCurrency,
  mode: WalletPaymentMode,
) => currency === "USD" && !mode.usdEnabled;

export function useWalletPaymentMode(apiUrl = API_BASE) {
  const [mode, setMode] = useState<WalletPaymentMode>(
    DEFAULT_WALLET_PAYMENT_MODE,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadMode = async () => {
      try {
        const response = await fetch(`${apiUrl}/pricing/wallet-payment-mode`);
        if (!response.ok) {
          throw new Error("Wallet payment mode is unavailable");
        }
        const data = (await response.json()) as Partial<WalletPaymentMode>;
        if (!cancelled) {
          setMode({ usdEnabled: data.usdEnabled === true });
        }
      } catch {
        if (!cancelled) {
          setMode(DEFAULT_WALLET_PAYMENT_MODE);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };
    void loadMode();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return { ...mode, loaded };
}
