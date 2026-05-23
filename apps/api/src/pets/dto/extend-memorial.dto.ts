import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class ExtendMemorialDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  years!: number;
}
