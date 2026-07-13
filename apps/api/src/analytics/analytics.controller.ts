import { Body, Controller, Inject, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { getMoscowDay, normalizeAnalyticsPage } from "./analytics-pages";
import { TrackPageViewDto } from "./dto/track-page-view.dto";

@Controller("analytics")
export class AnalyticsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post("page-view")
  async trackPageView(@Body() dto: TrackPageViewDto) {
    const page = normalizeAnalyticsPage(dto.path);
    if (!page) {
      return { ok: true, tracked: false };
    }
    const day = getMoscowDay();
    await this.prisma.pageViewDaily.upsert({
      where: {
        day_page: {
          day,
          page,
        },
      },
      create: {
        day,
        page,
        views: 1,
      },
      update: {
        views: {
          increment: 1,
        },
      },
    });
    return { ok: true, tracked: true };
  }
}
