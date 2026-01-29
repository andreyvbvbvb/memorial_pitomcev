import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { promises as fs } from "fs";
import { extname, join } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePetDto } from "./dto/create-pet.dto";
import { UpdatePetDto } from "./dto/update-pet.dto";

@Injectable()
export class PetsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
        story: dto.story ?? null,
        isPublic: dto.isPublic ?? false,
        memorial: {
          create: {
            environmentId: dto.environmentId ?? null,
            houseId: dto.houseId ?? null,
            sceneJson: dto.sceneJson ?? null
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
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        memorial: true,
        marker: true,
        photos: true,
        gifts: {
          include: {
            gift: true,
            owner: true
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
    const uploadDir = join(process.cwd(), "uploads", "pets", petId);
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    const url = `/uploads/pets/${petId}/${fileName}`;
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
