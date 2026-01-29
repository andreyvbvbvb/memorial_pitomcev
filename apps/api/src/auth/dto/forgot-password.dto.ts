import { IsString, MaxLength, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  identifier!: string;
}
