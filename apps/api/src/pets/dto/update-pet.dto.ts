import {
  IsBoolean,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength
} from "class-validator";

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
  @IsString()
  @Length(1, 80)
  houseId?: string;

  @IsOptional()
  @IsObject()
  sceneJson?: Record<string, unknown>;
}
