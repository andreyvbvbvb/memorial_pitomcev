import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class AdminDocumentUploadDto {
  @IsString()
  @IsIn(["offer", "politics"])
  documentType!: "offer" | "politics";

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;
}
