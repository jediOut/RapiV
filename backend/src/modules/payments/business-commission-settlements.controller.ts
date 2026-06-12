import { Controller, ForbiddenException, Get, Param, Patch, Post, Query } from "@nestjs/common";

import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/jwt-auth.guard";
import { BusinessCommissionSettlementsService } from "./business-commission-settlements.service";

@Controller("business-commission-settlements")
export class BusinessCommissionSettlementsController {
  constructor(private readonly settlementsService: BusinessCommissionSettlementsService) {}

  @Get("businesses/:businessId/mine")
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string
  ) {
    return this.settlementsService.findBusinessSettlements(user.sub, businessId);
  }

  @Get()
  findWeekly(
    @CurrentUser() user: AuthenticatedUser,
    @Query("week") settlementWeek?: string
  ) {
    this.assertAdmin(user);
    return this.settlementsService.findWeeklySettlements(settlementWeek);
  }

  @Post("weekly-run")
  runWeekly(
    @CurrentUser() user: AuthenticatedUser,
    @Query("week") settlementWeek?: string
  ) {
    this.assertAdmin(user);
    return this.settlementsService.runWeeklySettlement(settlementWeek);
  }

  @Patch(":settlementId/confirm")
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("settlementId") settlementId: string
  ) {
    this.assertAdmin(user);
    return this.settlementsService.confirmSettlement(settlementId, user.sub);
  }

  private assertAdmin(user: AuthenticatedUser): void {
    if (!user.roles.includes("ADMIN")) {
      throw new ForbiddenException("Only admins can manage business commission settlements");
    }
  }
}
