import { Controller, Get, Inject } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type MarkerWithPet = Prisma.MapMarkerGetPayload<{
  include: {
    pet: {
      include: {
        photos: true;
      };
    };
  };
}>;

@Controller("map")
export class MapController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("markers")
  async getMarkers() {
    const markers: MarkerWithPet[] = await this.prisma.mapMarker.findMany({
      where: {
        pet: {
          isPublic: true
        }
      },
      include: {
        pet: {
          include: {
            photos: true
          }
        }
      }
    });

    return markers.map((marker) => {
      const previewPhoto = marker.previewPhotoId
        ? marker.pet.photos.find((photo) => photo.id === marker.previewPhotoId)
        : marker.pet.photos[0];

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
        previewPhotoUrl: previewPhoto?.url ?? null
      };
    });
  }
}
