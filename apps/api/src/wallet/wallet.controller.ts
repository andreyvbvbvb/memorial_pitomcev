import { Controller, Get, Inject, Param, Post, Body } from "@nestjs/common";
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
  async getBalance(@Param("ownerId") ownerId: string) {
    const user = await this.ensureOwner(ownerId);
    return { ownerId: user.id, coinBalance: user.coinBalance };
  }

  @Post("top-up")
  async topUp(@Body() dto: TopUpDto) {
    await this.ensureOwner(dto.ownerId);
    const charityAmount = Math.floor(dto.amount * 0.2);
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: dto.ownerId },
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
