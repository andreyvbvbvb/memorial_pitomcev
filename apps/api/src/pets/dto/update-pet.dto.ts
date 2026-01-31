import { IsBoolean, IsDateString, IsOptional, IsString, Length } from "class-validator";

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
  @Length(1, 200)
  epitaph?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  favoriteTreats?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  favoriteToys?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  favoriteSleepPlaces?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  story?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
