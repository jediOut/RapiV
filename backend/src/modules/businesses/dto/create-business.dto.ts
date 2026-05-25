import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateBusinessDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsBoolean()
  acceptsCash?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptsCard?: boolean;

  @IsOptional()
  @IsString()
  stripeConnectedAccountId?: string;

  @IsOptional()
  @IsBoolean()
  stripeChargesEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minimumOrderItems?: number;
}
