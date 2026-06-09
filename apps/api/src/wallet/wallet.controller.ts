import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { Prisma, type PaymentOrder } from "@prisma/client";
import type { Request } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { canAccessAdmin } from "../auth/access-level";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreatePaymentDto,
  type WalletTopUpCoins,
  type WalletTopUpCurrency,
} from "./dto/create-payment.dto";
import { TopUpDto } from "./dto/top-up.dto";

type CloudPaymentsRequest = Request & { rawBody?: Buffer };

type CloudPaymentsPayload = {
  invoiceId: string;
  accountId: string;
  amountMinor: number;
  currency: string;
  transactionId: string | null;
};

const TOP_UP_PRICE_MINOR: Record<
  WalletTopUpCurrency,
  Record<WalletTopUpCoins, number>
> = {
  RUB: {
    100: 9_900,
    300: 29_900,
    800: 69_900,
    2000: 179_900,
  },
  USD: {
    100: 149,
    300: 449,
    800: 999,
    2000: 2_299,
  },
};

@Controller("wallet")
export class WalletController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async ensureOwner(ownerId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });
    if (existing) {
      return existing;
    }
    const safeId = ownerId.trim();
    const email = safeId.includes("@")
      ? safeId
      : `${safeId.replace(/\s+/g, "_")}@dev.local`;
    return this.prisma.user.create({
      data: {
        id: safeId,
        email,
        createdAt: new Date(),
      },
    });
  }

  @Get(":ownerId")
  @UseGuards(AuthGuard)
  async getBalance(
    @Param("ownerId") ownerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (ownerId !== user.id && !canAccessAdmin(user)) {
      throw new ForbiddenException("Можно смотреть только свой баланс");
    }
    const owner = await this.ensureOwner(ownerId);
    return { ownerId: owner.id, coinBalance: owner.coinBalance };
  }

  @Get("me/transactions")
  @UseGuards(AuthGuard)
  async getMyTransactions(@CurrentUser() user: AuthenticatedUser) {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 120,
    });
    return { transactions };
  }

  @Post("payments/cloudpayments")
  @UseGuards(AuthGuard)
  async createCloudPaymentsPayment(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID?.trim();
    if (!publicId) {
      throw new ServiceUnavailableException("CloudPayments пока не настроен");
    }
    const amountMinor = TOP_UP_PRICE_MINOR[dto.currency]?.[dto.coins];
    if (!amountMinor) {
      throw new BadRequestException("Такого тарифа пополнения нет");
    }
    const invoiceId = `mg-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const order = await this.prisma.paymentOrder.create({
      data: {
        userId: user.id,
        invoiceId,
        coins: dto.coins,
        amountMinor,
        currency: dto.currency,
      },
    });
    return {
      ok: true,
      publicId,
      invoiceId: order.invoiceId,
      accountId: user.id,
      amount: this.minorToAmount(order.amountMinor),
      currency: order.currency,
      coins: order.coins,
      description: `Пополнение баланса МЯУГАВ: ${order.coins} монет`,
    };
  }

  @Get("payments/:invoiceId")
  @UseGuards(AuthGuard)
  async getPaymentOrder(
    @Param("invoiceId") invoiceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { invoiceId },
    });
    if (!order) {
      throw new BadRequestException("Платёж не найден");
    }
    if (order.userId !== user.id && !canAccessAdmin(user)) {
      throw new ForbiddenException("Можно смотреть только свои платежи");
    }
    return {
      invoiceId: order.invoiceId,
      status: order.status,
      coins: order.coins,
      amount: this.minorToAmount(order.amountMinor),
      currency: order.currency,
      paidAt: order.paidAt,
    };
  }

  @Post("payments/cloudpayments/check")
  async checkCloudPaymentsPayment(
    @Req() req: CloudPaymentsRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.handleCloudPaymentsCheck(req, body);
  }

  @Post("payments/cloudpayments/pay")
  async payCloudPaymentsPayment(
    @Req() req: CloudPaymentsRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.handleCloudPaymentsPay(req, body);
  }

  @Post("payments/cloudpayments/fail")
  async failCloudPaymentsPayment(
    @Req() req: CloudPaymentsRequest,
    @Body() body: Record<string, unknown>,
  ) {
    if (!this.isValidCloudPaymentsSignature(req)) {
      return { code: 13 };
    }
    const payload = this.parseCloudPaymentsPayload(body);
    if (payload?.invoiceId) {
      await this.prisma.paymentOrder.updateMany({
        where: { invoiceId: payload.invoiceId, status: { not: "paid" } },
        data: {
          status: "failed",
          failureReason: "CloudPayments Fail notification",
        },
      });
    }
    return { code: 0 };
  }

  @Post("top-up")
  @UseGuards(AuthGuard)
  async topUp(@Body() dto: TopUpDto, @CurrentUser() user: AuthenticatedUser) {
    if (!canAccessAdmin(user)) {
      throw new ForbiddenException(
        "Ручное пополнение доступно только администратору",
      );
    }
    const ownerId = dto.ownerId ? dto.ownerId : user.id;
    await this.ensureOwner(ownerId);
    const charityAmount = Math.floor(dto.amount * 0.2);
    const updated = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updatedUser = await tx.user.update({
          where: { id: ownerId },
          data: {
            coinBalance: { increment: dto.amount },
          },
        });
        await tx.charityTotals.upsert({
          where: { id: "global" },
          create: { id: "global", totalAccrued: charityAmount },
          update: { totalAccrued: { increment: charityAmount } },
        });
        await tx.walletTransaction.create({
          data: {
            userId: ownerId,
            amount: dto.amount,
            balanceAfter: updatedUser.coinBalance,
            type: "top_up",
            title: "Пополнение баланса",
            details: `Пополнение на ${dto.amount} монет`,
          },
        });
        return updatedUser;
      },
    );
    return { ok: true, coinBalance: updated.coinBalance };
  }

  private async handleCloudPaymentsCheck(
    req: CloudPaymentsRequest,
    body: Record<string, unknown>,
  ) {
    if (!this.isValidCloudPaymentsSignature(req)) {
      return { code: 13 };
    }
    const payload = this.parseCloudPaymentsPayload(body);
    if (!payload) {
      return { code: 10 };
    }
    const order = await this.prisma.paymentOrder.findUnique({
      where: { invoiceId: payload.invoiceId },
    });
    const validationError = this.validateCloudPaymentsPayload(order, payload);
    if (validationError) {
      return { code: 10 };
    }
    if (order.status !== "paid") {
      await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: "created" },
        data: { status: "checked" },
      });
    }
    return { code: 0 };
  }

  private async handleCloudPaymentsPay(
    req: CloudPaymentsRequest,
    body: Record<string, unknown>,
  ) {
    if (!this.isValidCloudPaymentsSignature(req)) {
      return { code: 13 };
    }
    const payload = this.parseCloudPaymentsPayload(body);
    if (!payload) {
      return { code: 10 };
    }
    const order = await this.prisma.paymentOrder.findUnique({
      where: { invoiceId: payload.invoiceId },
    });
    const validationError = this.validateCloudPaymentsPayload(order, payload);
    if (validationError) {
      if (order && order.status !== "paid") {
        await this.prisma.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: "failed",
            failureReason: validationError,
          },
        });
      }
      return { code: 10 };
    }
    if (order.status === "paid") {
      return { code: 0 };
    }
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const locked = await tx.paymentOrder.updateMany({
        where: { id: order.id, status: { not: "paid" } },
        data: {
          status: "paid",
          paidAt: new Date(),
          cloudTransactionId: payload.transactionId,
          failureReason: null,
        },
      });
      if (locked.count === 0) {
        return null;
      }
      const updatedUser = await tx.user.update({
        where: { id: order.userId },
        data: { coinBalance: { increment: order.coins } },
      });
      const charityAmount = Math.floor(order.coins * 0.2);
      await tx.charityTotals.upsert({
        where: { id: "global" },
        create: { id: "global", totalAccrued: charityAmount },
        update: { totalAccrued: { increment: charityAmount } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: order.userId,
          amount: order.coins,
          balanceAfter: updatedUser.coinBalance,
          type: "cloudpayments_top_up",
          title: "Пополнение баланса",
          details: `CloudPayments: ${order.coins} монет, ${this.minorToAmount(order.amountMinor)} ${order.currency}`,
        },
      });
      return updatedUser;
    });
    return { code: 0 };
  }

  private validateCloudPaymentsPayload(
    order: PaymentOrder | null,
    payload: CloudPaymentsPayload,
  ) {
    if (!order) {
      return "Платёж не найден";
    }
    if (order.userId !== payload.accountId) {
      return "AccountId не совпадает";
    }
    if (order.amountMinor !== payload.amountMinor) {
      return "Сумма не совпадает";
    }
    if (order.currency !== payload.currency) {
      return "Валюта не совпадает";
    }
    if (order.status === "failed") {
      return "Платёж уже отклонён";
    }
    return null;
  }

  private parseCloudPaymentsPayload(
    body: Record<string, unknown>,
  ): CloudPaymentsPayload | null {
    const invoiceId =
      this.getBodyString(body, "ExternalId") ||
      this.getBodyString(body, "InvoiceId") ||
      this.getBodyString(body, "MerchantOrderId");
    const accountId = this.getBodyString(body, "AccountId");
    const amountRaw = this.getBodyString(body, "Amount");
    const currency = this.getBodyString(body, "Currency").toUpperCase();
    const transactionId = this.getBodyString(body, "TransactionId") || null;
    const amount = Number(amountRaw.replace(",", "."));
    if (!invoiceId || !accountId || !Number.isFinite(amount) || !currency) {
      return null;
    }
    return {
      invoiceId,
      accountId,
      amountMinor: Math.round(amount * 100),
      currency,
      transactionId,
    };
  }

  private getBodyString(body: Record<string, unknown>, key: string) {
    const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
    const value = body[key] ?? body[lowerKey] ?? body[key.toLowerCase()];
    if (Array.isArray(value)) {
      return String(value[0] ?? "").trim();
    }
    return String(value ?? "").trim();
  }

  private isValidCloudPaymentsSignature(req: CloudPaymentsRequest) {
    const secret = process.env.CLOUDPAYMENTS_API_SECRET?.trim();
    if (!secret) {
      return process.env.NODE_ENV !== "production";
    }
    const signature = String(req.headers["content-hmac"] ?? "").trim();
    if (!req.rawBody || !signature) {
      return false;
    }
    const expected = createHmac("sha256", secret)
      .update(req.rawBody)
      .digest("base64");
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return (
      signatureBuffer.length === expectedBuffer.length &&
      timingSafeEqual(signatureBuffer, expectedBuffer)
    );
  }

  private minorToAmount(amountMinor: number) {
    return Number((amountMinor / 100).toFixed(2));
  }
}
