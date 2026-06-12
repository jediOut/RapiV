import { IsIn } from "class-validator";

import type { UpdateBusinessOrderStatusPayload } from "@rapidin/contracts";

export class UpdateBusinessOrderStatusDto implements UpdateBusinessOrderStatusPayload {
  @IsIn(["ACCEPTED", "PREPARING", "READY", "REJECTED", "DELIVERED"])
  status!: UpdateBusinessOrderStatusPayload["status"];
}
