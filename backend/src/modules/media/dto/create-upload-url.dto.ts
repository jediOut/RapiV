import { IsIn, IsOptional, IsString, IsUUID, Matches } from "class-validator";

export type MediaTargetType = "business-logo" | "product-image";

export class CreateUploadUrlDto {
  @IsIn(["business-logo", "product-image"])
  targetType!: MediaTargetType;

  @IsUUID()
  @IsOptional()
  targetId?: string;

  @IsString()
  @Matches(/^image\/(jpeg|png|webp)$/)
  contentType!: "image/jpeg" | "image/png" | "image/webp";
}
