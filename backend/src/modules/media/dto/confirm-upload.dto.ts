import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

import type { MediaTargetType } from "./create-upload-url.dto";

export class ConfirmUploadDto {
  @IsIn(["business-logo", "product-image"])
  targetType!: MediaTargetType;

  @IsUUID()
  @IsOptional()
  targetId?: string;

  @IsString()
  objectKey!: string;
}
