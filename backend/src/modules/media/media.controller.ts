import { Body, Controller, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/jwt-auth.guard";
import { ConfirmUploadDto } from "./dto/confirm-upload.dto";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";
import { MediaService } from "./media.service";

@Controller("media")
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post("upload-url")
  createUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadUrlDto
  ) {
    return this.mediaService.createUploadUrl(user, dto);
  }

  @Post("confirm")
  confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmUploadDto
  ) {
    return this.mediaService.confirmUpload(user, dto);
  }
}
