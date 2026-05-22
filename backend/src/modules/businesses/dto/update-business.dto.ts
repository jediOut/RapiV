import { Type } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import type { CreateBusinessPayload } from "@rapidin/contracts";

export class UpdateBusinessDto implements Partial<CreateBusinessPayload> {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
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
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsString()
  logo?: string;
}
