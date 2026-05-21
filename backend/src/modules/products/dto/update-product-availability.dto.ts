import { IsBoolean } from "class-validator";

export class UpdateProductAvailabilityDto {
  @IsBoolean()
  available!: boolean;
}
