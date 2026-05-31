import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ContentController } from "./content.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ContentController]
})
export class ContentModule {}
