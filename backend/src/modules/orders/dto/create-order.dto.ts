import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import type {
  CreateOrderItemPayload,
  CreateOrderPayload
} from "@rapidin/contracts";

export class CreateOrderItemDto implements CreateOrderItemPayload {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto implements CreateOrderPayload {
  @IsString()
  @MinLength(5)
  deliveryAddress!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsIn(["CARD", "CASH"])
  paymentMethod?: "CARD" | "CASH";

  @IsOptional()
  @IsIn(["DELIVERY", "PICKUP"])
  fulfillmentMethod?: "DELIVERY" | "PICKUP";

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
