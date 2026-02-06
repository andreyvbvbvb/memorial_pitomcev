import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { extname } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../storage/s3.service";
import { CreatePetDto } from "./dto/create-pet.dto";
import { UpdatePetDto } from "./dto/update-pet.dto";

@Injectable()
export class PetsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(S3Service) private readonly s3: S3Service
  ) {}

  private async ensureOwner(ownerId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: ownerId }
    });
    if (existing) {
      return;
    }
    const safeId = ownerId.trim();
    const email =
      safeId.includes("@") ? safeId : `${safeId.replace(/\s+/g, "_")}@dev.local`;
    await this.prisma.user.create({
      data: {
        id: safeId,
        email
      }
    });
  }

  async create(dto: CreatePetDto) {
    await this.ensureOwner(dto.ownerId);
    const hasCoords = typeof dto.lat === "number" && typeof dto.lng === "number";

    return this.prisma.pet.create({
      data: {
        ownerId: dto.ownerId,
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
        memorial: {
          create: {
            environmentId: dto.environmentId ?? null,
            houseId: dto.houseId ?? null,
            sceneJson:
              dto.sceneJson === undefined
                ? undefined
                : (dto.sceneJson as Prisma.InputJsonValue)
          }
        },
        marker: hasCoords
          ? {
              create: {
                lat: dto.lat!,
                lng: dto.lng!,
                markerStyle: dto.markerStyle ?? null
              }
            }
          : undefined
      }
    });
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
    return pet;
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
    if (count >= 5) {
      throw new BadRequestException("Можно добавить максимум 5 фото");
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
}
