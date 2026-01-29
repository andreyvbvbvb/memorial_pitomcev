import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { PetsModule } from "./pets/pets.module";
import { MapModule } from "./map/map.module";
import { WalletModule } from "./wallet/wallet.module";
import { GiftsModule } from "./gifts/gifts.module";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [PrismaModule, PetsModule, MapModule, WalletModule, GiftsModule, UsersModule, AuthModule],
  controllers: [HealthController]
})
export class AppModule {}
