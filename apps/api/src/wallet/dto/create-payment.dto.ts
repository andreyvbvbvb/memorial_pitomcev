import { IsIn, IsInt } from "class-validator";

export const WALLET_TOP_UP_COINS = [100, 300, 800, 2000] as const;
export type WalletTopUpCoins = (typeof WALLET_TOP_UP_COINS)[number];

export const WALLET_TOP_UP_CURRENCIES = ["RUB", "USD"] as const;
export type WalletTopUpCurrency = (typeof WALLET_TOP_UP_CURRENCIES)[number];

export class CreatePaymentDto {
  @IsInt()
  @IsIn(WALLET_TOP_UP_COINS)
  coins!: WalletTopUpCoins;

  @IsIn(WALLET_TOP_UP_CURRENCIES)
  currency!: WalletTopUpCurrency;
}
