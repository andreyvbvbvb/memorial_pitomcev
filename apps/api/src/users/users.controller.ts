import { BadRequestException, Body, Controller, Get, Inject, Param, Patch } from "@nestjs/common";
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
        email
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
    await this.ensureOwner(id);
    if (dto.login) {
      const existing = await this.prisma.user.findUnique({
        where: { login: dto.login.toLowerCase() }
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException("Логин уже занят");
      }
    }
    const login = dto.login?.trim();
    const email = dto.email?.trim();
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        login: login ? login.toLowerCase() : undefined,
        email: email ? email.toLowerCase() : undefined
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
