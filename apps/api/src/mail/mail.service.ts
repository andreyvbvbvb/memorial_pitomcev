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

  async sendPasswordReset(email: string, tempPassword: string) {
    const transporter = this.getTransporter();
    const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@memorial.local";

    await transporter.sendMail({
      from,
      to: email,
      subject: "Сброс пароля — Memorial",
      text: `Ваш новый временный пароль: ${tempPassword}\n\nРекомендуем сразу изменить пароль в профиле.`
    });
  }
}
