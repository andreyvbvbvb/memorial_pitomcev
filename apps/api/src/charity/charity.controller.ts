import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { CharityService } from "./charity.service";
import { CreateCharityReportDto } from "./dto/create-charity-report.dto";

const ADMIN_EMAILS = new Set(["andreyvbvbvb@gmail.com"]);

@Controller("charity")
export class CharityController {
  constructor(
    @Inject(CharityService) private readonly charityService: CharityService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  private async ensureAdmin(req: Request) {
    const token = req.cookies?.access_token;
    const user = await this.authService.getUserFromToken(token);
    if (!user || !user.email) {
      throw new ForbiddenException("Доступ запрещён");
    }
    const email = user.email.toLowerCase();
    if (!ADMIN_EMAILS.has(email)) {
      throw new ForbiddenException("Доступ запрещён");
    }
    return user;
  }

  @Get("summary")
  getSummary() {
    return this.charityService.getSummary();
  }

  @Post("reports")
  @UseInterceptors(
    FilesInterceptor("photos", 10, {
      limits: { fileSize: 6 * 1024 * 1024 }
    })
  )
  async createReport(
    @Req() req: Request,
    @Body() dto: CreateCharityReportDto,
    @UploadedFiles() files?: Array<{ originalname: string; buffer: Buffer }>
  ) {
    await this.ensureAdmin(req);
    if (!dto) {
      throw new BadRequestException("Данные отчёта не найдены");
    }
    return this.charityService.createReport(dto, files ?? []);
  }
}
