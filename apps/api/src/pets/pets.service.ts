import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { extname } from "path";
import { canAccessAdmin, isOwnerUser } from "../auth/access-level";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { PricingService } from "../pricing/pricing.service";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../storage/s3.service";
import { CreatePetDto } from "./dto/create-pet.dto";
import { SaveMemorialDraftDto } from "./dto/save-memorial-draft.dto";
import { UpdatePetDto } from "./dto/update-pet.dto";

const DUST_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_DUST_STAGE = 4;
const DIRT_SLOT_NAMES = [
  "dirt_slot_1",
  "dirt_slot_2",
  "dirt_slot_3",
  "dirt_slot_4",
] as const;
const DEFAULT_MAX_MEMORIALS = 5;
const OWNER_MAX_MEMORIALS = 10000;
const MODERATION_PENDING = "PENDING";
const MODERATION_APPROVED = "APPROVED";
const MODERATION_REVIEW_INITIAL = "INITIAL";
const MODERATION_REVIEW_REVISION = "REVISION";
const MODERATION_CHANGED_BLOCKS = ["basic", "story", "photos"] as const;
type ModerationChangedBlock = (typeof MODERATION_CHANGED_BLOCKS)[number];
type DirtSlotName = (typeof DIRT_SLOT_NAMES)[number];
type MemorialDirtState = {
  slots: DirtSlotName[];
  nextSlotIndex: number;
  dustStage: number;
  dustUpdatedAt: Date;
  changed: boolean;
};

