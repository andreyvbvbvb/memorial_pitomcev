import { BadRequestException, Body, Controller, Get, Inject, Param, Patch } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
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
  async getProfile(@Param("id") id: string) {
    const user = await this.ensureOwner(id);
    return {
      id: user.id,
      login: user.login,
      email: user.email,
      coinBalance: user.coinBalance
    };
  }

  @Patch(":id")
  async updateProfile(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    const currentUser = await this.ensureOwner(id);
    if (dto.login) {
      const existing = await this.prisma.user.findUnique({
        where: { login: dto.login.toLowerCase() }
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
        login: login ? login.toLowerCase() : undefined,
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
