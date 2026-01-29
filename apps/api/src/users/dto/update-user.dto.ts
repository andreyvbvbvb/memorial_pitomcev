import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-z0-9._]+$/, {
    message: "Логин может содержать только a-z, 0-9, точку и подчёркивание"
  })
  login?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string | null;
}
