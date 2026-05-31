import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AdminNewsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(6000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

