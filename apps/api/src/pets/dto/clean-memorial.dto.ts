import { IsIn, IsOptional, IsString } from "class-validator";

const DIRT_SLOT_NAMES = [
  "dirt_slot_1",
  "dirt_slot_2",
  "dirt_slot_3",
  "dirt_slot_4"
] as const;

export class CleanMemorialDto {
  @IsOptional()
  @IsString()
  @IsIn(DIRT_SLOT_NAMES)
  slot?: (typeof DIRT_SLOT_NAMES)[number];
}
