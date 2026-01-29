import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { GiftsController } from "./gifts.controller";
import { GiftsService } from "./gifts.service";

@Module({
  imports: [PrismaModule],
  controllers: [GiftsController],
  providers: [GiftsService]
})
export class GiftsModule {}
