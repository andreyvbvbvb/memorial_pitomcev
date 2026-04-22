import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { extname } from "path";
import { isOwnerUser } from "../auth/access-level";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../storage/s3.service";
import { CreatePetDto } from "./dto/create-pet.dto";
import { UpdatePetDto } from "./dto/update-pet.dto";

const MEMORIAL_PLAN_PRICES = new Map<number, number>([
  [1, 100],
  [2, 200],
  [5, 500],
  [0, 1500]
]);
const DUST_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_DUST_STAGE = 4;
const DEFAULT_MAX_MEMORIALS = 5;
const OWNER_MAX_MEMORIALS = 10000;

@Injectable()
export class PetsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(S3Service) private readonly s3: S3Service
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

  async getCreationLimit(ownerId: string) {
    const owner = await this.ensureOwner(ownerId);
    const maxMemorials = this.resolveMaxMemorials(owner);
    const currentCount = await this.prisma.pet.count({
      where: { ownerId: owner.id }
    });
    return {
      ownerId: owner.id,
      currentCount,
      maxMemorials,
      canCreate: currentCount < maxMemorials
    };
  }

  async create(dto: CreatePetDto) {
    const owner = await this.ensureOwner(dto.ownerId);
    const maxMemorials = this.resolveMaxMemorials(owner);
    const currentCount = await this.prisma.pet.count({
      where: { ownerId: owner.id }
    });
    if (currentCount >= maxMemorials) {
      throw new BadRequestException(
        `Достигнут лимит мемориалов: ${maxMemorials}. Для увеличения лимита напишите на primer@gmail.com`
      );
    }
    const planYears =
      typeof dto.memorialPlanYears === "number" ? dto.memorialPlanYears : 1;
    const planPrice = MEMORIAL_PLAN_PRICES.get(planYears);
    if (planPrice === undefined) {
      throw new BadRequestException("Неверный тариф оплаты мемориала");
    }
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
          name: dto.name,
          species: dto.species ?? null,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          deathDate: dto.deathDate ? new Date(dto.deathDate) : null,
          epitaph: dto.epitaph ?? null,
          favoriteTreats: dto.favoriteTreats ?? null,
          favoriteToys: dto.favoriteToys ?? null,
          favoriteSleepPlaces: dto.favoriteSleepPlaces ?? null,
          story: dto.story ?? null,
          isPublic: dto.isPublic ?? false,
          createdAt: now,
          memorial: {
            create: {
              environmentId: dto.environmentId ?? null,
              houseId: dto.houseId ?? null,
              sceneJson,
              dustUpdatedAt: now,
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

  async findAll(ownerId?: string, visibility?: string) {
    const where: { ownerId?: string; isPublic?: boolean } = {};
    if (ownerId) {
      where.ownerId = ownerId;
    }
    if (visibility === "public") {
      where.isPublic = true;
    } else if (visibility === "private") {
      where.isPublic = false;
    }

    return this.prisma.pet.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
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

  async findOne(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        memorial: true,
        marker: true,
        photos: true,
        owner: {
          select: {
            id: true,
            email: true,
            login: true
          }
        },
        gifts: {
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
    if (pet.memorial) {
      const now = new Date();
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

  async cleanMemorial(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: { memorial: true }
    });
    if (!pet?.memorial) {
      throw new NotFoundException("Memorial not found");
    }
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

  async update(id: string, dto: UpdatePetDto) {
    await this.findOne(id);
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
        isPublic: dto.isPublic
      }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.pet.delete({
      where: { id }
    });
  }

  async addPhoto(petId: string, file: { originalname: string; buffer: Buffer }) {
    await this.findOne(petId);
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

  async setMapPreview(petId: string, file: { originalname: string; buffer: Buffer }) {
    await this.findOne(petId);
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
      data: { sceneJson: nextSceneJson }
    });
    return { url };
  }

  async setPreviewPhoto(petId: string, photoId: string) {
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
