import { BadRequestException, Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private transporter?: nodemailer.Transporter;

  private getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 0);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    if (!host || !port || !user || !pass) {
      throw new BadRequestException("Почтовый сервер не настроен");
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });

    return this.transporter;
  }

  async sendPasswordResetLink(email: string, resetUrl: string) {
    const transporter = this.getTransporter();
    const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@memorial.local";
    const text = [
      "Здравствуйте!",
      "",
      "Для сброса пароля МЯУГАВ откройте ссылку:",
      resetUrl,
      "",
      "Ссылка действует 1 час. Если срок истек, запросите восстановление пароля еще раз.",
      "Если вы не запрашивали восстановление пароля, напишите нам: meowgav.service@mail.ru"
    ].join("\n");

    await transporter.sendMail({
      from,
      to: email,
      subject: "Восстановление пароля — МЯУГАВ",
      text,
      html: `
        <div style="font-family: Arial, sans-serif; color: #5d4037; line-height: 1.55;">
          <h2 style="margin: 0 0 16px;">Восстановление пароля МЯУГАВ</h2>
          <p>Нажмите на кнопку ниже, чтобы задать новый пароль:</p>
          <p style="margin: 20px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 13px 22px; border-radius: 16px; background: #111827; color: #ffffff; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase;">Сбросить пароль</a>
          </p>
          <p>Ссылка действует 1 час. Если срок истек, запросите восстановление пароля еще раз.</p>
          <p style="color: #8d6e63;">Если вы не запрашивали восстановление пароля, напишите нам: meowgav.service@mail.ru</p>
        </div>
      `
    });
  }
}
