import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

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
  @IsIn([1, 3, 6, 12])
  months?: number;
}
