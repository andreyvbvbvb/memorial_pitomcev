import { Module } from "@nestjs/common";
import { MaintenanceModule } from "../maintenance/maintenance.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MapController } from "./map.controller";

@Module({
  imports: [PrismaModule, MaintenanceModule],
  controllers: [MapController]
})
export class MapModule {}
