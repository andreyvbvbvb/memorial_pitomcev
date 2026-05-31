import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class AdminDocumentUploadDto {
  @IsString()
  @IsIn(["terms", "offer"])
  documentType!: "terms" | "offer";

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;
}

