import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(MailService) private readonly mailService: MailService
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException("Пользователь с таким email уже существует");
    }
    const login = await this.generateUniqueLogin(email);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        login
      }
    });
    return user;
  }

  async login(dto: LoginDto) {
    const identifier = dto.email.trim().toLowerCase();
    const user = await this.findUserByIdentifier(identifier);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Неверный email или пароль");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Неверный email или пароль");
    }
    return user;
  }

  async forgotPassword(identifier: string) {
    const user = await this.findUserByIdentifier(identifier.trim().toLowerCase());
    if (!user) {
      return { ok: true };
    }
    const nextPassword = this.generateRandomPassword();
    const passwordHash = await bcrypt.hash(nextPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    try {
      await this.mailService.sendPasswordReset(user.email, nextPassword);
    } catch (err) {
      throw err instanceof Error
        ? err
        : new BadRequestException("Не удалось отправить письмо");
    }
    return { ok: true };
  }

  signToken(user: { id: string; email: string }) {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

  async getUserFromToken(token?: string) {
    if (!token) {
      return null;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      return user;
    } catch {
      return null;
    }
  }

  private async findUserByIdentifier(identifier: string) {
    if (identifier.includes("@")) {
      return this.prisma.user.findUnique({ where: { email: identifier } });
    }
    return this.prisma.user.findUnique({ where: { login: identifier } });
  }

  private async generateUniqueLogin(email: string) {
    const base = this.normalizeLogin(email.split("@")[0] ?? "user");
    let candidate = base || "user";
    let attempts = 0;
    while (attempts < 5) {
      const exists = await this.prisma.user.findUnique({ where: { login: candidate } });
      if (!exists) {
        return candidate;
      }
      const suffix = Math.random().toString(36).slice(2, 6);
      candidate = `${base || "user"}_${suffix}`;
      attempts += 1;
    }
    return `${base || "user"}_${Date.now().toString(36).slice(-4)}`;
  }

  private normalizeLogin(value: string) {
    const cleaned = value
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20);
    return cleaned;
  }

  private generateRandomPassword() {
    return Math.random().toString(36).slice(-10);
  }
}
