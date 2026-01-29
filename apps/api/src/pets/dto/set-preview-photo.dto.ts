import { IsString } from "class-validator";

export class SetPreviewPhotoDto {
  @IsString()
  photoId!: string;
}
