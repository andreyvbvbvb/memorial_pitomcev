import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

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
}
