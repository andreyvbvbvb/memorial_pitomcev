import { IsBoolean } from "class-validator";

export class AcceptTermsDto {
  @IsBoolean()
  acceptTerms!: boolean;

  @IsBoolean()
  acceptOffer!: boolean;
}
