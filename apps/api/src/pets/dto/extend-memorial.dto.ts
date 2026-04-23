import { Type } from "class-transformer";
import { IsNumber, IsString, Max, Min } from "class-validator";

export class ExtendMemorialDto {
  @IsString()
  ownerId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  years!: number;
}
