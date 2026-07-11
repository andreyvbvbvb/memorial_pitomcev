import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { canAccessAdmin } from "../auth/access-level";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { AuthService } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { CleanMemorialDto } from "./dto/clean-memorial.dto";
import { CreatePetDto } from "./dto/create-pet.dto";
import { ExtendMemorialDto } from "./dto/extend-memorial.dto";
import { SaveMemorialDraftDto } from "./dto/save-memorial-draft.dto";
import { SetPreviewPhotoDto } from "./dto/set-preview-photo.dto";
import { UpdatePetDto } from "./dto/update-pet.dto";
import { PetsService } from "./pets.service";

@Controller("pets")
export class PetsController {
  constructor(
    @Inject(PetsService) private readonly petsService: PetsService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  private getOptionalUser(req: Request) {
    return this.authService.getUserFromToken(req.cookies?.access_token);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreatePetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.petsService.create({ ...dto, ownerId: user.id });
  }

  @Get()
  async findAll(
    @Req() req: Request,
    @Query("ownerId") ownerId?: string,
    @Query("visibility") visibility?: string
  ) {
    const user = await this.getOptionalUser(req);
    return this.petsService.findAll(ownerId, visibility, user);
  }

  @Get("create-limit/:ownerId")
  @UseGuards(AuthGuard)
  getCreationLimit(
    @Param("ownerId") ownerId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (ownerId !== user.id && !canAccessAdmin(user)) {
      throw new ForbiddenException("Можно смотреть только свой лимит");
    }
    return this.petsService.getCreationLimit(ownerId);
  }

  @Get("drafts")
  @UseGuards(AuthGuard)
  findDrafts(@CurrentUser() user: AuthenticatedUser) {
    return this.petsService.findDrafts(user.id);
  }

  @Get("drafts/:id")
  @UseGuards(AuthGuard)
  findDraft(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.petsService.findDraft(id, user);
  }

  @Post("drafts")
  @UseGuards(AuthGuard)
  saveDraft(
    @Body() dto: SaveMemorialDraftDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.petsService.saveDraft(dto, user);
  }

  @Delete("drafts/:id")
  @UseGuards(AuthGuard)
  removeDraft(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.petsService.removeDraft(id, user);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Req() req: Request) {
    const user = await this.getOptionalUser(req);
    return this.petsService.findOne(id, user);
  }

  @Get(":id/export")
  @UseGuards(AuthGuard)
  async exportMemorial(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response
  ) {
    const archive = await this.petsService.exportMemorialArchive(id, user);
    response.setHeader("Content-Type", "application/zip");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="memorial_${id}_archive.zip"; filename*=UTF-8''${encodeURIComponent(
        archive.fileName
      )}`
    );
    response.send(archive.buffer);
  }

  @Post(":id/photos")
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  addPhoto(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: { originalname: string; buffer: Buffer }
  ) {
    if (!file) {
      throw new BadRequestException("Файл не найден");
    }
    return this.petsService.addPhoto(id, file, user);
  }

  @Post(":id/map-preview")
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  setMapPreview(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: { originalname: string; buffer: Buffer }
  ) {
    if (!file) {
      throw new BadRequestException("Файл не найден");
    }
    return this.petsService.setMapPreview(id, file, user);
  }

  @Patch(":id/preview-photo")
  @UseGuards(AuthGuard)
  setPreviewPhoto(
    @Param("id") id: string,
    @Body() dto: SetPreviewPhotoDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.petsService.setPreviewPhoto(id, dto.photoId, user);
  }

  @Delete(":id/photos/:photoId")
  @UseGuards(AuthGuard)
  removePhoto(
    @Param("id") id: string,
    @Param("photoId") photoId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.petsService.removePhoto(id, photoId, user);
  }

  @Patch(":id")
  @UseGuards(AuthGuard)
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePetDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.petsService.update(id, dto, user);
  }

  @Patch(":id/memorial/clean")
  @UseGuards(AuthGuard)
  cleanMemorial(
    @Param("id") id: string,
    @Body() dto: CleanMemorialDto = {},
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.petsService.cleanMemorial(id, user, dto.slot);
  }

  @Patch(":id/memorial/extend")
  @UseGuards(AuthGuard)
  extendMemorial(
    @Param("id") id: string,
    @Body() dto: ExtendMemorialDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.petsService.extendMemorial(id, user.id, dto.years, user);
  }

  @Delete(":id")
  @UseGuards(AuthGuard)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.petsService.remove(id, user);
  }
}
