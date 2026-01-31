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
    const login = dto.login.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException("Пользователь с таким email уже существует");
    }
    const existingLogin = await this.prisma.user.findUnique({ where: { login } });
    if (existingLogin) {
      throw new BadRequestException("Логин уже занят");
    }
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

  private generateRandomPassword() {
    return Math.random().toString(36).slice(-10);
  }
}
