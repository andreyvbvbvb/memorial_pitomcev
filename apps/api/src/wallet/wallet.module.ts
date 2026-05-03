import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WalletController } from "./wallet.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WalletController]
})
export class WalletModule {}
