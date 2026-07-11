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
      auth: { user, pass },
    });

    return this.transporter;
  }

  async sendPasswordResetLink(email: string, resetUrl: string) {
    const transporter = this.getTransporter();
    const from =
      process.env.SMTP_FROM ??
      process.env.SMTP_USER ??
      "no-reply@memorial.local";
    const text = [
      "Здравствуйте!",
      "",
      "Для сброса пароля МЯУГАВ откройте ссылку:",
      resetUrl,
      "",
      "Ссылка действует 1 час. Если срок истек, запросите восстановление пароля еще раз.",
      "Если вы не запрашивали восстановление пароля, напишите нам: support@мяугав.com",
    ].join("\n");

    await transporter.sendMail({
      from,
      to: email,
      subject: "Восстановление пароля — МЯУГАВ",
      text,
      html: `
        <div style="font-family: 'Noto Sans', Arial, sans-serif; color: #5d4037; line-height: 1.55;">
          <h2 style="margin: 0 0 16px;">Восстановление пароля МЯУГАВ</h2>
          <p>Нажмите на кнопку ниже, чтобы задать новый пароль:</p>
          <p style="margin: 20px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 13px 22px; border-radius: 16px; background: #111827; color: #ffffff; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase;">Сбросить пароль</a>
          </p>
          <p>Ссылка действует 1 час. Если срок истек, запросите восстановление пароля еще раз.</p>
          <p style="color: #8d6e63;">Если вы не запрашивали восстановление пароля, напишите нам: support@мяугав.com</p>
        </div>
      `,
    });
  }

  async sendEmailVerificationCode(email: string, code: string) {
    const transporter = this.getTransporter();
    const from =
      process.env.SMTP_FROM ??
      process.env.SMTP_USER ??
      "no-reply@memorial.local";
    const text = [
      "Здравствуйте!",
      "",
      "Ваш код подтверждения email для регистрации в МЯУГАВ:",
      code,
      "",
      "Код действует 10 минут. Если вы не регистрировались в МЯУГАВ, просто проигнорируйте это письмо.",
      "Если возникнут вопросы, напишите нам: support@мяугав.com",
    ].join("\n");

    await transporter.sendMail({
      from,
      to: email,
      subject: "Код подтверждения email — МЯУГАВ",
      text,
      html: `
        <div style="font-family: 'Noto Sans', Arial, sans-serif; color: #5d4037; line-height: 1.55;">
          <h2 style="margin: 0 0 16px;">Подтверждение email</h2>
          <p>Введите этот код на странице регистрации МЯУГАВ:</p>
          <div style="display: inline-block; margin: 16px 0; padding: 14px 22px; border-radius: 18px; background: #f7f1ee; color: #111827; font-size: 28px; font-weight: 900; letter-spacing: 0.22em;">
            ${this.escapeHtml(code)}
          </div>
          <p>Код действует 10 минут.</p>
          <p style="color: #8d6e63;">Если вы не регистрировались в МЯУГАВ, просто проигнорируйте это письмо.</p>
        </div>
      `,
    });
  }

  async sendMemorialApproved(
    email: string,
    petName: string,
    memorialUrl: string,
    isPublic: boolean,
  ) {
    const transporter = this.getTransporter();
    const from =
      process.env.SMTP_FROM ??
      process.env.SMTP_USER ??
      "no-reply@memorial.local";
    const visibilityText = isPublic
      ? "Мемориал стал виден другим пользователям на общей карте памяти."
      : "Мемориал приватный и будет виден только вам.";
    const text = [
      "Здравствуйте!",
      "",
      `Мемориал «${petName}» прошел модерацию и опубликован.`,
      visibilityText,
      "",
      `Открыть мемориал: ${memorialUrl}`,
      "",
      "Спасибо, что создаете память вместе с МЯУГАВ.",
    ].join("\n");

    await transporter.sendMail({
      from,
      to: email,
      subject: "Мемориал опубликован — МЯУГАВ",
      text,
      html: `
        <div style="font-family: 'Noto Sans', Arial, sans-serif; color: #5d4037; line-height: 1.55;">
          <h2 style="margin: 0 0 16px;">Мемориал опубликован</h2>
          <p>Мемориал «${this.escapeHtml(petName)}» прошел модерацию.</p>
          <p>${this.escapeHtml(visibilityText)}</p>
          <p style="margin: 20px 0;">
            <a href="${memorialUrl}" style="display: inline-block; padding: 13px 22px; border-radius: 16px; background: #111827; color: #ffffff; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase;">Открыть мемориал</a>
          </p>
          <p style="color: #8d6e63;">Спасибо, что создаете память вместе с МЯУГАВ.</p>
        </div>
      `,
    });
  }

  async sendMemorialNeedsChanges(
    email: string,
    petName: string,
    editUrl: string,
    comment: string,
  ) {
    const transporter = this.getTransporter();
    const from =
      process.env.SMTP_FROM ??
      process.env.SMTP_USER ??
      "no-reply@memorial.local";
    const text = [
      "Здравствуйте!",
      "",
      `Мемориал «${petName}» пока не прошел модерацию.`,
      "Пожалуйста, поправьте данные и отправьте мемориал на проверку снова.",
      "",
      "Что нужно поправить:",
      comment,
      "",
      `Редактировать мемориал: ${editUrl}`,
      "",
      "Если возникнут вопросы, напишите нам: support@мяугав.com",
    ].join("\n");

    await transporter.sendMail({
      from,
      to: email,
      subject: "Нужно поправить мемориал — МЯУГАВ",
      text,
      html: `
        <div style="font-family: 'Noto Sans', Arial, sans-serif; color: #5d4037; line-height: 1.55;">
          <h2 style="margin: 0 0 16px;">Мемориал нужно поправить</h2>
          <p>Мемориал «${this.escapeHtml(petName)}» пока не прошел модерацию.</p>
          <p>Пожалуйста, поправьте данные и отправьте мемориал на проверку снова.</p>
          <div style="margin: 18px 0; padding: 14px 16px; border-radius: 16px; background: #f7f1ee; color: #6d4c41;">
            <strong>Что нужно поправить:</strong><br />
            ${this.escapeHtml(comment).replace(/\n/g, "<br />")}
          </div>
          <p style="margin: 20px 0;">
            <a href="${editUrl}" style="display: inline-block; padding: 13px 22px; border-radius: 16px; background: #111827; color: #ffffff; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase;">Редактировать</a>
          </p>
          <p style="color: #8d6e63;">Если возникнут вопросы, напишите нам: support@мяугав.com</p>
        </div>
      `,
    });
  }

  async sendMemorialSubmittedForModeration(params: {
    to?: string;
    petName: string;
    petId: string;
    ownerEmail: string;
    ownerLogin?: string | null;
    memorialUrl: string;
    adminUrl: string;
    reviewType: "INITIAL" | "REVISION" | string;
    changedBlocks?: string[];
    isPublic: boolean;
  }) {
    const transporter = this.getTransporter();
    const from =
      process.env.SMTP_FROM ??
      process.env.SMTP_USER ??
      "no-reply@memorial.local";
    const to = params.to || "support@мяугав.com";
    const reviewText =
      params.reviewType === "REVISION"
        ? "повторная проверка после правок"
        : "первичная проверка после публикации";
    const changedBlocks =
      params.changedBlocks && params.changedBlocks.length > 0
        ? params.changedBlocks.join(", ")
        : "не указаны";
    const ownerLabel = params.ownerLogin
      ? `${params.ownerLogin} (${params.ownerEmail})`
      : params.ownerEmail;
    const visibilityText = params.isPublic ? "публичный" : "приватный";
    const text = [
      "Здравствуйте!",
      "",
      "В модерации появился мемориал.",
      "",
      `Мемориал: ${params.petName}`,
      `ID: ${params.petId}`,
      `Владелец: ${ownerLabel}`,
      `Тип проверки: ${reviewText}`,
      `Измененные блоки: ${changedBlocks}`,
      `Видимость: ${visibilityText}`,
      "",
      `Открыть мемориал: ${params.memorialUrl}`,
      `Открыть модерацию: ${params.adminUrl}`,
    ].join("\n");

    await transporter.sendMail({
      from,
      to,
      subject: "Новый мемориал на модерации — МЯУГАВ",
      text,
      html: `
        <div style="font-family: 'Noto Sans', Arial, sans-serif; color: #5d4037; line-height: 1.55;">
          <h2 style="margin: 0 0 16px;">Мемориал на модерации</h2>
          <p>В очереди модерации появился мемориал «${this.escapeHtml(params.petName)}».</p>
          <div style="margin: 18px 0; padding: 14px 16px; border-radius: 16px; background: #f7f1ee; color: #6d4c41;">
            <strong>ID:</strong> ${this.escapeHtml(params.petId)}<br />
            <strong>Владелец:</strong> ${this.escapeHtml(ownerLabel)}<br />
            <strong>Тип проверки:</strong> ${this.escapeHtml(reviewText)}<br />
            <strong>Измененные блоки:</strong> ${this.escapeHtml(changedBlocks)}<br />
            <strong>Видимость:</strong> ${this.escapeHtml(visibilityText)}
          </div>
          <p style="margin: 20px 0;">
            <a href="${params.adminUrl}" style="display: inline-block; padding: 13px 22px; border-radius: 16px; background: #111827; color: #ffffff; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase;">Открыть модерацию</a>
          </p>
          <p><a href="${params.memorialUrl}" style="color: #5d4037;">Открыть мемориал</a></p>
        </div>
      `,
    });
  }

  async sendMemorialCareReminder(
    email: string,
    petName: string,
    memorialUrl: string,
  ) {
    const transporter = this.getTransporter();
    const from =
      process.env.SMTP_FROM ??
      process.env.SMTP_USER ??
      "no-reply@memorial.local";
    const text = [
      "Здравствуйте!",
      "",
      `Мемориал «${petName}» полностью покрылся следами времени.`,
      "Мемориал всегда выглядит красивее, когда за ним ухаживают и очищают его.",
      "Будет здорово, если вы заглянете и немного позаботитесь о нем.",
      "",
      `Открыть мемориал: ${memorialUrl}`,
      "",
      "Спасибо, что храните память вместе с МЯУГАВ.",
    ].join("\n");

    await transporter.sendMail({
      from,
      to: email,
      subject: "Мемориал ждёт ухода — МЯУГАВ",
      text,
      html: `
        <div style="font-family: 'Noto Sans', Arial, sans-serif; color: #5d4037; line-height: 1.55;">
          <h2 style="margin: 0 0 16px;">Мемориал ждёт ухода</h2>
          <p>Мемориал «${this.escapeHtml(petName)}» полностью покрылся следами времени.</p>
          <p>Мемориал всегда выглядит красивее, когда за ним ухаживают и очищают его. Будет здорово, если вы заглянете и немного позаботитесь о нем.</p>
          <p style="margin: 20px 0;">
            <a href="${memorialUrl}" style="display: inline-block; padding: 13px 22px; border-radius: 16px; background: #111827; color: #ffffff; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase;">Открыть мемориал</a>
          </p>
          <p style="color: #8d6e63;">Спасибо, что храните память вместе с МЯУГАВ.</p>
        </div>
      `,
    });
  }

  async sendMemorialExpirationReminder(
    email: string,
    petName: string,
    memorialUrl: string,
    activeUntil: Date,
  ) {
    const transporter = this.getTransporter();
    const from =
      process.env.SMTP_FROM ??
      process.env.SMTP_USER ??
      "no-reply@memorial.local";
    const dateText = activeUntil.toLocaleDateString("ru-RU");
    const text = [
      "Здравствуйте!",
      "",
      `Поддержка мемориала «${petName}» заканчивается ${dateText}.`,
      "Чтобы мемориал продолжил работать, откройте страницу мемориала и в блоке управления нажмите «Продлить».",
      "После этого выберите срок продления и подтвердите оплату монетами.",
      "",
      `Открыть мемориал: ${memorialUrl}`,
      "",
      "Если возникнут вопросы, напишите нам: support@мяугав.com",
    ].join("\n");

    await transporter.sendMail({
      from,
      to: email,
      subject: "Поддержка мемориала скоро закончится — МЯУГАВ",
      text,
      html: `
        <div style="font-family: 'Noto Sans', Arial, sans-serif; color: #5d4037; line-height: 1.55;">
          <h2 style="margin: 0 0 16px;">Поддержка мемориала скоро закончится</h2>
          <p>Поддержка мемориала «${this.escapeHtml(petName)}» заканчивается <strong>${this.escapeHtml(dateText)}</strong>.</p>
          <p>Чтобы мемориал продолжил работать, откройте страницу мемориала и в блоке управления нажмите «Продлить». Затем выберите срок продления и подтвердите оплату монетами.</p>
          <p style="margin: 20px 0;">
            <a href="${memorialUrl}" style="display: inline-block; padding: 13px 22px; border-radius: 16px; background: #111827; color: #ffffff; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase;">Открыть мемориал</a>
          </p>
          <p style="color: #8d6e63;">Если возникнут вопросы, напишите нам: support@мяугав.com</p>
        </div>
      `,
    });
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
