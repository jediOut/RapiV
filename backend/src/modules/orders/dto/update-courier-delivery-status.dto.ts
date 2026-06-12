import { IsIn, IsInt, IsOptional, Min } from "class-validator";
import type { UpdateCourierDeliveryStatusPayload } from "@rapidin/contracts";

export class UpdateCourierDeliveryStatusDto implements UpdateCourierDeliveryStatusPayload {
  @IsIn(["PICKED_UP", "ON_THE_WAY", "DELIVERED"])
  status!: UpdateCourierDeliveryStatusPayload["status"];

  @IsOptional()
  @IsInt()
  @Min(0)
  cashReceivedCents?: number;
}
