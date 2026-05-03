import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { GiftsController } from "./gifts.controller";
import { GiftsService } from "./gifts.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GiftsController],
  providers: [GiftsService],
  exports: [GiftsService]
})
export class GiftsModule {}
