import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
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
const DEFAULT_MAX_MEMORIALS = 5;
const OWNER_MAX_MEMORIALS = 10000;

@Injectable()
export class PetsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(S3Service) private readonly s3: S3Service,
    @Inject(MaintenanceService) private readonly maintenance: MaintenanceService,
    @Inject(PricingService) private readonly pricing: PricingService
  ) {}

  private async ensureOwner(ownerId: string) {
    const safeId = ownerId.trim();
    const existing = await this.prisma.user.findUnique({
      where: { id: safeId }
    });
    if (existing) {
      return existing;
    }
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

  private calculateDustStage(
    memorial: { dustUpdatedAt?: Date | null; createdAt?: Date | null },
    now: Date
  ) {
    const base = memorial.dustUpdatedAt ?? memorial.createdAt ?? now;
    const elapsed = Math.max(0, now.getTime() - base.getTime());
    return Math.min(MAX_DUST_STAGE, Math.floor(elapsed / DUST_INTERVAL_MS));
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
          OR: [{ activeUntil: null }, { activeUntil: { gt: now } }]
        }
      }
    };
  }

  private canManagePet(
    user: AuthenticatedUser | null | undefined,
    pet: { ownerId: string }
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
    pet: { ownerId: string }
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
      where: { ownerId: owner.id, ...this.activePetWhere() }
    });
    return {
      ownerId: owner.id,
      currentCount,
      maxMemorials,
      canCreate: currentCount < maxMemorials
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
      where: { ownerId: owner.id, ...this.activePetWhere() }
    });
    if (currentCount >= maxMemorials) {
      throw new BadRequestException(
        `Достигнут лимит мемориалов: ${maxMemorials}. Для увеличения лимита напишите на primer@gmail.com`
      );
    }
    const planYears =
      typeof dto.memorialPlanYears === "number" ? dto.memorialPlanYears : 1;
    const planPrice = await this.pricing.getMemorialPlanPrice(planYears);
    if (owner.coinBalance < planPrice) {
      throw new BadRequestException("Недостаточно монет для создания мемориала");
    }
    const hasCoords = typeof dto.lat === "number" && typeof dto.lng === "number";
    const now = new Date();
    const paidUntil = planYears === 0 ? null : this.addYears(now, planYears);
    const baseSceneJson =
      dto.sceneJson && typeof dto.sceneJson === "object" && !Array.isArray(dto.sceneJson)
        ? (dto.sceneJson as Record<string, unknown>)
        : {};
    const sceneJson: Prisma.InputJsonValue = {
      ...baseSceneJson,
      memorialPaidAt: now.toISOString(),
      memorialPaidUntil: paidUntil ? paidUntil.toISOString() : null,
      memorialPlanYears: planYears,
      memorialPaidPrice: planPrice
    };

    const [, pet] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: owner.id },
        data: { coinBalance: { decrement: planPrice } }
      }),
      this.prisma.pet.create({
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
          isActive: true,
          createdAt: now,
          memorial: {
            create: {
              environmentId: dto.environmentId ?? null,
              houseId: dto.houseId ?? null,
              sceneJson,
              dustUpdatedAt: now,
              activeUntil: paidUntil,
              createdAt: now
            }
          },
          marker: hasCoords
            ? {
                create: {
                  lat: dto.lat!,
                  lng: dto.lng!,
                  markerStyle: dto.markerStyle ?? null,
                  createdAt: now
                }
              }
            : undefined
        }
      })
    ]);

    return pet;
  }

  private buildDraftData(dto: SaveMemorialDraftDto, ownerId: string) {
    const name = typeof dto.name === "string" ? dto.name.trim() : "";
    if (!name) {
      throw new BadRequestException("Имя питомца обязательно");
    }
    const hasCoords = typeof dto.lat === "number" && typeof dto.lng === "number";
    const sceneJson =
      dto.sceneJson && typeof dto.sceneJson === "object" && !Array.isArray(dto.sceneJson)
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
      step: typeof dto.step === "number" ? Math.max(0, Math.min(1, Math.round(dto.step))) : 1
    };
  }

  async findDrafts(ownerId: string) {
    return this.prisma.memorialDraft.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" }
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
        where: { id: dto.id }
      });
      if (existing) {
        if (existing.ownerId !== viewer.id && !canAccessAdmin(viewer)) {
          throw new ForbiddenException("Можно менять только свои черновики");
        }
        return this.prisma.memorialDraft.update({
          where: { id: existing.id },
          data
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
    viewer?: AuthenticatedUser | null
  ) {
    await this.maintenance.deactivateExpiredMemorials();
    const where: Prisma.PetWhereInput = this.activePetWhere();
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
    }
    if (visibility === "public") {
      where.isPublic = true;
    } else if (visibility === "private" && ownerId) {
      where.isPublic = false;
    }

    return this.prisma.pet.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        memorial: true,
        photos: {
          orderBy: { sortOrder: "asc" }
        },
        marker: true
      }
    });
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
          orderBy: { sortOrder: "asc" }
        },
        owner: {
          select: {
            id: true,
            email: true,
            login: true
          }
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
                pets: { select: { id: true, name: true } }
              }
            }
          },
          orderBy: { placedAt: "desc" }
        }
      }
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
    if (!pet.isPublic && !this.canManagePet(viewer, pet)) {
      throw new NotFoundException("Memorial not found");
    }
    if (pet.memorial) {
      const nextStage = this.calculateDustStage(pet.memorial, now);
      if (nextStage !== pet.memorial.dustStage) {
        await this.prisma.memorial.update({
          where: { id: pet.memorial.id },
          data: { dustStage: nextStage }
        });
        pet.memorial.dustStage = nextStage;
      }
    }
    return pet;
  }

  async cleanMemorial(id: string, viewer: AuthenticatedUser) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: { memorial: true }
    });
    if (!pet?.memorial) {
      throw new NotFoundException("Memorial not found");
    }
    this.assertCanManagePet(viewer, pet);
    const now = new Date();
    const memorial = await this.prisma.memorial.update({
      where: { id: pet.memorial.id },
      data: {
        dustStage: 0,
        dustUpdatedAt: now
      }
    });
    return { dustStage: memorial.dustStage, dustUpdatedAt: memorial.dustUpdatedAt };
  }

  async update(id: string, dto: UpdatePetDto, viewer: AuthenticatedUser) {
    const pet = await this.findOne(id, viewer);
    this.assertCanManagePet(viewer, pet);
    const shouldUpdateMemorial =
      typeof dto.houseId !== "undefined" || typeof dto.sceneJson !== "undefined";
    let memorialUpdate:
      | Prisma.MemorialUpdateOneWithoutPetNestedInput
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
        dto.sceneJson && typeof dto.sceneJson === "object" && !Array.isArray(dto.sceneJson)
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
            ...(nextColors ? { colors: { ...baseColors, ...nextColors } } : {})
          } as Prisma.InputJsonValue)
        : undefined;

      memorialUpdate = {
        update: {
          ...(typeof dto.houseId !== "undefined" ? { houseId: dto.houseId } : {}),
          ...(sceneJson ? { sceneJson } : {}),
          needsPreviewRefresh: true
        }
      };
    }

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
        memorial: memorialUpdate
      }
    });
  }

  async remove(id: string, viewer: AuthenticatedUser) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: { memorial: true }
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
                deactivationReason: "deleted"
              }
            }
          : undefined
      },
      include: { memorial: true }
    });
  }

  async extendMemorial(
    id: string,
    ownerId: string,
    years: number,
    viewer: AuthenticatedUser
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
      throw new BadRequestException("Недостаточно монет для продления мемориала");
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
      memorialLastExtensionPrice: price
    };
    const [updatedUser, memorial] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: ownerId },
        data: { coinBalance: { decrement: price } }
      }),
      this.prisma.memorial.update({
        where: { petId: id },
        data: { activeUntil, sceneJson }
      })
    ]);
    return {
      activeUntil: memorial.activeUntil,
      coinBalance: updatedUser.coinBalance,
      spent: price
    };
  }

  async addPhoto(
    petId: string,
    file: { originalname: string; buffer: Buffer },
    viewer: AuthenticatedUser
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
    const contentType = file.originalname.endsWith(".png") ? "image/png" : "image/jpeg";
    const url = await this.s3.uploadPublic(key, file.buffer, contentType);
    return this.prisma.petPhoto.create({
      data: {
        petId,
        url,
        sortOrder: count
      }
    });
  }

  async removePhoto(petId: string, photoId: string, viewer: AuthenticatedUser) {
    const pet = await this.findOne(petId, viewer);
    this.assertCanManagePet(viewer, pet);
    const photo = await this.prisma.petPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.petId !== petId) {
      throw new BadRequestException("Фото не найдено для этого мемориала");
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.petPhoto.delete({ where: { id: photoId } });
      const remaining = await tx.petPhoto.findMany({
        where: { petId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      });
      await Promise.all(
        remaining.map((item: { id: string; sortOrder: number }, index: number) =>
          item.sortOrder === index
            ? Promise.resolve()
            : tx.petPhoto.update({
                where: { id: item.id },
                data: { sortOrder: index }
              })
        )
      );
      const marker = await tx.mapMarker.findUnique({ where: { petId } });
      if (marker?.previewPhotoId === photoId) {
        await tx.mapMarker.update({
          where: { petId },
          data: { previewPhotoId: remaining[0]?.id ?? null }
        });
      }
    });

    return { ok: true };
  }

  async setMapPreview(
    petId: string,
    file: { originalname: string; buffer: Buffer },
    viewer: AuthenticatedUser
  ) {
    const pet = await this.findOne(petId, viewer);
    this.assertCanManagePet(viewer, pet);
    const memorial = await this.prisma.memorial.findUnique({ where: { petId } });
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
    const nextSceneJson: Prisma.InputJsonValue = {
      ...baseSceneJson,
      previewImageUrl: url
    };
    await this.prisma.memorial.update({
      where: { petId },
      data: {
        sceneJson: nextSceneJson,
        needsPreviewRefresh: false,
        previewUpdatedAt: new Date()
      }
    });
    return { url };
  }

  async setPreviewPhoto(petId: string, photoId: string, viewer: AuthenticatedUser) {
    const pet = await this.findOne(petId, viewer);
    this.assertCanManagePet(viewer, pet);
    const photo = await this.prisma.petPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.petId !== petId) {
      throw new BadRequestException("Фото не найдено для этого мемориала");
    }
    const marker = await this.prisma.mapMarker.findUnique({ where: { petId } });
    if (!marker) {
      throw new BadRequestException("Маркер не найден для мемориала");
    }
    await this.prisma.mapMarker.update({
      where: { petId },
      data: { previewPhotoId: photoId }
    });
    return { ok: true };
  }

  private addYears(date: Date, years: number) {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
  }
}
