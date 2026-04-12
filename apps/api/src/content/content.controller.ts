import { Controller, Get, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DEFAULT_LOADING_TIPS } from "./loading-tips.constants";

@Controller("content")
export class ContentController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async ensureDefaults() {
    const count = await this.prisma.loadingTip.count();
    if (count > 0) {
      return;
    }
    await this.prisma.loadingTip.createMany({
      data: DEFAULT_LOADING_TIPS.map((text) => ({ text }))
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
      tips: tips.map((tip) => ({
        id: tip.id,
        text: tip.text,
        createdAt: tip.createdAt
      }))
    };
  }
}
