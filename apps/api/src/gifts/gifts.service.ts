import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_GIFTS = [
  {
    code: "candle",
    name: "Свеча",
    price: 20,
    modelUrl: "/models/gifts/candle.glb"
  }
];

@Injectable()
export class GiftsService {
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
        email
      }
    });
  }

  private async ensureCatalogSeeded() {
    const count = await this.prisma.giftCatalog.count();
    if (count > 0) {
      return;
    }
    for (const gift of DEFAULT_GIFTS) {
      await this.prisma.giftCatalog.upsert({
        where: { code: gift.code },
        update: {},
        create: gift
      });
    }
  }

  async listCatalog() {
    await this.ensureCatalogSeeded();
    return this.prisma.giftCatalog.findMany({
      orderBy: { price: "asc" }
    });
  }

  async placeGift(options: {
    petId: string;
    ownerId: string;
    giftId: string;
    slotName: string;
    months?: number;
  }) {
    const { petId, ownerId, giftId, slotName, months } = options;
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException("Мемориал не найден");
    }
    const gift = await this.prisma.giftCatalog.findUnique({ where: { id: giftId } });
    if (!gift) {
      throw new NotFoundException("Подарок не найден");
    }

    const durationMonths = months ?? 1;
    const totalPrice = gift.price * durationMonths;
    const active = await this.prisma.giftPlacement.findFirst({
      where: {
        petId,
        slotName,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    });
    if (active) {
      throw new BadRequestException("Этот слот уже занят");
    }

    const user = await this.ensureOwner(ownerId);
    if (user.coinBalance < totalPrice) {
      throw new BadRequestException("Недостаточно монет");
    }

    const expiresAt = durationMonths ? this.addMonths(new Date(), durationMonths) : null;
    const [updatedUser, placement] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: ownerId },
        data: { coinBalance: { decrement: totalPrice } }
      }),
      this.prisma.giftPlacement.create({
        data: {
          petId,
          giftId,
          ownerId,
          slotName,
          expiresAt
        },
        include: {
          gift: true,
          owner: true
        }
      })
    ]);

    return {
      placement,
      coinBalance: updatedUser.coinBalance,
      spent: totalPrice
    };
  }

  private addMonths(date: Date, months: number) {
    const next = new Date(date);
    const targetMonth = next.getMonth() + months;
    next.setMonth(targetMonth);
    return next;
  }
}
