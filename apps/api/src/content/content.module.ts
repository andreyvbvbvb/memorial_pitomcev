import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ContentController } from "./content.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ContentController]
})
export class ContentModule {}
