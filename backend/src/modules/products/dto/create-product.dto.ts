import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  category!: string;

  @IsInt()
  @Min(1)
  priceCents!: number;

  @IsOptional()
  @IsString()
  image?: string;
}
