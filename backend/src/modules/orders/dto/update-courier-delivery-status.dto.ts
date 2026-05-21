import { IsIn } from "class-validator";
import type { UpdateCourierDeliveryStatusPayload } from "@rapidin/contracts";

export class UpdateCourierDeliveryStatusDto implements UpdateCourierDeliveryStatusPayload {
  @IsIn(["PICKED_UP", "ON_THE_WAY", "DELIVERED"])
  status!: UpdateCourierDeliveryStatusPayload["status"];
}
