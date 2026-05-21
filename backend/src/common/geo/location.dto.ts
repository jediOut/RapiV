import { IsNumber } from "class-validator";

export class LocationDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
