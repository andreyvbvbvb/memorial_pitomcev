import { IsString, Matches, MaxLength } from "class-validator";

export class AdminMoveGiftPlacementDto {
  @IsString()
  @MaxLength(120)
  @Matches(/^gift_[a-z0-9_]+$/i)
  slotName!: string;
}

export class AdminDeactivateAllGiftsDto {
  @IsString()
  @MaxLength(80)
  petId!: string;
}
