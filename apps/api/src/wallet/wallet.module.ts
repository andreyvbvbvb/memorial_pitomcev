import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WalletController } from "./wallet.controller";

@Module({
  imports: [PrismaModule],
  controllers: [WalletController]
})
export class WalletModule {}
