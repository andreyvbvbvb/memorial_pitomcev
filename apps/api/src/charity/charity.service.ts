import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { extname } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../storage/s3.service";
import { CreateCharityReportDto } from "./dto/create-charity-report.dto";

const DEFAULT_TOTALS_ID = "global";

@Injectable()
export class CharityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(S3Service) private readonly s3: S3Service
  ) {}

  async getSummary() {
    const totals = await this.prisma.charityTotals.findUnique({
      where: { id: DEFAULT_TOTALS_ID }
    });
    const reports = await this.prisma.charityReport.findMany({
      orderBy: { createdAt: "desc" }
    });
    return {
      totals: {
        totalAccrued: totals?.totalAccrued ?? 0,
        totalPaid: totals?.totalPaid ?? 0
      },
      reports
    };
  }

  async createReport(
    dto: CreateCharityReportDto,
    files: Array<{ originalname: string; buffer: Buffer }> = []
  ) {
    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException("Заголовок обязателен");
    }
    const body = dto.body?.trim();
    if (!body) {
      throw new BadRequestException("Текст отчёта обязателен");
    }
    if (!Number.isFinite(dto.amount) || dto.amount < 0) {
      throw new BadRequestException("Сумма пожертвований указана некорректно");
    }

    const photoUrls = await this.uploadPhotos(files);
    const [report] = await this.prisma.$transaction([
      this.prisma.charityReport.create({
        data: {
          title,
          amount: Math.round(dto.amount),
          body,
          photos: photoUrls
        }
      }),
      this.prisma.charityTotals.upsert({
        where: { id: DEFAULT_TOTALS_ID },
        create: { id: DEFAULT_TOTALS_ID, totalPaid: Math.round(dto.amount) },
        update: { totalPaid: { increment: Math.round(dto.amount) } }
      })
    ]);

    return report;
  }

  private async uploadPhotos(files: Array<{ originalname: string; buffer: Buffer }>) {
    if (!files.length) {
      return [];
    }

    const uploads = files.map(async (file) => {
      const ext = extname(file.originalname).toLowerCase() || ".jpg";
      const safeExt = ext.length <= 8 ? ext : ".jpg";
      const contentType = safeExt === ".png" ? "image/png" : "image/jpeg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
      const key = `charity/reports/${fileName}`;
      return this.s3.uploadPublic(key, file.buffer, contentType);
    });

    return Promise.all(uploads);
  }
}