@Injectable()
export class PetsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(S3Service) private readonly s3: S3Service,
    @Inject(MaintenanceService)
    private readonly maintenance: MaintenanceService,
    @Inject(PricingService) private readonly pricing: PricingService,
  ) {}

  private async ensureOwner(ownerId: string) {
    const safeId = ownerId.trim();
    const existing = await this.prisma.user.findUnique({
      where: { id: safeId },
    });
    if (existing) {
      return existing;
    }
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

  private getSceneJsonRecord(sceneJson?: Prisma.JsonValue | null) {
    return sceneJson &&
      typeof sceneJson === "object" &&
      !Array.isArray(sceneJson)
      ? (sceneJson as Record<string, unknown>)
      : {};
  }

  private moderationResetData(
    pet: { moderationChangedBlocks?: string[] | null },
    changedBlocks: ModerationChangedBlock[],
  ) {
    const mergedBlocks = Array.from(
      new Set([
        ...(pet.moderationChangedBlocks ?? []).filter(
          (block): block is ModerationChangedBlock =>
            (MODERATION_CHANGED_BLOCKS as readonly string[]).includes(block),
        ),
        ...changedBlocks,
      ]),
    );
    return {
      moderationStatus: MODERATION_PENDING,
      moderationComment: null,
      moderationReviewType: MODERATION_REVIEW_REVISION,
      moderationChangedBlocks: { set: mergedBlocks },
      moderatedAt: null,
      moderatorId: null,
    } satisfies Prisma.PetUpdateInput;
  }

  private shouldResetModeration(
    viewer: AuthenticatedUser,
    hasModeratedChanges: boolean,
  ) {
    return !canAccessAdmin(viewer) && hasModeratedChanges;
  }

  private getModerationChangedBlocks(dto: UpdatePetDto) {
    const changedBlocks = new Set<ModerationChangedBlock>();
    if (
      ["name", "species", "birthDate", "deathDate", "isPublic"].some(
        (key) => typeof dto[key as keyof UpdatePetDto] !== "undefined",
      )
    ) {
      changedBlocks.add("basic");
    }
    if (
      [
        "epitaph",
        "favoriteTreats",
        "favoriteToys",
        "favoriteSleepPlaces",
        "story",
      ].some((key) => typeof dto[key as keyof UpdatePetDto] !== "undefined")
    ) {
      changedBlocks.add("story");
    }
    return Array.from(changedBlocks);
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

  private getSlotOrderIndex(slot: DirtSlotName) {
    return DIRT_SLOT_NAMES.indexOf(slot) + 1;
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
  ): MemorialDirtState {
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

  private async syncDirtState(
    memorial: {
      id: string;
      sceneJson?: Prisma.JsonValue | null;
      dustStage?: number | null;
      dustUpdatedAt?: Date | null;
      createdAt?: Date | null;
    },
    now: Date,
  ) {
    const state = this.calculateDirtState(memorial, now);
    if (state.changed) {
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
    return state;
  }

  private resolveMaxMemorials(owner: {
    email?: string | null;
    login?: string | null;
    role?: string | null;
    maxMemorials?: number | null;
  }) {
    if (isOwnerUser(owner)) {
      return OWNER_MAX_MEMORIALS;
    }
    return owner.maxMemorials ?? DEFAULT_MAX_MEMORIALS;
  }

  private activePetWhere(now = new Date()): Prisma.PetWhereInput {
    return {
      isActive: true,
      memorial: {
        is: {
          deactivatedAt: null,
          OR: [{ activeUntil: null }, { activeUntil: { gt: now } }],
        },
      },
    };
  }

  private canManagePet(
    user: AuthenticatedUser | null | undefined,
    pet: { ownerId: string },
  ) {
    return Boolean(user && (user.id === pet.ownerId || canAccessAdmin(user)));
  }

  private assertAuthenticated(user?: AuthenticatedUser | null) {
    if (!user) {
      throw new UnauthorizedException("Не авторизован");
    }
  }

  private assertCanManagePet(
    user: AuthenticatedUser | null | undefined,
    pet: { ownerId: string },
  ) {
    this.assertAuthenticated(user);
    if (!this.canManagePet(user, pet)) {
      throw new ForbiddenException("Можно управлять только своим мемориалом");
    }
  }

  async getCreationLimit(ownerId: string) {
    const owner = await this.ensureOwner(ownerId);
    await this.maintenance.deactivateExpiredMemorials();
    const maxMemorials = this.resolveMaxMemorials(owner);
    const currentCount = await this.prisma.pet.count({
      where: { ownerId: owner.id, ...this.activePetWhere() },
    });
    return {
      ownerId: owner.id,
      currentCount,
      maxMemorials,
      canCreate: currentCount < maxMemorials,
    };
  }

  async create(dto: CreatePetDto & { ownerId: string }) {
    const owner = await this.ensureOwner(dto.ownerId);
    await this.maintenance.deactivateExpiredMemorials();
    const name = typeof dto.name === "string" ? dto.name.trim() : "";
    if (!name) {
      throw new BadRequestException("Имя питомца обязательно");
    }
    const maxMemorials = this.resolveMaxMemorials(owner);
    const currentCount = await this.prisma.pet.count({
      where: { ownerId: owner.id, ...this.activePetWhere() },
    });
    if (currentCount >= maxMemorials) {
      throw new BadRequestException(
        `Достигнут лимит мемориалов: ${maxMemorials}. Для увеличения лимита напишите на primer@gmail.com`,
      );
    }
    const planYears =
      typeof dto.memorialPlanYears === "number" ? dto.memorialPlanYears : 1;
    const planPrice = await this.pricing.getMemorialPlanPrice(planYears);
    if (owner.coinBalance < planPrice) {
      throw new BadRequestException(
        "Недостаточно монет для создания мемориала",
      );
    }
    const hasCoords =
      typeof dto.lat === "number" && typeof dto.lng === "number";
    const now = new Date();
    const paidUntil = planYears === 0 ? null : this.addYears(now, planYears);
    const baseSceneJson =
      dto.sceneJson &&
      typeof dto.sceneJson === "object" &&
      !Array.isArray(dto.sceneJson)
        ? (dto.sceneJson as Record<string, unknown>)
        : {};
    const sceneJson: Prisma.InputJsonValue = {
      ...baseSceneJson,
      memorialPaidAt: now.toISOString(),
      memorialPaidUntil: paidUntil ? paidUntil.toISOString() : null,
      memorialPlanYears: planYears,
      memorialPaidPrice: planPrice,
      activeDirtSlots: [],
      dirtNextSlotIndex: 1,
    };

    const pet = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updatedUser = await tx.user.update({
          where: { id: owner.id },
          data: { coinBalance: { decrement: planPrice } },
        });
        await tx.walletTransaction.create({
          data: {
            userId: owner.id,
            amount: -planPrice,
            balanceAfter: updatedUser.coinBalance,
            type: "memorial_create",
            title: "Создание мемориала",
            details: `${name}: ${planYears === 0 ? "навсегда" : `${planYears} г.`}`,
          },
        });
        return tx.pet.create({
          data: {
            ownerId: owner.id,
            name,
            species: dto.species ?? null,
            birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
            deathDate: dto.deathDate ? new Date(dto.deathDate) : null,
            epitaph: dto.epitaph ?? null,
            favoriteTreats: dto.favoriteTreats ?? null,
            favoriteToys: dto.favoriteToys ?? null,
            favoriteSleepPlaces: dto.favoriteSleepPlaces ?? null,
            story: dto.story ?? null,
            isPublic: dto.isPublic ?? false,
            moderationStatus: MODERATION_PENDING,
            moderationComment: null,
            moderationReviewType: MODERATION_REVIEW_INITIAL,
            moderationChangedBlocks: [],
            moderatedAt: null,
            moderatorId: null,
            isActive: true,
            createdAt: now,
            memorial: {
              create: {
                environmentId: dto.environmentId ?? null,
                houseId: dto.houseId ?? null,
                sceneJson,
                dustUpdatedAt: now,
                activeUntil: paidUntil,
                createdAt: now,
              },
            },
            marker: hasCoords
              ? {
                  create: {
                    lat: dto.lat!,
                    lng: dto.lng!,
                    markerStyle: dto.markerStyle ?? null,
                    createdAt: now,
                  },
                }
              : undefined,
          },
        });
      },
    );

    return pet;
  }

  private buildDraftData(dto: SaveMemorialDraftDto, ownerId: string) {
    const name = typeof dto.name === "string" ? dto.name.trim() : "";
    if (!name) {
      throw new BadRequestException("Имя питомца обязательно");
    }
    const hasCoords =
      typeof dto.lat === "number" && typeof dto.lng === "number";
    const sceneJson =
      dto.sceneJson &&
      typeof dto.sceneJson === "object" &&
      !Array.isArray(dto.sceneJson)
        ? (dto.sceneJson as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    return {
      ownerId,
      name,
      species: dto.species ?? null,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      deathDate: dto.deathDate ? new Date(dto.deathDate) : null,
      epitaph: dto.epitaph ?? null,
      story: dto.story ?? null,
      isPublic: dto.isPublic ?? false,
      lat: hasCoords ? dto.lat! : null,
      lng: hasCoords ? dto.lng! : null,
      markerStyle: dto.markerStyle ?? null,
      environmentId: dto.environmentId ?? null,
      houseId: dto.houseId ?? null,
      sceneJson,
      step:
        typeof dto.step === "number"
          ? Math.max(0, Math.min(1, Math.round(dto.step)))
          : 1,
    };
  }

  async findDrafts(ownerId: string) {
    return this.prisma.memorialDraft.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findDraft(id: string, viewer: AuthenticatedUser) {
    const draft = await this.prisma.memorialDraft.findUnique({ where: { id } });
    if (!draft) {
      throw new NotFoundException("Draft not found");
    }
    if (draft.ownerId !== viewer.id && !canAccessAdmin(viewer)) {
      throw new ForbiddenException("Можно смотреть только свои черновики");
    }
    return draft;
  }

  async saveDraft(dto: SaveMemorialDraftDto, viewer: AuthenticatedUser) {
    const data = this.buildDraftData(dto, viewer.id);
    if (dto.id) {
      const existing = await this.prisma.memorialDraft.findUnique({
        where: { id: dto.id },
      });
      if (existing) {
        if (existing.ownerId !== viewer.id && !canAccessAdmin(viewer)) {
          throw new ForbiddenException("Можно менять только свои черновики");
        }
        return this.prisma.memorialDraft.update({
          where: { id: existing.id },
          data,
        });
      }
    }
    return this.prisma.memorialDraft.create({ data });
  }

  async removeDraft(id: string, viewer: AuthenticatedUser) {
    const draft = await this.findDraft(id, viewer);
    await this.prisma.memorialDraft.delete({ where: { id: draft.id } });
    return { ok: true };
  }

  async findAll(
    ownerId?: string,
    visibility?: string,
    viewer?: AuthenticatedUser | null,
  ) {
    await this.maintenance.deactivateExpiredMemorials();
    const now = new Date();
    const where: Prisma.PetWhereInput = this.activePetWhere(now);
    if (ownerId) {
      const publicOnly = visibility === "public";
      if (!publicOnly) {
        this.assertAuthenticated(viewer);
      }
      if (!publicOnly && viewer?.id !== ownerId && !canAccessAdmin(viewer)) {
        throw new ForbiddenException("Можно смотреть только свои мемориалы");
      }
      where.ownerId = ownerId;
    } else if (!viewer || !canAccessAdmin(viewer)) {
      where.isPublic = true;
      where.moderationStatus = MODERATION_APPROVED;
    }
    if (visibility === "public") {
      where.isPublic = true;
      where.moderationStatus = MODERATION_APPROVED;
    } else if (visibility === "private" && ownerId) {
      where.isPublic = false;
    }

    const pets: Prisma.PetGetPayload<{
      include: { memorial: true; photos: true; marker: true };
    }>[] = await this.prisma.pet.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        memorial: true,
        photos: {
          orderBy: { sortOrder: "asc" },
        },
        marker: true,
      },
    });
    await Promise.all(
      pets.map(async (pet) => {
        if (!pet.memorial) {
          return;
        }
        const state = await this.syncDirtState(pet.memorial, now);
        pet.memorial.dustStage = state.dustStage;
        pet.memorial.dustUpdatedAt = state.dustUpdatedAt;
        pet.memorial.sceneJson = this.buildDirtSceneJson(
          pet.memorial.sceneJson,
          state.slots,
          state.nextSlotIndex,
        ) as Prisma.JsonValue;
        if (state.changed) {
          pet.memorial.needsPreviewRefresh = true;
        }
      }),
    );
    return pets;
  }

  async findOne(id: string, viewer?: AuthenticatedUser | null) {
    await this.maintenance.deactivateExpiredMemorials();
    await this.maintenance.deactivateExpiredGifts(id);
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        memorial: true,
        marker: true,
        photos: {
          orderBy: { sortOrder: "asc" },
        },
        owner: {
          select: {
            id: true,
            email: true,
            login: true,
          },
        },
        gifts: {
          where: { isActive: true },
          include: {
            gift: true,
            owner: {
              select: {
                id: true,
                email: true,
                login: true,
                pets: {
                  select: { id: true, name: true },
                  orderBy: { createdAt: "desc" },
                  take: 3,
                },
              },
            },
          },
          orderBy: { placedAt: "desc" },
        },
      },
    });
    if (!pet) {
      throw new NotFoundException("Pet not found");
    }
    const now = new Date();
    if (
      !pet.isActive ||
      pet.memorial?.deactivatedAt ||
      (pet.memorial?.activeUntil && pet.memorial.activeUntil <= now)
    ) {
      throw new NotFoundException("Memorial not found");
    }
    if (
      !this.canManagePet(viewer, pet) &&
      (!pet.isPublic || pet.moderationStatus !== MODERATION_APPROVED)
    ) {
      throw new NotFoundException("Memorial not found");
    }
    if (pet.memorial) {
      const state = await this.syncDirtState(pet.memorial, now);
      pet.memorial.dustStage = state.dustStage;
      pet.memorial.dustUpdatedAt = state.dustUpdatedAt;
      pet.memorial.sceneJson = this.buildDirtSceneJson(
        pet.memorial.sceneJson,
        state.slots,
        state.nextSlotIndex,
      ) as Prisma.JsonValue;
      if (state.changed) {
        pet.memorial.needsPreviewRefresh = true;
      }
    }
    return pet;
  }

  async cleanMemorial(
    id: string,
    viewer: AuthenticatedUser,
    slotName?: DirtSlotName,
  ) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: { memorial: true },
    });
    if (!pet?.memorial) {
      throw new NotFoundException("Memorial not found");
    }
    this.assertAuthenticated(viewer);
    const now = new Date();
    if (
      !pet.isActive ||
      pet.memorial.deactivatedAt ||
      (pet.memorial.activeUntil && pet.memorial.activeUntil <= now) ||
      (!this.canManagePet(viewer, pet) &&
        (!pet.isPublic || pet.moderationStatus !== MODERATION_APPROVED))
    ) {
      throw new NotFoundException("Memorial not found");
    }
    const currentState = this.calculateDirtState(pet.memorial, now);
    const wasFull = currentState.slots.length >= MAX_DUST_STAGE;
    const nextSlots = slotName
      ? currentState.slots.filter((slot) => slot !== slotName)
      : [];
    const removedCount = currentState.slots.length - nextSlots.length;
    const isFullyClean = nextSlots.length === 0;
    const nextSlotIndex = isFullyClean
      ? 1
      : wasFull && slotName
        ? this.getSlotOrderIndex(slotName)
        : currentState.nextSlotIndex;
    const nextDustUpdatedAt =
      isFullyClean || wasFull ? now : currentState.dustUpdatedAt;
    const memorial = await this.prisma.memorial.update({
      where: { id: pet.memorial.id },
      data: {
        dustStage: nextSlots.length,
        dustUpdatedAt: nextDustUpdatedAt,
        sceneJson: this.buildDirtSceneJson(
          pet.memorial.sceneJson,
          nextSlots,
          nextSlotIndex,
        ),
        needsPreviewRefresh: true,
      },
    });
    return {
      dustStage: memorial.dustStage,
      dustUpdatedAt: memorial.dustUpdatedAt,
      activeDirtSlots: nextSlots,
      dirtNextSlotIndex: nextSlotIndex,
      remainingDirtSlots: nextSlots.length,
      removedCount,
    };
  }

  async update(id: string, dto: UpdatePetDto, viewer: AuthenticatedUser) {
    const pet = await this.findOne(id, viewer);
    this.assertCanManagePet(viewer, pet);
    const shouldUpdateMemorial =
      typeof dto.environmentId !== "undefined" ||
      typeof dto.houseId !== "undefined" ||
      typeof dto.sceneJson !== "undefined";
    const shouldUpdateMarker =
      typeof dto.lat !== "undefined" ||
      typeof dto.lng !== "undefined" ||
      typeof dto.markerStyle !== "undefined";
    let memorialUpdate:
      | Prisma.MemorialUpdateOneWithoutPetNestedInput
      | undefined;
    let markerUpdate:
      | Prisma.MapMarkerUpdateOneWithoutPetNestedInput
      | undefined;

    if (shouldUpdateMemorial) {
      if (!pet.memorial) {
        throw new BadRequestException("Мемориал не найден");
      }
      const baseSceneJson =
        pet.memorial.sceneJson &&
        typeof pet.memorial.sceneJson === "object" &&
        !Array.isArray(pet.memorial.sceneJson)
          ? (pet.memorial.sceneJson as Record<string, unknown>)
          : {};
      const nextSceneJsonSource =
        dto.sceneJson &&
        typeof dto.sceneJson === "object" &&
        !Array.isArray(dto.sceneJson)
          ? (dto.sceneJson as Record<string, unknown>)
          : null;
      const baseParts =
        baseSceneJson.parts &&
        typeof baseSceneJson.parts === "object" &&
        !Array.isArray(baseSceneJson.parts)
          ? (baseSceneJson.parts as Record<string, unknown>)
          : {};
      const nextParts =
        nextSceneJsonSource?.parts &&
        typeof nextSceneJsonSource.parts === "object" &&
        !Array.isArray(nextSceneJsonSource.parts)
          ? (nextSceneJsonSource.parts as Record<string, unknown>)
          : null;
      const baseColors =
        baseSceneJson.colors &&
        typeof baseSceneJson.colors === "object" &&
        !Array.isArray(baseSceneJson.colors)
          ? (baseSceneJson.colors as Record<string, unknown>)
          : {};
      const nextColors =
        nextSceneJsonSource?.colors &&
        typeof nextSceneJsonSource.colors === "object" &&
        !Array.isArray(nextSceneJsonSource.colors)
          ? (nextSceneJsonSource.colors as Record<string, unknown>)
          : null;
      const sceneJson = nextSceneJsonSource
        ? ({
            ...baseSceneJson,
            ...nextSceneJsonSource,
            ...(nextParts ? { parts: { ...baseParts, ...nextParts } } : {}),
            ...(nextColors ? { colors: { ...baseColors, ...nextColors } } : {}),
          } as Prisma.InputJsonValue)
        : undefined;

      memorialUpdate = {
        update: {
          ...(typeof dto.environmentId !== "undefined"
            ? { environmentId: dto.environmentId }
            : {}),
          ...(typeof dto.houseId !== "undefined"
            ? { houseId: dto.houseId }
            : {}),
          ...(sceneJson ? { sceneJson } : {}),
          needsPreviewRefresh: true,
        },
      };
    }

    if (shouldUpdateMarker) {
      const nextLat =
        typeof dto.lat !== "undefined" ? dto.lat : pet.marker?.lat;
      const nextLng =
        typeof dto.lng !== "undefined" ? dto.lng : pet.marker?.lng;
      if (typeof nextLat !== "number" || typeof nextLng !== "number") {
        throw new BadRequestException("Укажите точку на карте");
      }
      const markerStyle =
        typeof dto.markerStyle !== "undefined"
          ? dto.markerStyle
          : (pet.marker?.markerStyle ?? null);
      markerUpdate = pet.marker
        ? {
            update: {
              lat: nextLat,
              lng: nextLng,
              markerStyle,
            },
          }
        : {
            create: {
              lat: nextLat,
              lng: nextLng,
              markerStyle,
            },
          };
    }

    const moderationChangedBlocks = this.getModerationChangedBlocks(dto);
    const shouldResetModeration = this.shouldResetModeration(
      viewer,
      moderationChangedBlocks.length > 0,
    );

    return this.prisma.pet.update({
      where: { id },
      data: {
        name: dto.name,
        species: dto.species,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        deathDate: dto.deathDate ? new Date(dto.deathDate) : undefined,
        epitaph: dto.epitaph,
        favoriteTreats: dto.favoriteTreats,
        favoriteToys: dto.favoriteToys,
        favoriteSleepPlaces: dto.favoriteSleepPlaces,
        story: dto.story,
        isPublic: dto.isPublic,
        ...(shouldResetModeration
          ? this.moderationResetData(pet, moderationChangedBlocks)
          : {}),
        memorial: memorialUpdate,
        marker: markerUpdate,
      },
    });
  }

  async remove(id: string, viewer: AuthenticatedUser) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: { memorial: true },
    });
    if (!pet) {
      throw new NotFoundException("Pet not found");
    }
    this.assertCanManagePet(viewer, pet);
    const now = new Date();
    return this.prisma.pet.update({
      where: { id },
      data: {
        isActive: false,
        isPublic: false,
        deactivatedAt: now,
        deactivationReason: "deleted",
        memorial: pet.memorial
          ? {
              update: {
                deactivatedAt: now,
                deactivationReason: "deleted",
              },
            }
          : undefined,
      },
      include: { memorial: true },
    });
  }

  async extendMemorial(
    id: string,
    ownerId: string,
    years: number,
    viewer: AuthenticatedUser,
  ) {
    const pet = await this.findOne(id, viewer);
    if (pet.ownerId !== ownerId || viewer.id !== ownerId) {
      throw new BadRequestException("Продлить мемориал может только владелец");
    }
    if (!pet.memorial) {
      throw new BadRequestException("Мемориал не найден");
    }
    const user = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }
    const price = await this.pricing.getMemorialPlanPrice(years);
    if (user.coinBalance < price) {
      throw new BadRequestException(
        "Недостаточно монет для продления мемориала",
      );
    }
    const now = new Date();
    const base =
      pet.memorial.activeUntil && pet.memorial.activeUntil > now
        ? pet.memorial.activeUntil
        : now;
    const activeUntil = years === 0 ? null : this.addYears(base, years);
    const baseSceneJson =
      pet.memorial.sceneJson &&
      typeof pet.memorial.sceneJson === "object" &&
      !Array.isArray(pet.memorial.sceneJson)
        ? (pet.memorial.sceneJson as Record<string, unknown>)
        : {};
    const sceneJson: Prisma.InputJsonValue = {
      ...baseSceneJson,
      memorialPaidUntil: activeUntil ? activeUntil.toISOString() : null,
      memorialLastExtendedAt: now.toISOString(),
      memorialLastExtensionYears: years,
      memorialLastExtensionPrice: price,
    };
    const { updatedUser, memorial } = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updated = await tx.user.update({
          where: { id: ownerId },
          data: { coinBalance: { decrement: price } },
        });
        await tx.walletTransaction.create({
          data: {
            userId: ownerId,
            amount: -price,
            balanceAfter: updated.coinBalance,
            type: "memorial_extend",
            title: years === 0 ? "Мемориал навсегда" : "Продление мемориала",
            details: `${pet.name}: ${years === 0 ? "без ограничения времени" : `${years} г.`}`,
          },
        });
        const updatedMemorial = await tx.memorial.update({
          where: { petId: id },
          data: { activeUntil, sceneJson },
        });
        return { updatedUser: updated, memorial: updatedMemorial };
      },
    );
    return {
      activeUntil: memorial.activeUntil,
      coinBalance: updatedUser.coinBalance,
      spent: price,
    };
  }

  async addPhoto(
    petId: string,
    file: { originalname: string; buffer: Buffer },
    viewer: AuthenticatedUser,
  ) {
    const pet = await this.findOne(petId, viewer);
    this.assertCanManagePet(viewer, pet);
    const count = await this.prisma.petPhoto.count({ where: { petId } });
    if (count >= 10) {
      throw new BadRequestException("Можно добавить максимум 10 фото");
    }

    const ext = extname(file.originalname) || ".jpg";
    const safeExt = ext.length <= 8 ? ext : ".jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
    const key = `pets/${petId}/${fileName}`;
    const contentType = file.originalname.endsWith(".png")
      ? "image/png"
      : "image/jpeg";
    const url = await this.s3.uploadPublic(key, file.buffer, contentType);
    const shouldResetModeration = this.shouldResetModeration(viewer, true);
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const photo = await tx.petPhoto.create({
        data: {
          petId,
          url,
          sortOrder: count,
        },
      });
      if (shouldResetModeration) {
        await tx.pet.update({
          where: { id: petId },
          data: this.moderationResetData(pet, ["photos"]),
        });
      }
      return photo;
    });
  }

  async removePhoto(petId: string, photoId: string, viewer: AuthenticatedUser) {
    const pet = await this.findOne(petId, viewer);
    this.assertCanManagePet(viewer, pet);
    const photo = await this.prisma.petPhoto.findUnique({
      where: { id: photoId },
    });
    if (!photo || photo.petId !== petId) {
      throw new BadRequestException("Фото не найдено для этого мемориала");
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.petPhoto.delete({ where: { id: photoId } });
      const remaining = await tx.petPhoto.findMany({
        where: { petId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      await Promise.all(
        remaining.map(
          (item: { id: string; sortOrder: number }, index: number) =>
            item.sortOrder === index
              ? Promise.resolve()
              : tx.petPhoto.update({
                  where: { id: item.id },
                  data: { sortOrder: index },
                }),
        ),
      );
      const marker = await tx.mapMarker.findUnique({ where: { petId } });
      if (marker?.previewPhotoId === photoId) {
        await tx.mapMarker.update({
          where: { petId },
          data: { previewPhotoId: remaining[0]?.id ?? null },
        });
      }
      if (this.shouldResetModeration(viewer, true)) {
        await tx.pet.update({
          where: { id: petId },
          data: this.moderationResetData(pet, ["photos"]),
        });
      }
    });

    return { ok: true };
  }

  async setMapPreview(
    petId: string,
    file: { originalname: string; buffer: Buffer },
    viewer: AuthenticatedUser,
  ) {
    const pet = await this.findOne(petId, viewer);
    this.assertCanManagePet(viewer, pet);
    const memorial = await this.prisma.memorial.findUnique({
      where: { petId },
    });
    if (!memorial) {
      throw new BadRequestException("Мемориал не найден");
    }
    const ext = extname(file.originalname).toLowerCase() || ".png";
    const safeExt = ext.length <= 8 ? ext : ".png";
    const contentType = safeExt === ".png" ? "image/png" : "image/jpeg";
    const key = `pets/${petId}/map-preview${safeExt}`;
    const url = await this.s3.uploadPublic(key, file.buffer, contentType);
    const baseSceneJson =
      memorial.sceneJson &&
      typeof memorial.sceneJson === "object" &&
      !Array.isArray(memorial.sceneJson)
        ? (memorial.sceneJson as Record<string, unknown>)
        : {};
    const { slots: activeDirtSlots } = this.readDirtSlots(
      baseSceneJson,
      memorial.dustStage,
    );
    const nextSceneJson: Prisma.InputJsonValue = {
      ...baseSceneJson,
      previewImageUrl: url,
      previewDustStage: memorial.dustStage,
      previewDustUpdatedAt: memorial.dustUpdatedAt?.toISOString() ?? null,
      previewDirtSlots: activeDirtSlots,
    };
    await this.prisma.memorial.update({
      where: { petId },
      data: {
        sceneJson: nextSceneJson,
        needsPreviewRefresh: false,
        previewUpdatedAt: new Date(),
      },
    });
    return {
      url,
      previewDustStage: memorial.dustStage,
      previewDustUpdatedAt: memorial.dustUpdatedAt?.toISOString() ?? null,
      previewDirtSlots: activeDirtSlots,
    };
  }

  async setPreviewPhoto(
    petId: string,
    photoId: string,
    viewer: AuthenticatedUser,
  ) {
    const pet = await this.findOne(petId, viewer);
    this.assertCanManagePet(viewer, pet);
    const photo = await this.prisma.petPhoto.findUnique({
      where: { id: photoId },
    });
    if (!photo || photo.petId !== petId) {
      throw new BadRequestException("Фото не найдено для этого мемориала");
    }
    const marker = await this.prisma.mapMarker.findUnique({ where: { petId } });
    if (!marker) {
      throw new BadRequestException("Маркер не найден для мемориала");
    }
    const shouldResetModeration = this.shouldResetModeration(
      viewer,
      marker.previewPhotoId !== photoId,
    );
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.mapMarker.update({
        where: { petId },
        data: { previewPhotoId: photoId },
      });
      if (shouldResetModeration) {
        await tx.pet.update({
          where: { id: petId },
          data: this.moderationResetData(pet, ["photos"]),
        });
      }
    });
    return { ok: true };
  }

  private addYears(date: Date, years: number) {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
  }
}
