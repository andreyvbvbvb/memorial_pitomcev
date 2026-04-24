import { Controller, Get, Inject } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type MarkerWithPet = Prisma.MapMarkerGetPayload<{
  include: {
    pet: {
      include: {
        photos: true;
        memorial: true;
      };
    };
  };
}>;

@Controller("map")
export class MapController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("markers")
  async getMarkers() {
    const now = new Date();
    const expired = await this.prisma.memorial.findMany({
      where: {
        deactivatedAt: null,
        activeUntil: { lte: now },
        pet: { isActive: true }
      },
      select: { id: true, petId: true }
    });
    if (expired.length > 0) {
      await this.prisma.$transaction([
        this.prisma.memorial.updateMany({
          where: { id: { in: expired.map((item: { id: string; petId: string }) => item.id) } },
          data: {
            deactivatedAt: now,
            deactivationReason: "expired"
          }
        }),
        this.prisma.pet.updateMany({
          where: { id: { in: expired.map((item: { id: string; petId: string }) => item.petId) } },
          data: {
            isActive: false,
            deactivatedAt: now,
            deactivationReason: "expired"
          }
        })
      ]);
    }
    const markers: MarkerWithPet[] = await this.prisma.mapMarker.findMany({
      where: {
        pet: {
          isPublic: true,
          isActive: true,
          memorial: {
            is: {
              deactivatedAt: null,
              OR: [{ activeUntil: null }, { activeUntil: { gt: now } }]
            }
          }
        }
      },
      include: {
        pet: {
          include: {
            photos: true,
            memorial: true
          }
        }
      }
    });

    return markers.map((marker) => {
      const previewPhoto = marker.previewPhotoId
        ? marker.pet.photos.find((photo) => photo.id === marker.previewPhotoId)
        : marker.pet.photos[0];
      const sceneJson = marker.pet.memorial?.sceneJson;
      const rawPreviewImageUrl =
        sceneJson && typeof sceneJson === "object" && !Array.isArray(sceneJson)
          ? (sceneJson as Record<string, unknown>).previewImageUrl
          : null;
      const previewUpdatedAt = marker.pet.memorial?.previewUpdatedAt;
      const previewImageUrl =
        typeof rawPreviewImageUrl === "string"
          ? previewUpdatedAt
            ? `${rawPreviewImageUrl}${rawPreviewImageUrl.includes("?") ? "&" : "?"}v=${previewUpdatedAt.getTime()}`
            : rawPreviewImageUrl
          : null;

      return {
        id: marker.id,
        petId: marker.petId,
        name: marker.pet.name,
        epitaph: marker.pet.epitaph,
        birthDate: marker.pet.birthDate,
        deathDate: marker.pet.deathDate,
        lat: marker.lat,
        lng: marker.lng,
        markerStyle: marker.markerStyle ?? null,
        previewPhotoUrl: previewPhoto?.url ?? null,
        previewImageUrl
      };
    });
  }
}
