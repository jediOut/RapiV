import { Body, Controller, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/jwt-auth.guard";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post("push-token")
  registerPushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPushTokenDto
  ) {
    return this.notificationsService.registerPushToken(user.sub, dto);
  }
}
