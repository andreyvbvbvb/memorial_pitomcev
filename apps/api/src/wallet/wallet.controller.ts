import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { canAccessAdmin } from "../auth/access-level";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { TopUpDto } from "./dto/top-up.dto";

@Controller("wallet")
export class WalletController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async ensureOwner(ownerId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: ownerId }
    });
    if (existing) {
      return existing;
    }
    const safeId = ownerId.trim();
    const email =
      safeId.includes("@") ? safeId : `${safeId.replace(/\s+/g, "_")}@dev.local`;
    return this.prisma.user.create({
      data: {
        id: safeId,
        email,
        createdAt: new Date()
      }
    });
  }

  @Get(":ownerId")
  @UseGuards(AuthGuard)
  async getBalance(
    @Param("ownerId") ownerId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (ownerId !== user.id && !canAccessAdmin(user)) {
      throw new ForbiddenException("Можно смотреть только свой баланс");
    }
    const owner = await this.ensureOwner(ownerId);
    return { ownerId: owner.id, coinBalance: owner.coinBalance };
  }

  @Post("top-up")
  @UseGuards(AuthGuard)
  async topUp(@Body() dto: TopUpDto, @CurrentUser() user: AuthenticatedUser) {
    const ownerId = canAccessAdmin(user) && dto.ownerId ? dto.ownerId : user.id;
    if (dto.ownerId && dto.ownerId !== user.id && !canAccessAdmin(user)) {
      throw new ForbiddenException("Можно пополнять только свой баланс");
    }
    await this.ensureOwner(ownerId);
    const charityAmount = Math.floor(dto.amount * 0.2);
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: ownerId },
        data: {
          coinBalance: { increment: dto.amount }
        }
      }),
      this.prisma.charityTotals.upsert({
        where: { id: "global" },
        create: { id: "global", totalAccrued: charityAmount },
        update: { totalAccrued: { increment: charityAmount } }
      })
    ]);
    return { ok: true, coinBalance: updated.coinBalance };
  }
}
