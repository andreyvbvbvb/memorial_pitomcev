import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class AdminSiteBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(220)
  text?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
