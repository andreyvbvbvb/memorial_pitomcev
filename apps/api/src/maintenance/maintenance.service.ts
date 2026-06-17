import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;
const DUST_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_DUST_STAGE = 4;
const EXPIRATION_REMINDER_MS = 30 * 24 * 60 * 60 * 1000;
const DIRT_SLOT_NAMES = [
  "dirt_slot_1",
  "dirt_slot_2",
  "dirt_slot_3",
  "dirt_slot_4",
] as const;
type ExpiredRecord = { id: string; petId: string };
type DirtSlotName = (typeof DIRT_SLOT_NAMES)[number];
type DirtState = {
  slots: DirtSlotName[];
  nextSlotIndex: number;
  dustStage: number;
  dustUpdatedAt: Date;
  changed: boolean;
};

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mailService: MailService,
  ) {}

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
      return {
        memorials: 0,
        gifts: 0,
        dirtSynced: 0,
        dirtEmails: 0,
        expirationEmails: 0,
        skipped: true,
      };
    }
    this.running = true;
    try {
      const memorials = await this.deactivateExpiredMemorials(now);
      const gifts = await this.deactivateExpiredGifts(undefined, now);
      const dirt = await this.syncDirtAndNotify(now);
      const expirationEmails = await this.sendExpirationReminders(now);
      return {
        memorials,
        gifts,
        dirtSynced: dirt.synced,
        dirtEmails: dirt.emails,
        expirationEmails,
        skipped: false,
      };
    } finally {
      this.running = false;
    }
  }

  private getFrontendUrl() {
    return (process.env.FRONTEND_URL ?? "https://xn--80aeb9a9a9d.com").replace(
      /\/+$/,
      "",
    );
  }

  private getSceneJsonRecord(sceneJson?: Prisma.JsonValue | null) {
    return sceneJson &&
      typeof sceneJson === "object" &&
      !Array.isArray(sceneJson)
      ? (sceneJson as Record<string, unknown>)
      : {};
  }

  private normalizeDirtSlot(value: unknown): DirtSlotName | null {
    if (typeof value === "number") {
      return DIRT_SLOT_NAMES[value - 1] ?? null;
    }
    if (typeof value !== "string") {
      return null;
    }
    if ((DIRT_SLOT_NAMES as readonly string[]).includes(value)) {
      return value as DirtSlotName;
    }
    const match = value.match(/^dirt_slot_([1-4])$/i);
    if (!match) {
      return null;
    }
    return DIRT_SLOT_NAMES[Number(match[1]) - 1] ?? null;
  }

  private readDirtSlots(
    sceneJson: Record<string, unknown>,
    dustStage?: number | null,
  ) {
    const rawSlots = sceneJson.activeDirtSlots;
    if (Array.isArray(rawSlots)) {
      const slots: DirtSlotName[] = [];
      rawSlots.forEach((item) => {
        const slot = this.normalizeDirtSlot(item);
        if (slot && !slots.includes(slot)) {
          slots.push(slot);
        }
      });
      return { slots, fromScene: true };
    }
    const safeStage = Math.max(
      0,
      Math.min(MAX_DUST_STAGE, Math.floor(dustStage ?? 0)),
    );
    return {
      slots: [...DIRT_SLOT_NAMES.slice(0, safeStage)],
      fromScene: false,
    };
  }

  private readNextDirtSlotIndex(
    sceneJson: Record<string, unknown>,
    slots: readonly DirtSlotName[],
  ) {
    const rawNext = sceneJson.dirtNextSlotIndex;
    if (
      typeof rawNext === "number" &&
      rawNext >= 1 &&
      rawNext <= MAX_DUST_STAGE
    ) {
      return { nextSlotIndex: Math.floor(rawNext), fromScene: true };
    }
    const fallback =
      slots.length >= MAX_DUST_STAGE
        ? 1
        : Math.max(1, Math.min(MAX_DUST_STAGE, slots.length + 1));
    return { nextSlotIndex: fallback, fromScene: false };
  }

  private getSlotOrderIndex(slot: DirtSlotName) {
    return DIRT_SLOT_NAMES.indexOf(slot) + 1;
  }

  private findNextEmptyDirtSlot(
    slots: readonly DirtSlotName[],
    startIndex: number,
  ) {
    const occupied = new Set(slots);
    for (let offset = 0; offset < MAX_DUST_STAGE; offset += 1) {
      const index = ((startIndex - 1 + offset) % MAX_DUST_STAGE) + 1;
      const slot = DIRT_SLOT_NAMES[index - 1];
      if (slot && !occupied.has(slot)) {
        return slot;
      }
    }
    return null;
  }

  private buildDirtSceneJson(
    sceneJson: Prisma.JsonValue | null | undefined,
    slots: readonly DirtSlotName[],
    nextSlotIndex: number,
  ): Prisma.InputJsonValue {
    return {
      ...this.getSceneJsonRecord(sceneJson),
      activeDirtSlots: [...slots],
      dirtNextSlotIndex: nextSlotIndex,
    };
  }

  private calculateDirtState(
    memorial: {
      sceneJson?: Prisma.JsonValue | null;
      dustStage?: number | null;
      dustUpdatedAt?: Date | null;
      createdAt?: Date | null;
    },
    now: Date,
  ): DirtState {
    const sceneJson = this.getSceneJsonRecord(memorial.sceneJson);
    const { slots: initialSlots, fromScene: slotsFromScene } =
      this.readDirtSlots(sceneJson, memorial.dustStage);
    const { nextSlotIndex: initialNextSlotIndex, fromScene: nextFromScene } =
      this.readNextDirtSlotIndex(sceneJson, initialSlots);
    const slots = [...initialSlots];
    let nextSlotIndex = initialNextSlotIndex;
    let dustUpdatedAt = memorial.dustUpdatedAt ?? memorial.createdAt ?? now;
    let changed =
      !slotsFromScene ||
      !nextFromScene ||
      slots.length !==
        Math.max(
          0,
          Math.min(MAX_DUST_STAGE, Math.floor(memorial.dustStage ?? 0)),
        );

    if (slots.length < MAX_DUST_STAGE) {
      let elapsedIntervals = Math.floor(
        Math.max(0, now.getTime() - dustUpdatedAt.getTime()) / DUST_INTERVAL_MS,
      );
      while (elapsedIntervals > 0 && slots.length < MAX_DUST_STAGE) {
        const slot = this.findNextEmptyDirtSlot(slots, nextSlotIndex);
        if (!slot) {
          break;
        }
        slots.push(slot);
        nextSlotIndex = (this.getSlotOrderIndex(slot) % MAX_DUST_STAGE) + 1;
        dustUpdatedAt = new Date(dustUpdatedAt.getTime() + DUST_INTERVAL_MS);
        elapsedIntervals -= 1;
        changed = true;
      }
    }

    return {
      slots,
      nextSlotIndex,
      dustStage: slots.length,
      dustUpdatedAt,
      changed,
    };
  }

  async syncDirtAndNotify(now = new Date()) {
    const memorials = await this.prisma.memorial.findMany({
      where: {
        deactivatedAt: null,
        pet: { isActive: true },
        OR: [
          { activeUntil: null },
          { activeUntil: { gt: now } },
        ],
      },
      select: {
        id: true,
        petId: true,
        sceneJson: true,
        dustStage: true,
        dustUpdatedAt: true,
        createdAt: true,
        dirtFullNotifiedAt: true,
        pet: {
          select: {
            name: true,
            owner: { select: { email: true } },
          },
        },
      },
    });
    let synced = 0;
    let emails = 0;
    const frontendUrl = this.getFrontendUrl();
    for (const memorial of memorials) {
      const state = this.calculateDirtState(memorial, now);
      if (state.changed) {
        synced += 1;
        await this.prisma.memorial.update({
          where: { id: memorial.id },
          data: {
            dustStage: state.dustStage,
            dustUpdatedAt: state.dustUpdatedAt,
            sceneJson: this.buildDirtSceneJson(
              memorial.sceneJson,
              state.slots,
              state.nextSlotIndex,
            ),
            needsPreviewRefresh: true,
          },
        });
      }
      if (state.slots.length < MAX_DUST_STAGE || memorial.dirtFullNotifiedAt) {
        continue;
      }
      try {
        await this.mailService.sendMemorialCareReminder(
          memorial.pet.owner.email,
          memorial.pet.name,
          `${frontendUrl}/pets/${encodeURIComponent(memorial.petId)}`,
        );
        await this.prisma.memorial.update({
          where: { id: memorial.id },
          data: { dirtFullNotifiedAt: now },
        });
        emails += 1;
      } catch (error) {
        this.logger.warn(
          `Dirt reminder email failed for memorial ${memorial.id}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
    return { synced, emails };
  }

  async sendExpirationReminders(now = new Date()) {
    const reminderUntil = new Date(now.getTime() + EXPIRATION_REMINDER_MS);
    const memorials = await this.prisma.memorial.findMany({
      where: {
        deactivatedAt: null,
        activeUntil: {
          gt: now,
          lte: reminderUntil,
        },
        expirationReminderSentAt: null,
        pet: { isActive: true },
      },
      select: {
        id: true,
        petId: true,
        activeUntil: true,
        pet: {
          select: {
            name: true,
            owner: { select: { email: true } },
          },
        },
      },
    });
    let emails = 0;
    const frontendUrl = this.getFrontendUrl();
    for (const memorial of memorials) {
      if (!memorial.activeUntil) {
        continue;
      }
      try {
        await this.mailService.sendMemorialExpirationReminder(
          memorial.pet.owner.email,
          memorial.pet.name,
          `${frontendUrl}/pets/${encodeURIComponent(memorial.petId)}`,
          memorial.activeUntil,
        );
        await this.prisma.memorial.update({
          where: { id: memorial.id },
          data: { expirationReminderSentAt: now },
        });
        emails += 1;
      } catch (error) {
        this.logger.warn(
          `Expiration reminder email failed for memorial ${memorial.id}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
    return emails;
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
