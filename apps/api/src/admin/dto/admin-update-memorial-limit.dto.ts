import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEmail, IsInt, Max, Min } from "class-validator";

export class AdminUpdateMemorialLimitDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  emails!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  maxMemorials!: number;
}
