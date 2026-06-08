import { IsString, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(300)
  token!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string;
}
