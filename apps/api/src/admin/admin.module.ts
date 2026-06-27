import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GiftsModule } from "../gifts/gifts.module";
import { MailModule } from "../mail/mail.module";
import { PricingModule } from "../pricing/pricing.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { AdminController } from "./admin.controller";
import { AdminPerformanceService } from "./admin-performance.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    GiftsModule,
    PricingModule,
    StorageModule,
    MailModule,
  ],
  controllers: [AdminController],
  providers: [AdminPerformanceService],
})
export class AdminModule {}
