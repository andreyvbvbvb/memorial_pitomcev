import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MailModule } from "../mail/mail.module";
import { MaintenanceModule } from "../maintenance/maintenance.module";
import { PricingModule } from "../pricing/pricing.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { PetsController } from "./pets.controller";
import { PetsService } from "./pets.service";

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    MaintenanceModule,
    PricingModule,
    MailModule,
  ],
  controllers: [PetsController],
  providers: [PetsService]
})
export class PetsModule {}
