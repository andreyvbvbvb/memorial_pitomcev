import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  UseGuards
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { canAccessAdmin } from "../auth/access-level";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateUserDto } from "./dto/update-user.dto";

@Controller("users")
export class UsersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async ensureOwner(ownerId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: ownerId }
    });
    if (existing) {
      return existing;
    }
    const safeId = ownerId.trim();
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

  @Get(":id")
  @UseGuards(AuthGuard)
  async getProfile(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    if (id !== user.id && !canAccessAdmin(user)) {
      throw new ForbiddenException("Можно смотреть только свой профиль");
    }
    const profile = await this.ensureOwner(id);
    return {
      id: profile.id,
      login: profile.login,
      email: profile.email,
      coinBalance: profile.coinBalance
    };
  }

  @Patch(":id")
  @UseGuards(AuthGuard)
  async updateProfile(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (id !== user.id && !canAccessAdmin(user)) {
      throw new ForbiddenException("Можно менять только свой профиль");
    }
    const currentUser = await this.ensureOwner(id);
    if (dto.login) {
      const existing = await this.prisma.user.findFirst({
        where: { login: { equals: dto.login.trim(), mode: "insensitive" } }
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException("Логин уже занят");
      }
    }
    const login = dto.login?.trim();
    const email = dto.email?.trim().toLowerCase();
    if (email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email }
      });
      if (existingEmail && existingEmail.id !== id) {
        throw new BadRequestException("Email уже используется");
      }
    }

    let passwordHash: string | undefined;
    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException("Введите текущий пароль");
      }
      if (!currentUser.passwordHash) {
        throw new BadRequestException("Пароль ещё не задан");
      }
      const ok = await bcrypt.compare(dto.currentPassword, currentUser.passwordHash);
      if (!ok) {
        throw new BadRequestException("Неверный текущий пароль");
      }
      passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        login: login || undefined,
        email: email || undefined,
        passwordHash
      }
    });
    return {
      id: updated.id,
      login: updated.login,
      email: updated.email,
      coinBalance: updated.coinBalance
    };
  }
}
