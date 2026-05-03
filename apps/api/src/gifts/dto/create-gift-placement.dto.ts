import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateGiftPlacementDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsString()
  giftId!: string;

  @IsString()
  slotName!: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  months?: number;
}
