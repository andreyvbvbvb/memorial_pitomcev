import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_GIFTS = [
  {
    code: "candle",
    name: "Свеча",
    price: 20,
    modelUrl: "/models/gifts/candle/candle_1.glb"
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
    for (const gift of DEFAULT_GIFTS) {
      await this.prisma.giftCatalog.upsert({
        where: { code: gift.code },
        update: {
          name: gift.name,
          price: gift.price,
          modelUrl: gift.modelUrl
        },
        create: gift
      });
    }
    await this.syncCatalogFromAssets();
  }

  private async syncCatalogFromAssets() {
    const fs = await import("fs");
    const path = await import("path");
    const candidates = [
      process.env.GIFTS_ASSETS_PATH,
      path.resolve(process.cwd(), "apps", "web", "public", "models", "gifts"),
      path.resolve(process.cwd(), "..", "web", "public", "models", "gifts"),
      path.resolve(process.cwd(), "public", "models", "gifts"),
      path.resolve(__dirname, "..", "..", "..", "web", "public", "models", "gifts")
    ].filter(Boolean) as string[];
    const giftsRoot = candidates.find((candidate) => fs.existsSync(candidate));
    if (!giftsRoot) {
      return;
    }
    const typeDirs = fs
      .readdirSync(giftsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const type of typeDirs) {
      const typeDir = path.join(giftsRoot, type);
      if (!fs.existsSync(typeDir)) {
        continue;
      }
      const files = fs
        .readdirSync(typeDir)
        .filter((file) => file.toLowerCase().endsWith(".glb"));
      for (const file of files) {
        const code = path.basename(file, ".glb");
        const numeric = code.match(/_(\d+)$/);
        const number = numeric ? Number(numeric[1]) : null;
        const titlePrefix = type === "candle" ? "Свеча" : type === "flower" ? "Цветок" : "Подарок";
        const name = number ? `${titlePrefix} ${number}` : titlePrefix;
        await this.prisma.giftCatalog.upsert({
          where: { code },
          update: {
            name,
            modelUrl: `/models/gifts/${type}/${file}`
          },
          create: {
            code,
            name,
            price: type === "candle" ? 30 : 20,
            modelUrl: `/models/gifts/${type}/${file}`
          }
        });
      }
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
