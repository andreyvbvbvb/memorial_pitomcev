import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AcceptTermsDto } from "./dto/accept-terms.dto";

const REGISTRATION_BONUS_COINS = 150;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(MailService) private readonly mailService: MailService
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const login = dto.login.trim();
    if (!dto.acceptTerms || !dto.acceptOffer) {
      throw new BadRequestException("Нужно принять условия соглашения и оферты");
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException("Пользователь с таким email уже существует");
    }
    const existingLogin = await this.prisma.user.findFirst({
      where: { login: { equals: login, mode: "insensitive" } }
    });
    if (existingLogin) {
      throw new BadRequestException("Логин уже занят");
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const now = new Date();
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        login,
        coinBalance: REGISTRATION_BONUS_COINS,
        createdAt: now,
        termsAccepted: true,
        offerAccepted: true,
        termsAcceptedAt: now,
        offerAcceptedAt: now,
        walletTransactions: {
          create: {
            amount: REGISTRATION_BONUS_COINS,
            balanceAfter: REGISTRATION_BONUS_COINS,
            type: "registration_bonus",
            title: "Бонус за регистрацию",
            details: "Стартовые монеты нового аккаунта",
            createdAt: now
          }
        }
      }
    });
    return user;
  }

  async login(dto: LoginDto) {
    const identifier = dto.email.trim();
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

  async acceptTerms(userId: string, dto: AcceptTermsDto) {
    if (!dto.acceptTerms || !dto.acceptOffer) {
      throw new BadRequestException("Нужно принять условия соглашения и оферты");
    }
    const now = new Date();
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        termsAccepted: true,
        offerAccepted: true,
        termsAcceptedAt: now,
        offerAcceptedAt: now
      }
    });
  }

  async forgotPassword(identifier: string) {
    const user = await this.findUserByIdentifier(identifier.trim());
    if (!user) {
      return { ok: true };
    }
    const nextPassword = this.generateRandomPassword();
    const passwordHash = await bcrypt.hash(nextPassword, 10);
    const previousPasswordHash = user.passwordHash;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    try {
      await this.mailService.sendPasswordReset(user.email, nextPassword);
    } catch (err) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: previousPasswordHash }
      });
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
      return this.prisma.user.findUnique({ where: { email: identifier.toLowerCase() } });
    }
    return this.prisma.user.findFirst({
      where: { login: { equals: identifier, mode: "insensitive" } }
    });
  }

  private generateRandomPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = randomBytes(12);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }
}
