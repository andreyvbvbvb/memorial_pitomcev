import { IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string;
}
