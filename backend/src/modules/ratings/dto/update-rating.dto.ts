import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

import type { UpdateRatingPayload } from "@rapidin/contracts";

export class UpdateRatingDto implements UpdateRatingPayload {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
