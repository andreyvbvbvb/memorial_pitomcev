import {
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: "Логин может содержать только латиницу, цифры и _"
  })
  login!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, {
    message: "Код подтверждения должен состоять из 6 цифр"
  })
  emailCode!: string;

  @IsBoolean()
  acceptTerms!: boolean;

  @IsBoolean()
  acceptOffer!: boolean;
}
