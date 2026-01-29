import { IsInt, IsString, Max, Min } from "class-validator";

export class TopUpDto {
  @IsString()
  ownerId!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  amount!: number;
}
