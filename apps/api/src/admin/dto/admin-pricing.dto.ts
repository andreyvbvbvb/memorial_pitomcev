import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class AdminUpdateMemorialPlanPriceDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  years!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  price!: number;
}

export class AdminUpdateGiftPriceDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  description?: string;
}

export class AdminUpdateMemorialPublicationModeDto {
  @IsBoolean()
  freeLifetime!: boolean;
}

export class AdminUpdateWalletPaymentModeDto {
  @IsBoolean()
  usdEnabled!: boolean;
}
