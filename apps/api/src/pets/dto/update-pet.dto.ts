import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { Type } from "class-transformer";

export class UpdatePetDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

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
  @MaxLength(200)
  epitaph?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  favoriteTreats?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  favoriteToys?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  favoriteSleepPlaces?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
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
  @IsObject()
  sceneJson?: Record<string, unknown>;
}
