import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export const DEFAULT_MEMORIAL_PLAN_PRICES = [
  { years: 1, price: 100 },
  { years: 2, price: 200 },
  { years: 5, price: 500 },
  { years: 0, price: 1200 }
] as const;

const SUPPORTED_PLAN_YEARS = new Set(
  DEFAULT_MEMORIAL_PLAN_PRICES.map((plan) => plan.years)
);
type MemorialPlanPriceRow = { years: number; price: number };
export type MemorialPublicationMode = {
  freeLifetime: boolean;
};

const MEMORIAL_PUBLICATION_MODE_KEY = "memorialPublicationMode";
const DEFAULT_MEMORIAL_PUBLICATION_MODE: MemorialPublicationMode = {
  freeLifetime: true,
};

const normalizeMemorialPublicationMode = (
  value: unknown,
): MemorialPublicationMode => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      freeLifetime:
        (value as { freeLifetime?: unknown }).freeLifetime === true,
    };
  }
  return DEFAULT_MEMORIAL_PUBLICATION_MODE;
};

@Injectable()
export class PricingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async ensureMemorialPlanPricesSeeded() {
    await Promise.all(
      DEFAULT_MEMORIAL_PLAN_PRICES.map(async (plan) => {
        const existing = await this.prisma.memorialPlanPrice.findUnique({
          where: { years: plan.years }
        });
        if (!existing) {
          await this.prisma.memorialPlanPrice.create({ data: plan });
          return;
        }
        if (plan.years === 0 && existing.price === 1500) {
          await this.prisma.memorialPlanPrice.update({
            where: { years: plan.years },
            data: { price: plan.price }
          });
        }
      })
    );
  }

  async listMemorialPlanPrices() {
    await this.ensureMemorialPlanPricesSeeded();
    const rows = await this.prisma.memorialPlanPrice.findMany({
      orderBy: [{ years: "asc" }]
    });
    return rows.sort((left: MemorialPlanPriceRow, right: MemorialPlanPriceRow) => {
      if (left.years === 0) {
        return 1;
      }
      if (right.years === 0) {
        return -1;
      }
      return left.years - right.years;
    });
  }

  async getMemorialPlanPrice(years: number) {
    if (!SUPPORTED_PLAN_YEARS.has(years as (typeof DEFAULT_MEMORIAL_PLAN_PRICES)[number]["years"])) {
      throw new BadRequestException("Неверный тариф оплаты мемориала");
    }
    await this.ensureMemorialPlanPricesSeeded();
    const row = await this.prisma.memorialPlanPrice.findUnique({ where: { years } });
    if (!row) {
      throw new BadRequestException("Тариф оплаты мемориала не найден");
    }
    return row.price;
  }

  async updateMemorialPlanPrice(years: number, price: number) {
    if (!SUPPORTED_PLAN_YEARS.has(years as (typeof DEFAULT_MEMORIAL_PLAN_PRICES)[number]["years"])) {
      throw new BadRequestException("Этот срок аренды не поддерживается");
    }
    if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
      throw new BadRequestException("Цена должна быть целым числом от 0 до 1000000");
    }
    return this.prisma.memorialPlanPrice.upsert({
      where: { years },
      update: { price },
      create: { years, price }
    });
  }

  async getMemorialPublicationMode() {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: MEMORIAL_PUBLICATION_MODE_KEY },
    });
    return normalizeMemorialPublicationMode(row?.value);
  }

  async updateMemorialPublicationMode(freeLifetime: boolean) {
    const mode: MemorialPublicationMode = { freeLifetime };
    const row = await this.prisma.appSetting.upsert({
      where: { key: MEMORIAL_PUBLICATION_MODE_KEY },
      update: { value: mode },
      create: {
        key: MEMORIAL_PUBLICATION_MODE_KEY,
        value: mode,
      },
    });
    return normalizeMemorialPublicationMode(row.value);
  }
}
