import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class AdminLoadingTipCreateDto {
  @IsString()
  @MaxLength(240)
  text: string = "";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminLoadingTipUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  text?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
