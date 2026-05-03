import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;
type ExpiredRecord = { id: string; petId: string };

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit() {
    const configured = Number(process.env.MAINTENANCE_INTERVAL_MS);
    const intervalMs =
      Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_MAINTENANCE_INTERVAL_MS;
    this.interval = setInterval(() => {
      void this.runExpiredCleanup().catch((error) => {
        this.logger.warn(
          error instanceof Error ? error.message : "Expired cleanup failed"
        );
      });
    }, intervalMs);
    this.interval.unref?.();
    void this.runExpiredCleanup().catch(() => null);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async runExpiredCleanup(now = new Date()) {
    if (this.running) {
      return { memorials: 0, gifts: 0, skipped: true };
    }
    this.running = true;
    try {
      const memorials = await this.deactivateExpiredMemorials(now);
      const gifts = await this.deactivateExpiredGifts(undefined, now);
      return { memorials, gifts, skipped: false };
    } finally {
      this.running = false;
    }
  }

  async deactivateExpiredMemorials(now = new Date()) {
    const expired = await this.prisma.memorial.findMany({
      where: {
        deactivatedAt: null,
        activeUntil: { lte: now },
        pet: { isActive: true }
      },
      select: { id: true, petId: true }
    });
    if (expired.length === 0) {
      return 0;
    }
    await this.prisma.$transaction([
      this.prisma.memorial.updateMany({
        where: { id: { in: expired.map((item: ExpiredRecord) => item.id) } },
        data: {
          deactivatedAt: now,
          deactivationReason: "expired"
        }
      }),
      this.prisma.pet.updateMany({
        where: { id: { in: expired.map((item: ExpiredRecord) => item.petId) } },
        data: {
          isActive: false,
          deactivatedAt: now,
          deactivationReason: "expired"
        }
      })
    ]);
    return expired.length;
  }

  async deactivateExpiredGifts(petId?: string, now = new Date()) {
    const expired = await this.prisma.giftPlacement.findMany({
      where: {
        ...(petId ? { petId } : {}),
        isActive: true,
        expiresAt: { lte: now }
      },
      select: { id: true, petId: true }
    });
    if (expired.length === 0) {
      return 0;
    }
    const giftIds = expired.map((gift: ExpiredRecord) => gift.id);
    const petIds = [...new Set(expired.map((gift: ExpiredRecord) => gift.petId))];
    await this.prisma.$transaction([
      this.prisma.giftPlacement.updateMany({
        where: { id: { in: giftIds } },
        data: {
          isActive: false,
          deactivatedAt: now,
          deactivationReason: "expired"
        }
      }),
      this.prisma.memorial.updateMany({
        where: { petId: { in: petIds }, deactivatedAt: null },
        data: { needsPreviewRefresh: true }
      })
    ]);
    return expired.length;
  }
}
