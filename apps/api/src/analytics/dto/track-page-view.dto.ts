import { IsString, MaxLength } from "class-validator";

export class TrackPageViewDto {
  @IsString()
  @MaxLength(300)
  path!: string;
}
