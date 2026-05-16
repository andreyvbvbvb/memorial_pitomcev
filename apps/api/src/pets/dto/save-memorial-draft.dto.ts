import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min
} from "class-validator";

export class SaveMemorialDraftDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  species?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsDateString()
  deathDate?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  epitaph?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  story?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  markerStyle?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  environmentId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  houseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  step?: number;

  @IsOptional()
  @IsObject()
  sceneJson?: Record<string, unknown>;
}
