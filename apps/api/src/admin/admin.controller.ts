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
  Req
} from "@nestjs/common";
import { Request } from "express";
import * as bcrypt from "bcryptjs";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";
import {
  AdminLoadingTipCreateDto,
  AdminLoadingTipUpdateDto
} from "./dto/admin-loading-tip.dto";
import { AdminSqlDto } from "./dto/admin-sql.dto";
import { DEFAULT_LOADING_TIPS } from "../content/loading-tips.constants";

const ADMIN_EMAILS = new Set(["andreyvbvbvb@gmail.com"]);

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
        toSafeJson(entry)
      ])
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

@Controller("admin")
export class AdminController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  private async ensureAdmin(req: Request) {
    const token = req.cookies?.access_token;
    const user = await this.authService.getUserFromToken(token);
    if (!user || !user.email) {
      throw new ForbiddenException("Доступ запрещён");
    }
    const email = user.email.toLowerCase();
    if (!ADMIN_EMAILS.has(email)) {
      throw new ForbiddenException("Доступ запрещён");
    }
    return user;
  }

  private async ensureLoadingTipsSeeded() {
    const count = await this.prisma.loadingTip.count();
    if (count > 0) {
      return;
    }
    await this.prisma.loadingTip.createMany({
      data: DEFAULT_LOADING_TIPS.map((text: string) => ({ text }))
    });
  }

  @Post("sql")
  async runSql(@Req() req: Request, @Body() dto: AdminSqlDto) {
    await this.ensureAdmin(req);
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

    if (isSelect) {
      const rows = await this.prisma.$queryRawUnsafe(trimmed);
      const safeRows = toSafeJson(rows);
      return {
        type: "select",
        rowCount: Array.isArray(rows) ? rows.length : 0,
        rows: safeRows
      };
    }

    const hasReturning = /\breturning\b/.test(lower);
    if (hasReturning) {
      const rows = await this.prisma.$queryRawUnsafe(trimmed);
      const safeRows = toSafeJson(rows);
      return {
        type: isUpdate ? "update" : "delete",
        rowCount: Array.isArray(rows) ? rows.length : 0,
        rows: safeRows
      };
    }

    const affected = await this.prisma.$executeRawUnsafe(trimmed);
    return {
      type: isUpdate ? "update" : "delete",
      affected: typeof affected === "bigint" ? affected.toString() : affected
    };
  }

  @Get("schema")
  async getSchema(@Req() req: Request) {
    await this.ensureAdmin(req);
    const rawTables = (await this.prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
    )) as Array<{ table_name: string }>;
    const rawColumns = (await this.prisma.$queryRawUnsafe(
      "SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position"
    )) as Array<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>;

    const tableMap = new Map<string, { name: string; columns: { name: string; type: string; nullable: boolean }[] }>();
    rawTables.forEach((table) => {
      tableMap.set(table.table_name, { name: table.table_name, columns: [] });
    });
    rawColumns.forEach((column) => {
      const entry =
        tableMap.get(column.table_name) ?? { name: column.table_name, columns: [] };
      entry.columns.push({
        name: column.column_name,
        type: column.data_type,
        nullable: column.is_nullable === "YES"
      });
      tableMap.set(column.table_name, entry);
    });

    const tables = Array.from(tableMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return { tables };
  }

  @Post("reset-password")
  async resetPassword(@Req() req: Request, @Body() dto: AdminResetPasswordDto) {
    await this.ensureAdmin(req);
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
    const passwordHash = await bcrypt.hash(nextPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    return { ok: true };
  }

  @Get("loading-tips")
  async listLoadingTips(@Req() req: Request) {
    await this.ensureAdmin(req);
    await this.ensureLoadingTipsSeeded();
    const tips = await this.prisma.loadingTip.findMany({
      orderBy: { createdAt: "asc" }
    });
    return {
      tips: tips.map(
        (tip: { id: string; text: string; isActive: boolean; createdAt: Date }) => ({
          id: tip.id,
          text: tip.text,
          isActive: tip.isActive,
          createdAt: tip.createdAt
        })
      )
    };
  }

  @Post("loading-tips")
  async createLoadingTip(@Req() req: Request, @Body() dto: AdminLoadingTipCreateDto) {
    await this.ensureAdmin(req);
    const text = (dto.text ?? "").trim();
    if (!text) {
      throw new BadRequestException("Текст подсказки обязателен");
    }
    const tip = await this.prisma.loadingTip.create({
      data: {
        text,
        isActive: dto.isActive ?? true
      }
    });
    return { id: tip.id };
  }

  @Patch("loading-tips/:id")
  async updateLoadingTip(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: AdminLoadingTipUpdateDto
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
      data
    });
    return { ok: true };
  }

  @Delete("loading-tips/:id")
  async deleteLoadingTip(@Req() req: Request, @Param("id") id: string) {
    await this.ensureAdmin(req);
    await this.prisma.loadingTip.delete({ where: { id } });
    return { ok: true };
  }
}
