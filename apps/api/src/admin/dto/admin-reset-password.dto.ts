import { IsEmail, IsString, MinLength } from "class-validator";

export class AdminResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
