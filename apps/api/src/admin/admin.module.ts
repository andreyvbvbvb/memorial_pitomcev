import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GiftsModule } from "../gifts/gifts.module";
import { PricingModule } from "../pricing/pricing.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminController } from "./admin.controller";

@Module({
  imports: [PrismaModule, AuthModule, GiftsModule, PricingModule],
  controllers: [AdminController]
})
export class AdminModule {}
