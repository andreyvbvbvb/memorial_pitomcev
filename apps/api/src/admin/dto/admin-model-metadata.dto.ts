import { IsString, MaxLength } from "class-validator";

export class AdminModelMetadataDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(260)
  description!: string;
}
