import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

import type { CreateRatingPayload, RatingTargetType } from "@rapidin/contracts";

export class CreateRatingDto implements CreateRatingPayload {
  @IsUUID()
  orderGroupId!: string;

  @IsIn(["BUSINESS", "COURIER"])
  targetType!: RatingTargetType;

  @IsUUID()
  targetId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
