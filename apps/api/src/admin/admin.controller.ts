import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Post,
  Req
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminSqlDto } from "./dto/admin-sql.dto";

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
    if (!isSelect && !isDelete) {
      throw new BadRequestException("Разрешены только SELECT и DELETE");
    }
    if (/\b(insert|update|drop|alter|create|truncate|grant|revoke)\b/.test(lower)) {
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
        type: "delete",
        rowCount: Array.isArray(rows) ? rows.length : 0,
        rows: safeRows
      };
    }

    const affected = await this.prisma.$executeRawUnsafe(trimmed);
    return {
      type: "delete",
      affected: typeof affected === "bigint" ? affected.toString() : affected
    };
  }
}
