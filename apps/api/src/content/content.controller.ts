import { Controller, Get, Header, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import {
  HERO_VIDEO_SETTING_KEY,
  normalizeHeroVideoSetting,
} from "./hero-video-setting";
import { DEFAULT_LOADING_TIPS } from "./loading-tips.constants";

@Controller("content")
export class ContentController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  private async ensureDefaults() {
    const count = await this.prisma.loadingTip.count();
    if (count > 0) {
      return;
    }
    await this.prisma.loadingTip.createMany({
      data: DEFAULT_LOADING_TIPS.map((text: string) => ({ text }))
    });
  }

  @Get("loading-tips")
  async getLoadingTips() {
    await this.ensureDefaults();
    const tips = await this.prisma.loadingTip.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });
    return {
      tips: tips.map(
        (tip: { id: string; text: string; createdAt: Date }) => ({
          id: tip.id,
          text: tip.text,
          createdAt: tip.createdAt
        })
      )
    };
  }

  @Get("site-banner")
  async getSiteBanner() {
    const banner = await this.prisma.siteBanner.findUnique({
      where: { id: "global" },
    });
    if (!banner?.isActive || !banner.text.trim()) {
      return { banner: null };
    }
    return {
      banner: {
        text: banner.text,
        updatedAt: banner.updatedAt,
      },
    };
  }

  @Get("hero-video")
  @Header("Cache-Control", "public, max-age=30, stale-while-revalidate=300")
  async getHeroVideo() {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: HERO_VIDEO_SETTING_KEY },
    });
    return {
      heroVideo: normalizeHeroVideoSetting(setting?.value),
    };
  }

  @Get("news")
  async getNews(@Req() req: Request) {
    const user = await this.authService.getUserFromToken(req.cookies?.access_token);
    const posts = await this.prisma.newsPost.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    const read = user
      ? await this.prisma.newsRead.findUnique({ where: { userId: user.id } })
      : null;
    const latestReadAt = read?.latestReadAt ?? null;
    const unreadCount = user
      ? posts.filter(
          (post: { createdAt: Date }) =>
            !latestReadAt || post.createdAt.getTime() > latestReadAt.getTime()
        ).length
      : 0;
    return { posts, unreadCount, latestReadAt };
  }

  @Get("news/status")
  async getNewsStatus(@Req() req: Request) {
    const user = await this.authService.getUserFromToken(req.cookies?.access_token);
    if (!user) {
      return { unreadCount: 0 };
    }
    const read = await this.prisma.newsRead.findUnique({ where: { userId: user.id } });
    const unreadCount = await this.prisma.newsPost.count({
      where: {
        isActive: true,
        ...(read?.latestReadAt ? { createdAt: { gt: read.latestReadAt } } : {})
      }
    });
    return { unreadCount };
  }

  @Post("news/read")
  @UseGuards(AuthGuard)
  async markNewsRead(@CurrentUser() user: AuthenticatedUser) {
    const now = new Date();
    await this.prisma.newsRead.upsert({
      where: { userId: user.id },
      create: { userId: user.id, latestReadAt: now },
      update: { latestReadAt: now }
    });
    return { ok: true, latestReadAt: now };
  }

  @Get("documents/:documentType/revisions")
  async getDocumentRevisions(@Param("documentType") documentType: string) {
    const type =
      documentType === "offer" || documentType === "politics"
        ? documentType
        : null;
    if (!type) {
      return { revisions: [] };
    }
    const revisions = await this.prisma.documentRevision.findMany({
      where: { documentType: type },
      orderBy: { createdAt: "desc" },
      take: 80
    });
    return { revisions };
  }
}
