import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export class AdminBulkCreateUserRowDto {
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

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  initialBalance!: number;
}

export class AdminBulkCreateUsersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminBulkCreateUserRowDto)
  rows!: AdminBulkCreateUserRowDto[];
}
