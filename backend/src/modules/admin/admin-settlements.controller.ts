import { Controller, Get } from "@nestjs/common";

import { Roles } from "../../common/auth/roles.decorator";
import { AdminSettlementsService } from "./admin-settlements.service";

@Controller("admin/settlements")
@Roles("ADMIN")
export class AdminSettlementsController {
  constructor(private readonly adminSettlementsService: AdminSettlementsService) {}

  @Get("overview")
  getOverview() {
    return this.adminSettlementsService.getOverview();
  }
}
