import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CreatePetDto } from "./dto/create-pet.dto";
import { SetPreviewPhotoDto } from "./dto/set-preview-photo.dto";
import { UpdatePetDto } from "./dto/update-pet.dto";
import { PetsService } from "./pets.service";

@Controller("pets")
export class PetsController {
  constructor(@Inject(PetsService) private readonly petsService: PetsService) {}

  @Post()
  create(@Body() dto: CreatePetDto) {
    return this.petsService.create(dto);
  }

  @Get()
  findAll(@Query("ownerId") ownerId?: string, @Query("visibility") visibility?: string) {
    return this.petsService.findAll(ownerId, visibility);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.petsService.findOne(id);
  }

  @Post(":id/photos")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  addPhoto(
    @Param("id") id: string,
    @UploadedFile() file?: { originalname: string; buffer: Buffer }
  ) {
    if (!file) {
      throw new BadRequestException("Файл не найден");
    }
    return this.petsService.addPhoto(id, file);
  }

  @Patch(":id/preview-photo")
  setPreviewPhoto(@Param("id") id: string, @Body() dto: SetPreviewPhotoDto) {
    return this.petsService.setPreviewPhoto(id, dto.photoId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePetDto) {
    return this.petsService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.petsService.remove(id);
  }
}
