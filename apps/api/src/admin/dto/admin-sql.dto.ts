import { IsString, MinLength } from "class-validator";

export class AdminSqlDto {
  @IsString()
  @MinLength(1)
  query!: string;
}
