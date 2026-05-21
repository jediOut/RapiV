import { IsIn, IsNumber, IsOptional, Max, Min } from "class-validator";

import type { CourierAvailabilityStatus } from "../../users/courier-profile.entity";

export class UpdateCourierAvailabilityDto {
  @IsIn(["AVAILABLE", "BUSY", "OFFLINE"])
  status!: CourierAvailabilityStatus;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(80)
  preferredRadiusKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  maxDeliveryDistanceKm?: number;
}
