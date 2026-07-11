import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PricingModule } from "../pricing/pricing.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WalletController } from "./wallet.controller";

@Module({
  imports: [PrismaModule, AuthModule, PricingModule],
  controllers: [WalletController]
})
export class WalletModule {}
