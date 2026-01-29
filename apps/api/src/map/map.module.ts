import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MapController } from "./map.controller";

@Module({
  imports: [PrismaModule],
  controllers: [MapController]
})
export class MapModule {}
