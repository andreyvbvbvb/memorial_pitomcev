import { Type } from "class-transformer";
import { IsInt, IsString, Min } from "class-validator";

export class CreateCharityReportDto {
  @IsString()
  title!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  body!: string;
}
