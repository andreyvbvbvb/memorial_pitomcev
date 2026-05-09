import { Type } from "class-transformer";
import { IsEmail, IsInt, Max, Min } from "class-validator";

export class AdminAddCoinsDto {
  @IsEmail()
  email!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  amount!: number;
}
