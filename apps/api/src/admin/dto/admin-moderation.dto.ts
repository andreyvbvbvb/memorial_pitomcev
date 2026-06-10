import { IsIn, IsOptional, IsString, Length } from "class-validator";

export const MODERATION_STATUSES = [
  "PENDING",
  "APPROVED",
  "NEEDS_CHANGES",
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export class AdminModerationDto {
  @IsIn(MODERATION_STATUSES)
  status!: ModerationStatus;

  @IsOptional()
  @IsString()
  @Length(1, 1200)
  comment?: string;
}
