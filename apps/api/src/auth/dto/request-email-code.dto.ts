import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RequestEmailCodeDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: "Логин может содержать только латиницу, цифры и _"
  })
  login?: string;
}
