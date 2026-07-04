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
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from "@nestjs/platform-express";
import { Prisma } from "@prisma/client";
import { Request } from "express";
import { extname } from "path";
import {
  canAccessAdmin,
  canManageAdmins,
  getAccessLevel,
  isOwnerUser,
} from "../auth/access-level";
import * as bcrypt from "bcryptjs";
import { AuthService } from "../auth/auth.service";
import { GiftsService } from "../gifts/gifts.service";
import { MailService } from "../mail/mail.service";
import { PricingService } from "../pricing/pricing.service";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../storage/s3.service";
import { AdminBulkCreateUsersDto } from "./dto/admin-bulk-create-users.dto";
import { AdminDocumentUploadDto } from "./dto/admin-document.dto";
import {
  AdminModerationDto,
  MODERATION_STATUSES,
} from "./dto/admin-moderation.dto";
import { AdminNewsDto } from "./dto/admin-news.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";
import { AdminAddCoinsDto } from "./dto/admin-add-coins.dto";
import {
  AdminDeactivateAllGiftsDto,
  AdminMoveGiftPlacementDto,
} from "./dto/admin-gift-placement.dto";
import { AdminModelMetadataDto } from "./dto/admin-model-metadata.dto";
import {
  AdminLoadingTipCreateDto,
  AdminLoadingTipUpdateDto,
} from "./dto/admin-loading-tip.dto";
import { AdminUpdateMemorialLimitDto } from "./dto/admin-update-memorial-limit.dto";
import { AdminUpdateUserRoleDto } from "./dto/admin-update-user-role.dto";
import { AdminSqlDto } from "./dto/admin-sql.dto";
import { AdminSiteBannerDto } from "./dto/admin-site-banner.dto";
import {
  AdminUpdateGiftPriceDto,
  AdminUpdateMemorialPlanPriceDto,
  AdminUpdateMemorialPublicationModeDto,
} from "./dto/admin-pricing.dto";
import { DEFAULT_LOADING_TIPS } from "../content/loading-tips.constants";
import {
  HERO_VIDEO_SETTING_KEY,
  normalizeHeroVideoSetting,
} from "../content/hero-video-setting";
import { AdminPerformanceService } from "./admin-performance.service";

const MODERATION_REVIEW_REVISION = "REVISION";
const K6_WORKFLOW_URL =
  "https://github.com/andreyvbvbvb/memorial_pitomcev/actions/workflows/k6-production.yml";
const EXTERNAL_K6_PROFILES = {
  "mixed-500": {
    id: "mixed-500",
    label: "Внешний k6 · смешанный · до 500 VU",
    suite: "mixed",
    virtualUsers: 500,
    rampUpSeconds: 30,
    holdSeconds: 45,
    rampDownSeconds: 15,
    monitorSeconds: 150,
  },
  "split-1000": {
    id: "split-1000",
    label: "Внешний k6 · API + web · до 1000 VU",
    suite: "split",
    virtualUsers: 1000,
    rampUpSeconds: 60,
    holdSeconds: 45,
    rampDownSeconds: 30,
    monitorSeconds: 420,
  },
  "assets-1": {
    id: "assets-1",
    label: "Внешний k6 · ассеты редактора · 1 VU",
    suite: "assets",
    virtualUsers: 1,
    rampUpSeconds: 0,
    holdSeconds: 0,
    rampDownSeconds: 0,
    monitorSeconds: 180,
  },
  "assets-5": {
    id: "assets-5",
    label: "Внешний k6 · ассеты редактора · 5 VU",
    suite: "assets",
    virtualUsers: 5,
    rampUpSeconds: 0,
    holdSeconds: 0,
    rampDownSeconds: 0,
    monitorSeconds: 240,
  },
  "assets-10": {
    id: "assets-10",
    label: "Внешний k6 · ассеты редактора · 10 VU",
    suite: "assets",
    virtualUsers: 10,
    rampUpSeconds: 0,
    holdSeconds: 0,
    rampDownSeconds: 0,
    monitorSeconds: 300,
  },
  "assets-50": {
    id: "assets-50",
    label: "Внешний k6 · ассеты редактора · 50 VU",
    suite: "assets",
    virtualUsers: 50,
    rampUpSeconds: 0,
    holdSeconds: 0,
    rampDownSeconds: 0,
    monitorSeconds: 420,
  },
  "assets-100": {
    id: "assets-100",
    label: "Внешний k6 · ассеты редактора · 100 VU",
    suite: "assets",
    virtualUsers: 100,
    rampUpSeconds: 0,
    holdSeconds: 0,
    rampDownSeconds: 0,
    monitorSeconds: 540,
  },
} as const;

const toSafeJson = (value: unknown): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(toSafeJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        toSafeJson(entry),
      ]),
    );
  }
  return value;
};

const isSingleStatement = (query: string) => {
  const trimmed = query.trim();
  const firstSemicolon = trimmed.indexOf(";");
  if (firstSemicolon === -1) {
    return true;
  }
  if (firstSemicolon !== trimmed.length - 1) {
    return false;
  }
  return trimmed.slice(0, -1).indexOf(";") === -1;
};

