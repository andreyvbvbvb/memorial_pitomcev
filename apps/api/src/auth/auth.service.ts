import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt } from "crypto";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AcceptTermsDto } from "./dto/accept-terms.dto";
import { RequestEmailCodeDto } from "./dto/request-email-code.dto";

const REGISTRATION_BONUS_COINS = 150;
const PASSWORD_RESET_TOKEN_TTL_MS = 1000 * 60 * 60;
const EMAIL_VERIFICATION_CODE_TTL_MS = 1000 * 60 * 10;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 1000 * 60;
const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(MailService) private readonly mailService: MailService
  ) {}

  async requestEmailVerificationCode(dto: RequestEmailCodeDto) {
    const email = dto.email.trim().toLowerCase();
    const login = dto.login?.trim();

    await this.assertEmailAvailable(email);
    if (login) {
      await this.assertLoginAvailable(login);
    }

    await this.prisma.emailVerificationCode.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    });

    const latestCode = await this.prisma.emailVerificationCode.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: "desc" }
    });
    if (
      latestCode &&
      latestCode.createdAt.getTime() >
        Date.now() - EMAIL_VERIFICATION_RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException(
        "Код уже отправлен. Повторить отправку можно через минуту",
      );
    }

    const code = this.generateEmailVerificationCode();
    await this.prisma.emailVerificationCode.deleteMany({
      where: { email, consumedAt: null }
    });
    const verificationCode = await this.prisma.emailVerificationCode.create({
      data: {
        email,
        codeHash: this.hashEmailVerificationCode(email, code),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_CODE_TTL_MS)
      }
    });

    try {
      await this.mailService.sendEmailVerificationCode(email, code);
    } catch (err) {
      await this.prisma.emailVerificationCode.delete({
        where: { id: verificationCode.id }
      });
      throw err instanceof Error
        ? err
        : new BadRequestException("Не удалось отправить код подтверждения");
    }

    return {
      ok: true,
      expiresInSeconds: Math.floor(EMAIL_VERIFICATION_CODE_TTL_MS / 1000)
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const login = dto.login.trim();
    if (!dto.acceptTerms || !dto.acceptOffer) {
      throw new BadRequestException(
        "Нужно принять политику обработки персональных данных и публичную оферту",
      );
    }
    await this.assertEmailAvailable(email);
    await this.assertLoginAvailable(login);
    const verificationCode = await this.verifyEmailCode(email, dto.emailCode);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const now = new Date();

    const user = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const consumed = await tx.emailVerificationCode.updateMany({
        where: {
          id: verificationCode.id,
          email,
          codeHash: verificationCode.codeHash,
          consumedAt: null,
          expiresAt: { gt: now }
        },
        data: { consumedAt: now }
      });
      if (consumed.count === 0) {
        throw new BadRequestException("Код подтверждения недействителен или устарел");
      }

      return tx.user.create({
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
      throw new BadRequestException(
        "Нужно принять политику обработки персональных данных и публичную оферту",
      );
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
    const token = this.generateResetToken();
    const tokenHash = this.hashResetToken(token);
    const resetUrl = this.buildPasswordResetUrl(token);
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null }
    });
    const resetToken = await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS)
      }
    });
    try {
      await this.mailService.sendPasswordResetLink(user.email, resetUrl);
    } catch (err) {
      await this.prisma.passwordResetToken.delete({
        where: { id: resetToken.id }
      });
      throw err instanceof Error
        ? err
        : new BadRequestException("Не удалось отправить письмо");
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = this.hashResetToken(token.trim());
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash }
    });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Ссылка для сброса пароля недействительна или устарела");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          id: { not: resetToken.id }
        }
      })
    ]);
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

  private async assertEmailAvailable(email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException("Пользователь с таким email уже существует");
    }
  }

  private async assertLoginAvailable(login: string) {
    const existingLogin = await this.prisma.user.findFirst({
      where: { login: { equals: login, mode: "insensitive" } }
    });
    if (existingLogin) {
      throw new BadRequestException("Логин уже занят");
    }
  }

  private async verifyEmailCode(email: string, code: string) {
    const verificationCode = await this.prisma.emailVerificationCode.findFirst({
      where: {
        email,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!verificationCode) {
      throw new BadRequestException("Код подтверждения недействителен или устарел");
    }
    if (verificationCode.attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
      throw new BadRequestException("Слишком много попыток. Запросите новый код");
    }
    const codeHash = this.hashEmailVerificationCode(email, code);
    if (verificationCode.codeHash !== codeHash) {
      await this.prisma.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { attempts: { increment: 1 } }
      });
      throw new BadRequestException("Неверный код подтверждения");
    }
    return verificationCode;
  }

  private generateEmailVerificationCode() {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  private hashEmailVerificationCode(email: string, code: string) {
    return createHash("sha256")
      .update(`${email.trim().toLowerCase()}:${code.trim()}`)
      .digest("hex");
  }

  private generateResetToken() {
    return randomBytes(32).toString("base64url");
  }

  private hashResetToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private buildPasswordResetUrl(token: string) {
    const frontendUrl = process.env.FRONTEND_URL?.trim() || "http://localhost:3002";
    const url = new URL("/reset-password", frontendUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }
}
