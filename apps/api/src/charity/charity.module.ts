import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { CharityController } from "./charity.controller";
import { CharityService } from "./charity.service";

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [CharityController],
  providers: [CharityService]
})
export class CharityModule {}