const getGiftSlotType = (slotName: string) => {
  const normalized = slotName.trim().toLowerCase();
  if (normalized.startsWith("gift_slot_")) {
    return "default";
  }
  const parts = normalized
    .replace(/^gift_/, "")
    .split("_")
    .filter(Boolean);
  if (parts.length <= 1) {
    return parts[0] || "default";
  }
  return /^\d+$/.test(parts[parts.length - 1] ?? "")
    ? parts.slice(0, -1).join("_")
    : parts.join("_");
};

const isGiftCompatibleWithSlot = (
  gift: { code?: string | null; modelUrl?: string | null },
  slotName: string,
) => {
  const slotType = getGiftSlotType(slotName);
  if (slotType === "default" || slotType === "slot") {
    return true;
  }
  const modelCode =
    gift.code ??
    gift.modelUrl
      ?.split("/")
      .pop()
      ?.replace(/\.glb$/i, "") ??
    "";
  const giftType = modelCode.toLowerCase().split("_")[0] ?? "";
  return giftType === slotType;
};

@Controller("admin")
export class AdminController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(GiftsService) private readonly giftsService: GiftsService,
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(S3Service) private readonly s3: S3Service,
    @Inject(MailService) private readonly mailService: MailService,
    @Inject(AdminPerformanceService)
    private readonly performanceService: AdminPerformanceService,
  ) {}

  private async ensureAdmin(req: Request) {
    const token = req.cookies?.access_token;
    const user = await this.authService.getUserFromToken(token);
    if (!user) {
      throw new ForbiddenException("Доступ запрещён");
    }
    if (!canAccessAdmin(user)) {
      throw new ForbiddenException("Доступ запрещён");
    }
    return user;
  }

  private async ensureOwner(req: Request) {
    const user = await this.ensureAdmin(req);
    if (!canManageAdmins(user)) {
      throw new ForbiddenException("Только владелец может управлять доступами");
    }
    return user;
  }

  private async ensureLoadingTipsSeeded() {
    const count = await this.prisma.loadingTip.count();
    if (count > 0) {
      return;
    }
    await this.prisma.loadingTip.createMany({
      data: DEFAULT_LOADING_TIPS.map((text: string) => ({ text })),
    });
  }

  private getFrontendUrl() {
    return (process.env.FRONTEND_URL ?? "https://xn--80aeb9a9a9d.com").replace(
      /\/+$/,
      "",
    );
  }

  private async uploadNewsPhotos(
    files: Array<{
      originalname: string;
      mimetype?: string;
      buffer: Buffer;
    }> = [],
  ) {
    if (!files.length) {
      return [];
    }

    return Promise.all(
      files.map((file) => {
        const ext = extname(file.originalname).toLowerCase() || ".jpg";
        const safeExt = ext.length <= 8 ? ext : ".jpg";
        const contentType =
          file.mimetype && file.mimetype.startsWith("image/")
            ? file.mimetype
            : safeExt === ".png"
              ? "image/png"
              : safeExt === ".webp"
                ? "image/webp"
                : "image/jpeg";
        if (!contentType.startsWith("image/")) {
          throw new BadRequestException("Можно загружать только изображения");
        }
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
        return this.s3.uploadPublic(
          `news/posts/${fileName}`,
          file.buffer,
          contentType,
        );
      }),
    );
  }

  private assertVideoFile(file: {
    originalname: string;
    mimetype?: string;
  }) {
    const lowerName = file.originalname.toLowerCase();
    const isWebm = file.mimetype === "video/webm" || lowerName.endsWith(".webm");
    const isMp4 = file.mimetype === "video/mp4" || lowerName.endsWith(".mp4");
    if (!isWebm && !isMp4) {
      throw new BadRequestException("Можно загрузить только WebM или MP4");
    }
    return isMp4 ? "video/mp4" : "video/webm";
  }

  @Post("sql")
  async runSql(@Req() req: Request, @Body() dto: AdminSqlDto) {
    const user = await this.ensureAdmin(req);
    const accessLevel = getAccessLevel(user);
    const rawQuery = dto.query ?? "";
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      throw new BadRequestException("Пустой запрос");
    }
    if (!isSingleStatement(trimmed)) {
      throw new BadRequestException("Разрешён только один SQL-оператор");
    }
    const normalized = trimmed.replace(/\s+/g, " ").trim();
    const lower = normalized.toLowerCase();
    const isSelect = /^select\b/.test(lower);
    const isDelete = /^delete\b/.test(lower);
    const isUpdate = /^update\b/.test(lower);
    if (!isSelect && !isDelete && !isUpdate) {
      throw new BadRequestException("Разрешены только SELECT, DELETE и UPDATE");
    }
    if (/\b(insert|drop|alter|create|truncate|grant|revoke)\b/.test(lower)) {
      throw new BadRequestException("Запрос содержит запрещённые операции");
    }
    if (
      accessLevel !== "OWNER" &&
      /^(update|delete)\s+"?user"?\b/i.test(trimmed)
    ) {
      throw new ForbiddenException(
        "Только владелец может изменять пользователей через SQL",
      );
    }

    if (isSelect) {
      const rows = await this.prisma.$queryRawUnsafe(trimmed);
      const safeRows = toSafeJson(rows);
      return {
        type: "select",
        rowCount: Array.isArray(rows) ? rows.length : 0,
        rows: safeRows,
      };
    }

    const hasReturning = /\breturning\b/.test(lower);
    if (hasReturning) {
      const rows = await this.prisma.$queryRawUnsafe(trimmed);
      const safeRows = toSafeJson(rows);
      return {
        type: isUpdate ? "update" : "delete",
        rowCount: Array.isArray(rows) ? rows.length : 0,
        rows: safeRows,
      };
    }

    const affected = await this.prisma.$executeRawUnsafe(trimmed);
    return {
      type: isUpdate ? "update" : "delete",
      affected: typeof affected === "bigint" ? affected.toString() : affected,
    };
  }

  @Get("schema")
  async getSchema(@Req() req: Request) {
    await this.ensureAdmin(req);
    const rawTables = (await this.prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    )) as Array<{ table_name: string }>;
    const rawColumns = (await this.prisma.$queryRawUnsafe(
      "SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position",
    )) as Array<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>;

    const tableMap = new Map<
      string,
      {
        name: string;
        columns: { name: string; type: string; nullable: boolean }[];
      }
    >();
    rawTables.forEach((table) => {
      tableMap.set(table.table_name, { name: table.table_name, columns: [] });
    });
    rawColumns.forEach((column) => {
      const entry = tableMap.get(column.table_name) ?? {
        name: column.table_name,
        columns: [],
      };
      entry.columns.push({
        name: column.column_name,
        type: column.data_type,
        nullable: column.is_nullable === "YES",
      });
      tableMap.set(column.table_name, entry);
    });

    const tables = Array.from(tableMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return { tables };
  }

  @Get("load-probe")
  async loadProbe(@Req() req: Request) {
    const startedAt = Date.now();
    await this.ensureAdmin(req);
    const dbStartedAt = Date.now();
    await this.prisma.$queryRawUnsafe("SELECT 1 AS ok");
    const dbMs = Date.now() - dbStartedAt;
    const serverMs = Date.now() - startedAt;
    return {
      ok: true,
      dbMs,
      serverMs,
      at: new Date().toISOString(),
    };
  }

  @Get("performance-snapshot")
  async performanceSnapshot(@Req() req: Request) {
    await this.ensureAdmin(req);
    return this.performanceService.snapshot();
  }

  @Post("performance/k6")
  async runExternalK6(
    @Req() req: Request,
    @Body() body?: { profile?: string },
  ) {
    await this.ensureOwner(req);
    const profileId = body?.profile ?? "mixed-500";
    if (!(profileId in EXTERNAL_K6_PROFILES)) {
      throw new BadRequestException("Неизвестный профиль k6");
    }
    const profile =
      EXTERNAL_K6_PROFILES[
        profileId as keyof typeof EXTERNAL_K6_PROFILES
      ];
    const token = process.env.GITHUB_WORKFLOW_TOKEN?.trim();
    if (!token) {
      throw new BadRequestException(
        "Добавьте GITHUB_WORKFLOW_TOKEN в переменные окружения API",
      );
    }

    const response = await fetch(
      "https://api.github.com/repos/andreyvbvbvb/memorial_pitomcev/actions/workflows/k6-production.yml/dispatches",
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2026-03-10",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            suite: profile.suite,
            vus: String(profile.virtualUsers),
            duration: `${profile.holdSeconds}s`,
            ramp_up: `${profile.rampUpSeconds}s`,
            ramp_down: `${profile.rampDownSeconds}s`,
            p95_ms: profile.suite === "assets" ? "30000" : "5000",
          },
        }),
      },
    );

    const responseText = await response.text();
    if (!response.ok) {
      throw new BadRequestException(
        response.status === 401 || response.status === 403
          ? "GitHub отклонил токен. Нужен fine-grained token с Actions: write"
          : `Не удалось запустить k6 через GitHub (${response.status})`,
      );
    }

    let runUrl = K6_WORKFLOW_URL;
    if (responseText) {
      try {
        const data = JSON.parse(responseText) as { html_url?: string };
        runUrl = data.html_url || runUrl;
      } catch {
        // Older GitHub API versions return an empty successful response.
      }
    }

    return {
      ok: true,
      runUrl,
      profile: {
        ...profile,
        p95ThresholdMs: profile.suite === "assets" ? 30000 : 5000,
      },
    };
  }

  @Get("moderation")
  async listModerationQueue(
    @Req() req: Request,
    @Query("status") status?: string,
  ) {
    await this.ensureAdmin(req);
    const normalizedStatus = String(status ?? "PENDING").toUpperCase();
    const where =
      normalizedStatus === "ALL"
        ? {}
        : {
            moderationStatus: MODERATION_STATUSES.includes(
              normalizedStatus as (typeof MODERATION_STATUSES)[number],
            )
              ? normalizedStatus
              : "PENDING",
          };
    const pets = await this.prisma.pet.findMany({
      where: {
        ...where,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 120,
      include: {
        owner: { select: { id: true, email: true, login: true } },
        marker: true,
        memorial: true,
        photos: { orderBy: { sortOrder: "asc" } },
      },
    });
    return { pets };
  }

  @Get("gift-placements")
  async listGiftPlacements(@Req() req: Request, @Query("q") query?: string) {
    await this.ensureAdmin(req);
    const normalizedQuery = String(query ?? "").trim();
    const now = new Date();
    const pets = await this.prisma.pet.findMany({
      where: {
        isActive: true,
        memorial: { isNot: null },
        ...(normalizedQuery
          ? {
              OR: [
                {
                  name: {
                    contains: normalizedQuery,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  owner: {
                    email: {
                      contains: normalizedQuery,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                },
                {
                  owner: {
                    login: {
                      contains: normalizedQuery,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 240,
      include: {
        owner: { select: { id: true, email: true, login: true } },
        memorial: true,
        gifts: {
          where: {
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: { placedAt: "desc" },
          include: {
            gift: true,
            owner: { select: { id: true, email: true, login: true } },
          },
        },
      },
    });
    return { pets };
  }

  @Patch("gift-placements/deactivate-all")
  async deactivateAllGiftPlacements(
    @Req() req: Request,
    @Body() dto: AdminDeactivateAllGiftsDto,
  ) {
    await this.ensureAdmin(req);
    const pet = await this.prisma.pet.findUnique({
      where: { id: dto.petId },
      select: { id: true, memorial: { select: { id: true } } },
    });
    if (!pet?.memorial) {
      throw new BadRequestException("Мемориал не найден");
    }
    const now = new Date();
    const [result] = await this.prisma.$transaction([
      this.prisma.giftPlacement.updateMany({
        where: { petId: pet.id, isActive: true },
        data: {
          isActive: false,
          deactivatedAt: now,
          deactivationReason: "admin_cleanup",
        },
      }),
      this.prisma.memorial.update({
        where: { id: pet.memorial.id },
        data: { needsPreviewRefresh: true },
      }),
    ]);
    return { deactivated: result.count };
  }

  @Patch("gift-placements/:id/deactivate")
  async deactivateGiftPlacement(@Req() req: Request, @Param("id") id: string) {
    await this.ensureAdmin(req);
    const placement = await this.prisma.giftPlacement.findUnique({
      where: { id },
      select: {
        id: true,
        petId: true,
        isActive: true,
        pet: { select: { memorial: { select: { id: true } } } },
      },
    });
    if (!placement?.isActive || !placement.pet.memorial) {
      throw new BadRequestException("Активный подарок не найден");
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.giftPlacement.update({
        where: { id },
        data: {
          isActive: false,
          deactivatedAt: now,
          deactivationReason: "admin_cleanup",
        },
      }),
      this.prisma.memorial.update({
        where: { id: placement.pet.memorial.id },
        data: { needsPreviewRefresh: true },
      }),
    ]);
    return { deactivated: 1 };
  }

  @Patch("gift-placements/:id/move")
  async moveGiftPlacement(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: AdminMoveGiftPlacementDto,
  ) {
    await this.ensureAdmin(req);
    const targetSlot = dto.slotName.trim().toLowerCase();
    const placement = await this.prisma.giftPlacement.findUnique({
      where: { id },
      include: {
        gift: true,
        pet: { select: { memorial: { select: { id: true } } } },
      },
    });
    if (!placement?.isActive || !placement.pet.memorial) {
      throw new BadRequestException("Активный подарок не найден");
    }
    if (placement.slotName === targetSlot) {
      throw new BadRequestException("Подарок уже находится в этом слоте");
    }
    if (!isGiftCompatibleWithSlot(placement.gift, targetSlot)) {
      throw new BadRequestException("Подарок не подходит для выбранного слота");
    }
    const now = new Date();
    const occupied = await this.prisma.giftPlacement.findFirst({
      where: {
        id: { not: placement.id },
        petId: placement.petId,
        slotName: targetSlot,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (occupied) {
      throw new BadRequestException("Выбранный слот уже занят");
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.giftPlacement.update({
        where: { id },
        data: { slotName: targetSlot },
        include: {
          gift: true,
          owner: { select: { id: true, email: true, login: true } },
        },
      }),
      this.prisma.memorial.update({
        where: { id: placement.pet.memorial.id },
        data: { needsPreviewRefresh: true },
      }),
    ]);
    return { placement: updated };
  }

  @Patch("moderation/:id")
  async updateModerationStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: AdminModerationDto,
  ) {
    const moderator = await this.ensureAdmin(req);
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true, login: true } },
        memorial: true,
      },
    });
    if (!pet) {
      throw new BadRequestException("Мемориал не найден");
    }
    const now = new Date();
    const comment = dto.comment?.trim() ?? "";
    if (dto.status === "NEEDS_CHANGES" && !comment) {
      throw new BadRequestException("Укажите, что нужно поправить");
    }

    const updated = await this.prisma.pet.update({
      where: { id },
      data: {
        moderationStatus: dto.status,
        moderationComment: dto.status === "NEEDS_CHANGES" ? comment : null,
        ...(dto.status === "NEEDS_CHANGES"
          ? {
              moderationReviewType: MODERATION_REVIEW_REVISION,
              moderationChangedBlocks: { set: [] },
            }
          : dto.status === "APPROVED"
            ? { moderationChangedBlocks: { set: [] } }
            : {}),
        moderatedAt: now,
        moderatorId: moderator.id,
      },
      include: {
        owner: { select: { id: true, email: true, login: true } },
        marker: true,
        memorial: true,
        photos: { orderBy: { sortOrder: "asc" } },
      },
    });

    let mailSent = false;
    let mailError: string | null = null;
    try {
      const frontendUrl = this.getFrontendUrl();
      if (dto.status === "APPROVED") {
        await this.mailService.sendMemorialApproved(
          pet.owner.email,
          pet.name,
          `${frontendUrl}/pets/${pet.id}`,
          pet.isPublic,
        );
        mailSent = true;
      } else if (dto.status === "NEEDS_CHANGES") {
        await this.mailService.sendMemorialNeedsChanges(
          pet.owner.email,
          pet.name,
          `${frontendUrl}/create?edit=${pet.id}`,
          comment,
        );
        mailSent = true;
      }
    } catch (error) {
      mailError =
        error instanceof Error ? error.message : "Не удалось отправить письмо";
      console.warn("Memorial moderation email failed", error);
    }

    return { pet: updated, mailSent, mailError };
  }

  @Get("access/users")
  async listAccessUsers(@Req() req: Request) {
    await this.ensureAdmin(req);
    const users = await this.prisma.user.findMany({
      orderBy: [{ role: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        login: true,
        role: true,
        maxMemorials: true,
        createdAt: true,
        _count: { select: { pets: true } },
      },
    });
    return {
      users: users.map(
        (user: {
          id: string;
          email: string;
          login: string | null;
          role: string;
          maxMemorials: number | null;
          createdAt: Date;
          _count: { pets: number };
        }) => ({
          ...user,
          accessLevel: getAccessLevel(user),
          isOwner: isOwnerUser(user),
          maxMemorials: isOwnerUser(user) ? 10000 : (user.maxMemorials ?? 5),
          memorialCount: user._count.pets,
          _count: undefined,
        }),
      ),
    };
  }

  @Patch("access/role")
  async updateUserRole(
    @Req() req: Request,
    @Body() dto: AdminUpdateUserRoleDto,
  ) {
    await this.ensureOwner(req);
    const email = dto.email.trim().toLowerCase();
    const role = dto.role;
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, login: true, role: true },
    });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }
    if (isOwnerUser(user)) {
      throw new BadRequestException(
        "Нельзя изменять уровень доступа владельца",
      );
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { role },
      select: {
        id: true,
        email: true,
        login: true,
        role: true,
        maxMemorials: true,
        createdAt: true,
        _count: { select: { pets: true } },
      },
    });
    return {
      user: {
        ...updated,
        accessLevel: getAccessLevel(updated),
        isOwner: false,
        maxMemorials: updated.maxMemorials ?? 5,
        memorialCount: updated._count.pets,
        _count: undefined,
      },
    };
  }

  @Patch("access/memorial-limit")
  async updateMemorialLimit(
    @Req() req: Request,
    @Body() dto: AdminUpdateMemorialLimitDto,
  ) {
    await this.ensureAdmin(req);
    const emails = Array.from(
      new Set(
        dto.emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
      ),
    );
    if (emails.length === 0) {
      throw new BadRequestException("Укажите хотя бы один email");
    }
    const users = (await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, login: true },
    })) as Array<{ id: string; email: string; login: string | null }>;
    const editableUsers = users.filter(
      (user: { id: string; email: string; login: string | null }) =>
        !isOwnerUser(user),
    );
    if (editableUsers.length > 0) {
      await this.prisma.user.updateMany({
        where: {
          id: {
            in: editableUsers.map(
              (user: { id: string; email: string; login: string | null }) =>
                user.id,
            ),
          },
        },
        data: { maxMemorials: dto.maxMemorials },
      });
    }
    const updatedUsers = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      orderBy: [{ role: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        login: true,
        role: true,
        maxMemorials: true,
        createdAt: true,
        _count: { select: { pets: true } },
      },
    });
    return {
      users: updatedUsers.map(
        (user: {
          id: string;
          email: string;
          login: string | null;
          role: string;
          maxMemorials: number | null;
          createdAt: Date;
          _count: { pets: number };
        }) => ({
          ...user,
          accessLevel: getAccessLevel(user),
          isOwner: isOwnerUser(user),
          maxMemorials: isOwnerUser(user) ? 10000 : (user.maxMemorials ?? 5),
          memorialCount: user._count.pets,
          _count: undefined,
        }),
      ),
      skippedOwners: users
        .filter((user: { id: string; email: string; login: string | null }) =>
          isOwnerUser(user),
        )
        .map(
          (user: { id: string; email: string; login: string | null }) =>
            user.email,
        ),
      missingEmails: emails.filter(
        (email: string) =>
          !users.some(
            (user: { id: string; email: string; login: string | null }) =>
              user.email === email,
          ),
      ),
    };
  }

  @Patch("wallet/add-coins")
  async addCoins(@Req() req: Request, @Body() dto: AdminAddCoinsDto) {
    await this.ensureAdmin(req);
    const email = dto.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException("Email обязателен");
    }
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, login: true, coinBalance: true },
    });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }
    const updated = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { coinBalance: { increment: dto.amount } },
          select: { id: true, email: true, login: true, coinBalance: true },
        });
        await tx.walletTransaction.create({
          data: {
            userId: user.id,
            amount: dto.amount,
            balanceAfter: updatedUser.coinBalance,
            type: "admin_add_coins",
            title: "Админское начисление",
            details: `Начислено администратором: ${dto.amount} монет`,
          },
        });
        return updatedUser;
      },
    );
    return { user: updated, amount: dto.amount };
  }

  @Post("users/bulk-create")
  async bulkCreateUsers(
    @Req() req: Request,
    @Body() dto: AdminBulkCreateUsersDto,
  ) {
    await this.ensureAdmin(req);
    const rows = Array.isArray(dto.rows) ? dto.rows : [];
    if (rows.length === 0) {
      throw new BadRequestException("CSV не содержит строк пользователей");
    }
    if (rows.length > 200) {
      throw new BadRequestException(
        "За один раз можно создать не больше 200 аккаунтов",
      );
    }

    const normalizedRows = rows.map((row, index) => {
      const login = String(row.login ?? "").trim();
      const email = String(row.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(row.password ?? "").trim();
      const initialBalance = Number(row.initialBalance ?? 0);
      if (!/^[A-Za-z0-9_]{3,30}$/.test(login)) {
        throw new BadRequestException(
          `Строка ${index + 1}: некорректный логин`,
        );
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException(
          `Строка ${index + 1}: некорректный email`,
        );
      }
      if (password.length < 6 || password.length > 200) {
        throw new BadRequestException(
          `Строка ${index + 1}: пароль должен быть от 6 до 200 символов`,
        );
      }
      if (
        !Number.isInteger(initialBalance) ||
        initialBalance < 0 ||
        initialBalance > 1_000_000
      ) {
        throw new BadRequestException(
          `Строка ${index + 1}: баланс должен быть целым числом от 0 до 1000000`,
        );
      }
      return { login, email, password, initialBalance };
    });

    const duplicateEmails = normalizedRows
      .map((row) => row.email)
      .filter((email, index, emails) => emails.indexOf(email) !== index);
    const duplicateLogins = normalizedRows
      .map((row) => row.login.toLowerCase())
      .filter((login, index, logins) => logins.indexOf(login) !== index);
    if (duplicateEmails.length > 0 || duplicateLogins.length > 0) {
      throw new BadRequestException(
        "CSV содержит повторяющиеся email или логины",
      );
    }

    const existing = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { in: normalizedRows.map((row) => row.email) } },
          { login: { in: normalizedRows.map((row) => row.login) } },
        ],
      },
      select: { email: true, login: true },
    });
    if (existing.length > 0) {
      throw new BadRequestException(
        `Уже существуют: ${existing
          .map(
            (user: { email: string; login: string | null }) =>
              user.email || user.login,
          )
          .filter(Boolean)
          .join(", ")}`,
      );
    }

    const now = new Date();
    const created = [];
    for (const row of normalizedRows) {
      const passwordHash = await bcrypt.hash(row.password, 10);
      const user = await this.prisma.user.create({
        data: {
          email: row.email,
          login: row.login,
          passwordHash,
          coinBalance: row.initialBalance,
          termsAccepted: true,
          offerAccepted: true,
          termsAcceptedAt: now,
          offerAcceptedAt: now,
          walletTransactions:
            row.initialBalance > 0
              ? {
                  create: {
                    amount: row.initialBalance,
                    balanceAfter: row.initialBalance,
                    type: "admin_initial_balance",
                    title: "Начальный баланс",
                    details: "Создано через CSV-импорт",
                    createdAt: now,
                  },
                }
              : undefined,
        },
        select: { id: true, email: true, login: true, coinBalance: true },
      });
      created.push(user);
    }
    return { createdCount: created.length, users: created };
  }

  @Get("pricing")
  async getPricing(@Req() req: Request) {
    await this.ensureAdmin(req);
    const [memorialPlanPrices, gifts, memorialPublicationMode] =
      await Promise.all([
        this.pricingService.listMemorialPlanPrices(),
        this.giftsService.listCatalog(),
        this.pricingService.getMemorialPublicationMode(),
      ]);
    return { memorialPlanPrices, gifts, memorialPublicationMode };
  }

  @Patch("pricing/memorial-plan")
  async updateMemorialPlanPrice(
    @Req() req: Request,
    @Body() dto: AdminUpdateMemorialPlanPriceDto,
  ) {
    await this.ensureAdmin(req);
    const plan = await this.pricingService.updateMemorialPlanPrice(
      dto.years,
      dto.price,
    );
    return { plan };
  }

  @Patch("pricing/memorial-publication-mode")
  async updateMemorialPublicationMode(
    @Req() req: Request,
    @Body() dto: AdminUpdateMemorialPublicationModeDto,
  ) {
    await this.ensureAdmin(req);
    const memorialPublicationMode =
      await this.pricingService.updateMemorialPublicationMode(
        dto.freeLifetime,
      );
    return { memorialPublicationMode };
  }

  @Patch("pricing/gifts/:id")
  async updateGiftPrice(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: AdminUpdateGiftPriceDto,
  ) {
    await this.ensureAdmin(req);
    const name = dto.name?.trim();
    const description = dto.description?.trim();
    const gift = await this.prisma.giftCatalog.update({
      where: { id },
      data: {
        price: dto.price,
        ...(name ? { name } : {}),
        ...(typeof description === "string" ? { description } : {}),
      },
    });
    return { gift };
  }

  @Get("model-metadata")
  async getModelMetadata(@Req() req: Request) {
    await this.ensureAdmin(req);
    const items = await this.prisma.modelMetadata.findMany({
      orderBy: [{ category: "asc" }, { modelId: "asc" }],
    });
    return { items };
  }

  @Patch("model-metadata/:category/:modelId")
  async updateModelMetadata(
    @Req() req: Request,
    @Param("category") category: string,
    @Param("modelId") modelId: string,
    @Body() dto: AdminModelMetadataDto,
  ) {
    await this.ensureAdmin(req);
    const safeCategory = category.trim();
    const safeModelId = modelId.trim();
    const name = dto.name.trim();
    const description = dto.description.trim();
    if (!safeCategory || !safeModelId) {
      throw new BadRequestException("Не указана модель");
    }
    if (!name) {
      throw new BadRequestException("Название обязательно");
    }
    const item = await this.prisma.modelMetadata.upsert({
      where: {
        category_modelId: {
          category: safeCategory,
          modelId: safeModelId,
        },
      },
      create: {
        category: safeCategory,
        modelId: safeModelId,
        name,
        description,
      },
      update: {
        name,
        description,
      },
    });
    return { item };
  }

  @Post("reset-password")
  async resetPassword(@Req() req: Request, @Body() dto: AdminResetPasswordDto) {
    const currentUser = await this.ensureAdmin(req);
    const email = dto.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException("Email обязателен");
    }
    const nextPassword = dto.newPassword.trim();
    if (nextPassword.length < 6) {
      throw new BadRequestException("Пароль должен быть минимум 6 символов");
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }
    if (isOwnerUser(user) && !canManageAdmins(currentUser)) {
      throw new ForbiddenException(
        "Только владелец может изменять пароль владельца",
      );
    }
    const passwordHash = await bcrypt.hash(nextPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    return { ok: true };
  }

  @Get("loading-tips")
  async listLoadingTips(@Req() req: Request) {
    await this.ensureAdmin(req);
    await this.ensureLoadingTipsSeeded();
    const tips = await this.prisma.loadingTip.findMany({
      orderBy: { createdAt: "asc" },
    });
    return {
      tips: tips.map(
        (tip: {
          id: string;
          text: string;
          isActive: boolean;
          createdAt: Date;
        }) => ({
          id: tip.id,
          text: tip.text,
          isActive: tip.isActive,
          createdAt: tip.createdAt,
        }),
      ),
    };
  }

  @Post("loading-tips")
  async createLoadingTip(
    @Req() req: Request,
    @Body() dto: AdminLoadingTipCreateDto,
  ) {
    await this.ensureAdmin(req);
    const text = (dto.text ?? "").trim();
    if (!text) {
      throw new BadRequestException("Текст подсказки обязателен");
    }
    const tip = await this.prisma.loadingTip.create({
      data: {
        text,
        isActive: dto.isActive ?? true,
      },
    });
    return { id: tip.id };
  }

  @Patch("loading-tips/:id")
  async updateLoadingTip(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: AdminLoadingTipUpdateDto,
  ) {
    await this.ensureAdmin(req);
    const data: { text?: string; isActive?: boolean } = {};
    if (dto.text !== undefined) {
      const text = dto.text.trim();
      if (!text) {
        throw new BadRequestException("Текст подсказки обязателен");
      }
      data.text = text;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }
    await this.prisma.loadingTip.update({
      where: { id },
      data,
    });
    return { ok: true };
  }

  @Delete("loading-tips/:id")
  async deleteLoadingTip(@Req() req: Request, @Param("id") id: string) {
    await this.ensureAdmin(req);
    await this.prisma.loadingTip.delete({ where: { id } });
    return { ok: true };
  }

  @Get("site-banner")
  async getSiteBanner(@Req() req: Request) {
    await this.ensureAdmin(req);
    const banner = await this.prisma.siteBanner.upsert({
      where: { id: "global" },
      create: { id: "global", text: "", isActive: false },
      update: {},
    });
    return { banner };
  }

  @Patch("site-banner")
  async updateSiteBanner(
    @Req() req: Request,
    @Body() dto: AdminSiteBannerDto,
  ) {
    await this.ensureAdmin(req);
    const text = dto.text?.trim() ?? "";
    if (dto.isActive && !text) {
      throw new BadRequestException("Введите текст плашки");
    }
    const banner = await this.prisma.siteBanner.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        text,
        isActive: dto.isActive ?? false,
      },
      update: {
        text,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return { banner };
  }

  @Get("hero-video")
  async getHeroVideo(@Req() req: Request) {
    await this.ensureAdmin(req);
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: HERO_VIDEO_SETTING_KEY },
    });
    return { heroVideo: normalizeHeroVideoSetting(setting?.value) };
  }

  @Post("hero-video")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "file", maxCount: 1 },
        { name: "poster", maxCount: 1 },
      ],
      {
        limits: { fileSize: 80 * 1024 * 1024 },
      },
    ),
  )
  async uploadHeroVideo(
    @Req() req: Request,
    @UploadedFiles()
    files?: {
      file?: Array<{
        originalname: string;
        mimetype?: string;
        buffer: Buffer;
        size?: number;
      }>;
      poster?: Array<{
        originalname: string;
        mimetype?: string;
        buffer: Buffer;
        size?: number;
      }>;
    },
  ) {
    await this.ensureAdmin(req);
    const file = files?.file?.[0];
    const poster = files?.poster?.[0];
    if (!file) {
      throw new BadRequestException("Файл не найден");
    }
    const contentType = this.assertVideoFile(file);
    const ext = contentType === "video/mp4" ? ".mp4" : ".webm";
    let posterType: "image/jpeg" | "image/png" | null = null;
    if (poster) {
      if (
        poster.mimetype &&
        poster.mimetype !== "image/jpeg" &&
        poster.mimetype !== "image/png"
      ) {
        throw new BadRequestException("Постер должен быть JPEG или PNG");
      }
      posterType = poster.mimetype === "image/png" ? "image/png" : "image/jpeg";
    }
    const safeName = file.originalname.replace(/[^\wа-яА-ЯёЁ.\-]+/g, "_");
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const url = await this.s3.uploadPublic(
      `site/hero-video/${fileName}`,
      file.buffer,
      contentType,
    );
    let posterUrl: string | null = null;
    if (poster && posterType) {
      const posterExt = posterType === "image/png" ? ".png" : ".jpg";
      posterUrl = await this.s3.uploadPublic(
        `site/hero-video/${fileName.replace(ext, `-poster${posterExt}`)}`,
        poster.buffer,
        posterType,
      );
    }
    const value = {
      url,
      posterUrl,
      fileName: safeName || fileName,
      contentType,
      sizeBytes: file.size ?? file.buffer.length,
      updatedAt: new Date().toISOString(),
    };
    const setting = await this.prisma.appSetting.upsert({
      where: { key: HERO_VIDEO_SETTING_KEY },
      create: { key: HERO_VIDEO_SETTING_KEY, value },
      update: { value },
    });
    return { heroVideo: normalizeHeroVideoSetting(setting.value) };
  }

  @Get("news")
  async listNews(@Req() req: Request) {
    await this.ensureAdmin(req);
    const posts = await this.prisma.newsPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { posts };
  }

  @Post("news")
  @UseInterceptors(
    FilesInterceptor("photos", 8, {
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  async createNews(
    @Req() req: Request,
    @Body()
    dto: {
      title?: string;
      body?: string;
      isActive?: boolean | string;
    },
    @UploadedFiles()
    files: Array<{
      originalname: string;
      mimetype?: string;
      buffer: Buffer;
    }> = [],
  ) {
    await this.ensureAdmin(req);
    const title = dto.title?.trim();
    const body = dto.body?.trim();
    if (!title) {
      throw new BadRequestException("Заголовок обязателен");
    }
    if (!body) {
      throw new BadRequestException("Текст новости обязателен");
    }
    const photos = await this.uploadNewsPhotos(files);
    const post = await this.prisma.newsPost.create({
      data: {
        title,
        body,
        photos,
        isActive:
          dto.isActive === undefined ||
          dto.isActive === true ||
          dto.isActive === "true" ||
          dto.isActive === "1" ||
          dto.isActive === "on",
      },
    });
    return { post };
  }

  @Patch("news/:id")
  async updateNews(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: AdminNewsDto,
  ) {
    await this.ensureAdmin(req);
    const post = await this.prisma.newsPost.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        isActive: dto.isActive ?? true,
      },
    });
    return { post };
  }

  @Delete("news/:id")
  async deleteNews(@Req() req: Request, @Param("id") id: string) {
    await this.ensureAdmin(req);
    await this.prisma.newsPost.delete({ where: { id } });
    return { ok: true };
  }

  @Get("documents")
  async listDocumentRevisions(@Req() req: Request) {
    await this.ensureAdmin(req);
    const revisions = await this.prisma.documentRevision.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
    });
    return { revisions };
  }

  @Post("documents")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadDocumentRevision(
    @Req() req: Request,
    @Body() dto: AdminDocumentUploadDto,
    @UploadedFile()
    file?: { originalname: string; mimetype?: string; buffer: Buffer },
  ) {
    const user = await this.ensureAdmin(req);
    if (!file) {
      throw new BadRequestException("Файл не найден");
    }
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      throw new BadRequestException("Можно загрузить только PDF");
    }
    const safeName = file.originalname.replace(/[^\wа-яА-ЯёЁ.\-]+/g, "_");
    const key = `documents/${dto.documentType}/${Date.now()}-${safeName}`;
    const fileUrl = await this.s3.uploadPublic(
      key,
      file.buffer,
      "application/pdf",
    );
    const revision = await this.prisma.documentRevision.create({
      data: {
        documentType: dto.documentType,
        title: dto.title.trim(),
        fileUrl,
        fileName: safeName,
        uploadedById: user.id,
      },
    });
    return { revision };
  }
}
